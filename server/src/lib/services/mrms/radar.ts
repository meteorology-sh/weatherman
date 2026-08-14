// Node
import { gunzip } from "zlib";
import { promisify } from "util";

// Services
import { features } from "../shared/contour";
import { eachMessage } from "../shared/grib";

// Types
import type { Grid, Geo, ContourFeature } from "../shared/contour";

const gunzipAsync = promisify(gunzip);

/**
 * MRMS publishes the quality-controlled national mosaic as a single GRIB2
 * message, gzipped, replaced every ~2 minutes. `.latest` is a stable alias, so
 * unlike HRRR there is no run to discover and no index to read — one URL, one
 * record, ~900 KB.
 */
const MRMS =
  "https://mrms.ncep.noaa.gov/data/2D/MergedBaseReflectivityQC/" +
  "MRMS_MergedBaseReflectivityQC.latest.grib2.gz";

/**
 * The same product, dated, for replaying a past scene.
 *
 * `.latest` is an alias with no history behind it, so a historical request has
 * to name the scene. The bucket keeps a key roughly every two minutes back to
 * 2020 under `CONUS/<product>/YYYYMMDD/`, and the scene time is in the filename
 * — which is what lets `sceneAt` pick the nearest one without downloading any.
 */
const MRMS_ARCHIVE = "https://noaa-mrms-pds.s3.amazonaws.com";
const MRMS_PRODUCT = "MergedBaseReflectivityQC_00.50";

/**
 * How far from the requested time a scene may sit before we refuse it.
 *
 * The mosaic arrives every ~2 minutes, so the nearest key is normally seconds
 * away. A gap of more than half an hour means the feed was down, and answering
 * with whatever is closest would silently caption an old scene with the time
 * that was asked for.
 */
const SCENE_TOLERANCE_MS = 30 * 60_000;

/** Replayed scenes never change, so a handful are kept keyed by their time. */
const ARCHIVE_CACHE = 8;

/**
 * The mosaic grid: 0.01 degrees, north-to-south, west-to-east, fixed for every
 * scene. Regular lat/lon, so the geometry is arithmetic — we never pay for
 * eccodes' geo iterator here the way the HRRR Lambert grid forces us to.
 */
const NX = 7000;
const NY = 3500;
const POINTS = NX * NY;
const LAT0 = 54.995;
const LON0 = -129.995;
const STEP = 0.01;

/**
 * ~1 km -> ~12 km, matching the grid the HRRR layers contour on so the two
 * agree about how much detail a national map is allowed to show. Block
 * averaging removes structure; it never invents it.
 */
const BLOCK = 12;

/** Degrees per block, and the km one degree of latitude spans. */
const CELL_DEG = BLOCK * STEP;
const KM_PER_DEG = 111.32;

/**
 * MRMS spends two sentinels on absence and they mean opposite things:
 *
 * - **-99: no echo.** A radar looked here and found nothing. Real information.
 * - **-999: no coverage.** No radar sees this point at all — ocean, the far
 *   side of the border, or a genuine gap in the network. It is 33% of this
 *   bounding box, and it is *not* a report of clear air.
 *
 * Averaging them together would turn "we cannot see" into "it is not raining",
 * which is the one thing this layer must never say. So no-coverage points are
 * dropped from the denominator and counted separately.
 */
const NO_COVERAGE = -900;
const NO_ECHO = -90;

/**
 * The block grid keeps the same two sentinels, for the same reason: a covered
 * block with no echo is a real report of clear air, an uncovered one is not.
 * Both sit below every contour level, so neither draws anything.
 */
const BLOCK_NO_ECHO = -99;
export const BLOCK_NO_COVERAGE = -999;

const REFLECTIVITY = {
  property: "reflectivity",
  /**
   * dBZ. The NWS intensity classes, and measured against a real mosaic rather
   * than chosen for round numbers: at 12 km, >=20 covers 1.41% of the box,
   * >=30 0.36%, >=40 0.074%, >=50 0.008%. That is the same footprint the HRRR
   * precipitation and liquid-water layers have, so the same faint stacked fills
   * keep the map underneath readable.
   */
  levels: [20, 30, 40, 50],
} as const;

/**
 * The reflectivity at which a cloud counts as already raining, dBZ.
 *
 * The lowest contour the map draws, and the one the candidate join crosses a
 * cell off at — so the disqualifier on the map and the disqualifier in the join
 * are the same number and cannot drift apart.
 */
export const RAIN_DBZ = REFLECTIVITY.levels[0];

/**
 * Two MRMS cycles. The mosaic refreshes every ~2 minutes and a build costs
 * ~12 s, so tracking it exactly would mean rebuilding almost continuously for a
 * product whose decision — "is this candidate already precipitating" — does not
 * turn on a two-minute change. The frame carries its own valid time, so the
 * sidebar reports the scene's age rather than implying it is live.
 */
const CACHE_TTL_MS = 5 * 60_000;

export type RadarFrame = {
  type: "FeatureCollection";
  /** Time of the scene itself, ISO 8601 — not the time we fetched it. */
  validTime: string;
  features: ContourFeature[];
};

/**
 * What the sidebar reports. Every number is against the ground the radar
 * network actually sees, because a percentage of the whole box would be a
 * statement about the Pacific.
 */
export type RadarStats = {
  fetchedAt: string;
  validTime: string;
  /** Percent of the mosaic's box any radar covers. */
  radarCoveragePct: number;
  /** Percent of covered ground at or above the lowest contour. */
  echoPct: number;
  /** Ground at or above the lowest contour, km^2. */
  echoKm2: number;
  /** Strongest 12 km cell, dBZ. Null when nothing reaches the lowest contour. */
  peakDbz: number | null;
};

/**
 * `grid` is the block-averaged mosaic the contours were traced from, kept
 * because the candidate join reads it — see `reflectivityField`.
 */
type Scene = { frame: RadarFrame; stats: RadarStats; grid: Grid };

export class RadarService {
  /** The block grid is fixed, so it is built once and reused for every scene. */
  private geo: Geo | null = null;
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  /** Replayed scenes, keyed by the archive key they were built from. */
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();

  async reflectivity(at?: Date): Promise<RadarFrame> {
    return (await this.scene(at)).frame;
  }

  /** The same build's summary. Asking for either warms both. */
  async reflectivityStats(at?: Date): Promise<RadarStats> {
    return (await this.scene(at)).stats;
  }

  /**
   * The block grid the contours were traced from, for the candidate join.
   *
   * **On the mosaic's own grid, not HRRR's** — this is a regular lat/lon grid
   * and HRRR's is Lambert, so the caller indexes into it with `blockIndex`
   * rather than assuming the two arrays line up cell for cell.
   */
  async reflectivityField(
    at?: Date
  ): Promise<{ grid: Grid; validTime: string }> {
    const scene = await this.scene(at);
    return { grid: scene.grid, validTime: scene.frame.validTime };
  }

  private async scene(at?: Date): Promise<Scene> {
    if (at) return this.replay(at);

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
    // Collapse concurrent requests onto one download; a build is ~12 s and the
    // map asks for the frame and the stats at the same moment.
    if (this.inflight) return this.inflight;

    const work = this.build()
      .then((scene) => {
        this.cache = { scene, fetchedAt: Date.now() };
        return scene;
      })
      .finally(() => {
        this.inflight = null;
      });

    this.inflight = work;
    return work;
  }

  /**
   * A past scene, keyed by the archive object it comes from rather than by the
   * time that was asked for — two requests a minute apart resolve to the same
   * key and share one build, and the frame still reports the scan's own time.
   *
   * No TTL: a scene from 2025 is not going to change.
   */
  private async replay(at: Date): Promise<Scene> {
    const key = await this.sceneAt(at);

    const cached = this.archive.get(key);
    if (cached) return cached;

    const running = this.archiveInflight.get(key);
    if (running) return running;

    const work = this.build(key)
      .then((scene) => {
        this.archive.set(key, scene);
        while (this.archive.size > ARCHIVE_CACHE) {
          this.archive.delete(this.archive.keys().next().value!);
        }
        return scene;
      })
      .finally(() => this.archiveInflight.delete(key));

    this.archiveInflight.set(key, work);
    return work;
  }

  /**
   * The archived key nearest `at`.
   *
   * Listed by hour rather than by day: a day holds ~720 keys and a listing is
   * capped at 1000, so an hour-wide prefix keeps it to one page. The hour either
   * side is listed too, because the nearest scene to 14:00:30 may well be the
   * 13:59 one.
   */
  private async sceneAt(at: Date): Promise<string> {
    if (Number.isNaN(at.getTime())) {
      throw new Error("`at` must be an ISO 8601 timestamp");
    }
    const want = at.getTime();
    const keys: string[] = [];
    for (const offset of [-1, 0, 1]) {
      const t = new Date(want + offset * 3_600_000);
      const day = t.toISOString().slice(0, 10).replace(/-/g, "");
      const hh = String(t.getUTCHours()).padStart(2, "0");
      const prefix = `CONUS/${MRMS_PRODUCT}/${day}/MRMS_${MRMS_PRODUCT}_${day}-${hh}`;
      keys.push(...(await this.list(prefix)));
    }

    let best: { key: string; delta: number } | null = null;
    for (const key of keys) {
      const t = Date.parse(archiveKeyTime(key));
      if (Number.isNaN(t)) continue;
      const delta = Math.abs(t - want);
      if (!best || delta < best.delta) best = { key, delta };
    }

    if (!best) {
      throw new Error(`No archived MRMS scene near ${at.toISOString()}`);
    }
    if (best.delta > SCENE_TOLERANCE_MS) {
      throw new Error(
        `Nearest archived MRMS scene to ${at.toISOString()} is ` +
          `${Math.round(best.delta / 60_000)} min away — refusing to caption it ` +
          `as that time`
      );
    }
    return best.key;
  }

  private async list(prefix: string): Promise<string[]> {
    const res = await fetch(
      `${MRMS_ARCHIVE}/?list-type=2&prefix=${encodeURIComponent(prefix)}`
    );
    if (!res.ok) throw new Error(`MRMS archive listing failed: ${res.status}`);
    const xml = await res.text();
    return Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]);
  }

  private async build(key?: string): Promise<Scene> {
    const grib = await gunzipAsync(await this.download(key));

    let grid: Grid | null = null;
    let validTime = "";

    await eachMessage(
      grib,
      {
        keys: ["validityDate", "validityTime"],
        points: POINTS,
        onMessage: ([date, time], values) => {
          validTime = sceneTime(date, time);
          grid = blockAverage(values);
        },
      },
      "mrms"
    );

    if (!grid) throw new Error("MRMS mosaic carried no message");

    this.geo ??= blockGeo();

    return {
      frame: {
        type: "FeatureCollection",
        validTime,
        features: features(
          grid,
          this.geo,
          REFLECTIVITY.property,
          REFLECTIVITY.levels
        ),
      },
      stats: summarize(grid, this.geo, validTime),
      grid,
    };
  }

  /**
   * Fetch the mosaic, with one retry.
   *
   * Not defensive habit: the MRMS host closes the connection part-way through
   * the body often enough to have done it during this feature's first live run
   * (`UND_ERR_SOCKET: other side closed`, 885 KB of ~907 KB read). The file is
   * under a megabyte and replaced every two minutes, so a second attempt costs
   * a second and turns an intermittent 500 into a working map.
   */
  private async download(key?: string): Promise<Buffer> {
    const url = key ? `${MRMS_ARCHIVE}/${key}` : MRMS;
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`MRMS mosaic unavailable: ${res.status}`);
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        last = error;
      }
    }
    throw new Error(
      `MRMS mosaic unreachable: ${last instanceof Error ? last.message : String(last)}`
    );
  }
}

/**
 * Block-average the mosaic to the 12 km contour grid, **in linear reflectivity
 * factor rather than dBZ**.
 *
 * dBZ is a logarithm, so a plain mean of it is not the mean of anything. The
 * average of 20 and 50 dBZ is not 35 dBZ of weather — it is a cell holding half
 * the water of a 47 dBZ one. So each point is converted to Z = 10^(dBZ/10),
 * averaged there, and converted back, which is the same operation the
 * block-average in forecast.ts performs on a linear field.
 *
 * **Rows are flipped north-up to south-up on the way out**, and that is
 * load-bearing rather than tidiness. MRMS scans north to south; HRRR's grid
 * runs south to north, and `polygons` infers a ring's orientation from its
 * signed area. Feeding it a north-up grid flips the sign of every ring, so
 * exteriors are classified as holes and — having no exterior to nest inside —
 * silently dropped: a mosaic with 2,395 cells over 20 dBZ contoured to 23 tiny
 * polygons, and the 40 and 50 dBZ levels disappeared while the stats still
 * reported a 57 dBZ peak. Flipping here keeps the shared contourer on one
 * convention.
 *
 * `nx`/`ny` are parameters so this is testable on a grid you can read.
 */
export function blockAverage(values: Float32Array, nx = NX, ny = NY): Grid {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const out = new Float32Array(ox * oy);

  for (let sj = 0; sj < oy; sj++) {
    const oj = oy - 1 - sj;
    for (let bi = 0; bi < ox; bi++) {
      let z = 0;
      let covered = 0;
      for (let dj = 0; dj < BLOCK; dj++) {
        const row = (sj * BLOCK + dj) * nx + bi * BLOCK;
        for (let di = 0; di < BLOCK; di++) {
          const v = values[row + di];
          if (v <= NO_COVERAGE) continue;
          covered++;
          // No echo contributes a real zero: the radar looked and found none.
          if (v > NO_ECHO) z += Math.pow(10, v / 10);
        }
      }
      out[oj * ox + bi] =
        covered === 0
          ? BLOCK_NO_COVERAGE
          : z === 0
            ? BLOCK_NO_ECHO
            : 10 * Math.log10(z / covered);
    }
  }
  return { nx: ox, ny: oy, values: out };
}

/**
 * Lat/lon of each block's centre, south row first. The mosaic is a regular
 * lat/lon grid, so this is arithmetic — no GRIB read required.
 */
export function blockGeo(nx = NX, ny = NY): Geo {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const lats = new Float32Array(ox * oy);
  const lons = new Float32Array(ox * oy);
  const half = (BLOCK - 1) / 2;

  for (let sj = 0; sj < oy; sj++) {
    const lat = LAT0 - STEP * (sj * BLOCK + half);
    const oj = oy - 1 - sj;
    for (let bi = 0; bi < ox; bi++) {
      const k = oj * ox + bi;
      lats[k] = lat;
      lons[k] = LON0 + STEP * (bi * BLOCK + half);
    }
  }
  return { nx: ox, ny: oy, lats, lons };
}

/**
 * Index of the block a point falls in, or -1 outside the mosaic's box.
 *
 * The mosaic is a regular lat/lon grid, so this is arithmetic rather than the
 * scan `nearestCell` has to do on HRRR's Lambert grid — which is what makes
 * sampling the whole 118k-cell HRRR grid onto this one cheap enough to do on
 * every candidate build.
 *
 * **Nearest block, and nothing between blocks.** The two grids are both ~12 km,
 * so taking the block a cell's centre lands in resamples one grid onto another
 * of the same spacing. Interpolating between blocks would invent structure the
 * mosaic does not have, which is the rule `MEASUREMENTS.md` §3 sets.
 *
 * Rows are found in scan order — the mosaic runs north to south — and then
 * flipped, because `blockAverage` stores them south-up to match HRRR.
 */
export function blockIndex(lat: number, lon: number, nx = NX, ny = NY): number {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const half = (BLOCK - 1) / 2;

  const sj = Math.round((LAT0 - STEP * half - lat) / CELL_DEG);
  const bi = Math.round((lon - LON0 - STEP * half) / CELL_DEG);
  if (sj < 0 || sj >= oy || bi < 0 || bi >= ox) return -1;

  return (oy - 1 - sj) * ox + bi;
}

/**
 * Ground covered by one block at a given latitude, km^2. A 0.12 degree cell is
 * ~13 km tall everywhere and ~10 km wide at 40 N, so a fixed figure would
 * overstate the area of everything north of the Gulf.
 */
function cellKm2(lat: number): number {
  const tall = CELL_DEG * KM_PER_DEG;
  const wide = tall * Math.cos((lat * Math.PI) / 180);
  return tall * wide;
}

/**
 * Fold the block grid into the numbers the sidebar reports.
 *
 * Everything is measured against the ground the radar network actually sees.
 * A percentage of the whole box would be a statement about the Pacific: a third
 * of it has no radar over it, and "no echo" there is not a report of clear air.
 */
export function summarize(grid: Grid, geo: Geo, validTime: string): RadarStats {
  const floor = REFLECTIVITY.levels[0];
  let covered = 0;
  let echo = 0;
  let echoKm2 = 0;
  let peak = -Infinity;

  for (let k = 0; k < grid.values.length; k++) {
    const v = grid.values[k];
    if (v <= NO_COVERAGE) continue;
    covered++;
    if (v > NO_ECHO && v > peak) peak = v;
    if (v >= floor) {
      echo++;
      // Read off the same geo the contours are drawn against, so the area and
      // the picture cannot disagree about where a cell is.
      echoKm2 += cellKm2(geo.lats[k]);
    }
  }

  return {
    fetchedAt: new Date().toISOString(),
    validTime,
    radarCoveragePct: pct(covered, grid.nx * grid.ny),
    // Against covered ground, not the whole box: a third of the box is ocean.
    echoPct: pct(echo, covered),
    echoKm2: Math.round(echoKm2),
    peakDbz: peak >= floor ? Math.round(peak) : null,
  };
}

const pct = (part: number, whole: number) =>
  whole === 0 ? 0 : Math.round((10000 * part) / whole) / 100;

/**
 * eccodes prints the scene's validity as `20260812` and `402` — the time is an
 * integer, so a 04:02 scene loses its leading zero and a midnight one prints as
 * `0`. Pad before slicing or the map reports the wrong hour.
 */
export function sceneTime(date: string, time: string): string {
  const hhmm = time.padStart(4, "0");
  const iso =
    `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}` +
    `T${hhmm.slice(0, 2)}:${hhmm.slice(2, 4)}:00.000Z`;
  if (Number.isNaN(Date.parse(iso))) {
    throw new Error(`MRMS scene time unreadable: ${date} ${time}`);
  }
  return iso;
}

/**
 * Scan time embedded in an archive key, as ISO 8601.
 *
 * Keys look like
 * `.../20250515/MRMS_MergedBaseReflectivityQC_00.50_20250515-181439.grib2.gz`,
 * so the time is `YYYYMMDD-HHMMSS` before the extension. This is only used to
 * *choose* a key — the frame's own `validTime` still comes from the decoded
 * message, so a mislabelled filename cannot caption the map.
 */
export function archiveKeyTime(key: string): string {
  const m = key.match(/_(\d{8})-(\d{6})\./);
  if (!m) return "";
  const [, d, t] = m;
  return (
    `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}` +
    `T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}.000Z`
  );
}

export const Mrms = new RadarService();
