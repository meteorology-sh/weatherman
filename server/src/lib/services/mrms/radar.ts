// Node
import { gunzip } from "zlib";
import { promisify } from "util";

// Services
import { features, smoothFor } from "../shared/contour";
import type { RingStyle } from "../shared/contour";
import { eachMessage } from "../shared/grib";
import { BLOCK as DRAW_BLOCK, crop, DRAWN } from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import {
  coresFrame,
  drawnStorms,
  flankFrame,
  foldTracks,
  frame as stormFrame,
  identify,
  matchTracks,
  motionFrame,
  type MotionShape,
  near,
  nearJson,
  stormStyle,
} from "./objects";
import type { StormFrame, StormNear, StormObject } from "./objects";

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

/** The km one degree of latitude spans. */
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
export const BLOCK_NO_ECHO = -99;
export const BLOCK_NO_COVERAGE = -999;

const REFLECTIVITY = {
  property: "reflectivity",
  /**
   * dBZ. The NWS intensity classes. Faint stacked fills keep the map
   * underneath readable because rain is sparse; that is true at 1 km the same
   * way it was at 12 km.
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
  /** Strongest 1 km cell, dBZ. Null when nothing reaches the lowest contour. */
  peakDbz: number | null;
};

/**
 * `grid` is the native mosaic the contours were traced from, kept because the
 * candidate join reads it — see `reflectivityField`.
 */
type Scene = { frame: RadarFrame; stats: RadarStats; grid: Grid };

export class RadarService {
  /** The mosaic grid is fixed, so it is built once and reused for every scene. */
  private geo: Geo | null = null;
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  /** Replayed scenes, keyed by the archive key they were built from. */
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();
  /** Live objects from the previous mosaic, so an id can last across scans. */
  private tracks: { validTime: string; objects: StormObject[] } | null = null;
  private nextStormId = 1;

  async reflectivity(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<RadarFrame> {
    const scene = await this.scene(at);
    if (!this.geo) return scene.frame;
    const drawn = prepareRadarDraw(scene.grid, this.geo, box, fine);
    return {
      ...scene.frame,
      features: features(
        drawn.grid,
        drawn.geo,
        REFLECTIVITY.property,
        REFLECTIVITY.levels,
        smoothFor(fine)
      ),
    };
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

  /**
   * Contiguous ≥20 dBZ regions in `box`, as polygons. Outlines do not wait
   * on a previous mosaic; age and motion ride the working-area request and
   * the click, which is where they are read.
   */
  async objects(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<StormFrame> {
    const scene = await this.scene(at);
    this.ensurePrevious(scene);
    const { storms, validTime } = await this.storms(
      at,
      box,
      false,
      false,
      false,
      fine
    );
    return stormFrame(validTime, storms);
  }

  /**
   * One point per storm, at the 1 km cell with the strongest echo.
   * Waits on the previous mosaic so motion on the cores matches the arrows.
   */
  async cores(at?: Date, box: LonLatBox = DRAWN, fine = false) {
    const { storms, validTime } = await this.storms(
      at,
      box,
      !at,
      true,
      false,
      fine
    );
    return coresFrame(validTime, drawnStorms(storms));
  }

  /**
   * Heading ticks from each core. Empty when the storm has no motion:
   * we do not guess a direction.
   *
   * `shape` picks the geometry the caller can draw: the painted maps take
   * the dart, whose width is kilometers of ground; the live map takes the
   * line, whose width is pixels of screen.
   */
  async motion(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false,
    shape: MotionShape = "dart"
  ) {
    const { storms, validTime } = await this.storms(
      at,
      box,
      false,
      true,
      false,
      fine
    );
    return motionFrame(validTime, drawnStorms(storms), shape);
  }

  /**
   * Raining cells on the upwind edge of each storm. Empty when the storm
   * has no motion from a previous mosaic: we do not guess inflow.
   *
   * The same {@link drawnStorms} floor the cores and the headings use. A
   * speck under it has no core and no arrow, so drawing it a flank left an
   * orange outline around nothing the rest of the layer admits to.
   */
  async flanks(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<StormFrame> {
    const { storms, grid, geo, validTime } = await this.storms(
      at,
      box,
      !at,
      true,
      false,
      fine
    );
    return flankFrame(validTime, drawnStorms(storms), grid, geo, RAIN_DBZ);
  }

  /**
   * The object containing this point, or the nearest one whose rain is
   * within 40 km of it, with motion from the previous mosaic. Null
   * when nothing that close reaches 20 dBZ. Does not move the live track
   * list — a click is not a new mosaic.
   *
   * The storms are identified in a window cut around the click rather than
   * over the whole drawn box, because a click pays for its own scan. The
   * window is far wider than the answer it is asked for: a storm cut by its
   * wall has a core that is only the strongest cell in the crop and an
   * upwind side measured from that wrong center, so the window has to hold
   * the whole storm, not just the 40 km the reading covers.
   */
  async atPoint(
    lat: number,
    lon: number,
    at?: Date,
    fine = false
  ): Promise<{ reading: StormNear; geo: Geo } | null> {
    const pad = 1.2;
    const { storms, geo, validTime } = await this.storms(
      at,
      {
        west: lon - pad,
        east: lon + pad,
        south: lat - pad,
        north: lat + pad,
      },
      false,
      true,
      true,
      fine
    );
    const reading = near(lat, lon, storms, geo, validTime);
    return reading ? { reading, geo } : null;
  }

  async objectNear(
    lat: number,
    lon: number,
    at?: Date,
    fine = false
  ): Promise<ReturnType<typeof nearJson> | null> {
    const hit = await this.atPoint(lat, lon, at, fine);
    return hit ? nearJson(hit.reading) : null;
  }

  /**
   * How far back a previous mosaic may sit and still be the last scan of
   * the same storm, ms. The mosaic refreshes every ~2 minutes; 3 minutes
   * lands on the previous key without landing on this one.
   */
  private static readonly PREV_MS = 3 * 60_000;

  /**
   * How many previous mosaics a click may walk to age a storm. Six is
   * about 18 minutes. The walk only uses mosaics already decoded — a
   * click does not fetch the rest.
   */
  private static readonly AGE_LOOKBACK = 6;

  private ensurePrevious(scene: Scene): void {
    void this.previousScene(scene);
  }

  /**
   * The mosaic just before `current`. Archive, not `.latest`: the live
   * alias has no history. Null when the archive has nothing distinct.
   */
  private async previousScene(current: Scene): Promise<Scene | null> {
    const t = Date.parse(current.frame.validTime);
    if (Number.isNaN(t)) return null;
    try {
      for (const back of [1, 2]) {
        const prev = await this.replay(
          new Date(t - back * RadarService.PREV_MS)
        );
        if (prev.frame.validTime !== current.frame.validTime) return prev;
      }
      return null;
    } catch {
      return null;
    }
  }

  /**
   * A decoded mosaic already in memory whose time is within one scan of
   * `at`. Null if we would have to download to answer — a click does not
   * decode six national GRIBs to age a storm.
   */
  private cachedNear(at: Date): Scene | null {
    const want = at.getTime();
    const scenes: Scene[] = [];
    if (this.cache) scenes.push(this.cache.scene);
    for (const scene of this.archive.values()) scenes.push(scene);
    let nearest: Scene | null = null;
    let nearestDelta = Infinity;
    for (const scene of scenes) {
      const t = Date.parse(scene.frame.validTime);
      if (Number.isNaN(t)) continue;
      const delta = Math.abs(t - want);
      if (delta < nearestDelta) {
        nearest = scene;
        nearestDelta = delta;
      }
    }
    if (!nearest || nearestDelta > RadarService.PREV_MS) return null;
    return nearest;
  }

  /**
   * Walk older mosaics already in the archive, oldest first, so `firstSeen`
   * is the earliest centroid match we have rather than the scan before this
   * one. Missing scans stop the walk; they are not fetched.
   */
  private async agedStorms(
    scene: Scene,
    box: LonLatBox,
    current: StormObject[],
    style: RingStyle,
    fine: boolean
  ): Promise<StormObject[]> {
    const t = Date.parse(scene.frame.validTime);
    if (Number.isNaN(t) || !this.geo) return current;
    const scans: { time: string; storms: StormObject[] }[] = [
      { time: scene.frame.validTime, storms: current },
    ];
    let lastTime = scene.frame.validTime;
    for (let back = 1; back <= RadarService.AGE_LOOKBACK; back++) {
      const prev = this.cachedNear(
        new Date(t - back * RadarService.PREV_MS)
      );
      if (!prev) break;
      if (prev.frame.validTime === lastTime) continue;
      const drawn = prepareRadarDraw(prev.grid, this.geo, box, fine);
      scans.push({
        time: prev.frame.validTime,
        storms: identify(
          drawn.grid,
          drawn.geo,
          RAIN_DBZ,
          prev.frame.validTime,
          style
        ),
      });
      lastTime = prev.frame.validTime;
    }
    scans.reverse();
    return foldTracks(scans);
  }

  private async storms(
    at: Date | undefined,
    box: LonLatBox,
    track: boolean,
    wantMotion: boolean,
    wantAge = false,
    fine = false
  ): Promise<{
    storms: StormObject[];
    grid: Grid;
    geo: Geo;
    validTime: string;
  }> {
    const scene = await this.scene(at);
    if (!this.geo) {
      return {
        storms: [],
        grid: scene.grid,
        geo: { nx: 0, ny: 0, lats: new Float32Array(), lons: new Float32Array() },
        validTime: scene.frame.validTime,
      };
    }
    const drawn = prepareRadarDraw(scene.grid, this.geo, box, fine);
    const style = stormStyle(fine);
    let storms = identify(
      drawn.grid,
      drawn.geo,
      RAIN_DBZ,
      scene.frame.validTime,
      style
    );

    if (storms.length === 0) {
      return {
        storms,
        grid: drawn.grid,
        geo: drawn.geo,
        validTime: scene.frame.validTime,
      };
    }

    if (wantAge) {
      storms = await this.agedStorms(scene, box, storms, style, fine);
    }

    const livePrev =
      track &&
      this.tracks !== null &&
      this.tracks.validTime !== scene.frame.validTime
        ? this.tracks
        : null;

    let prevObjects: StormObject[] | null = livePrev?.objects ?? null;
    let prevTime: string | null = livePrev?.validTime ?? null;

    const missingMotion =
      wantMotion && storms.every((s) => s.motionTowardDeg == null);

    if (missingMotion && prevObjects === null) {
      const prev = await this.previousScene(scene);
      if (prev && this.geo) {
        const prevDrawn = prepareRadarDraw(prev.grid, this.geo, box, fine);
        prevObjects = identify(
          prevDrawn.grid,
          prevDrawn.geo,
          RAIN_DBZ,
          prev.frame.validTime,
          style
        );
        prevTime = prev.frame.validTime;
      }
    }

    if (prevObjects && prevTime) {
      const nextId = { value: track ? this.nextStormId : prevObjects.length + 1 };
      storms = matchTracks(
        prevObjects,
        storms,
        prevTime,
        scene.frame.validTime,
        nextId
      );
      if (track) this.nextStormId = nextId.value;
    } else if (track) {
      this.nextStormId = storms.length + 1;
    }

    if (track) {
      this.tracks = { validTime: scene.frame.validTime, objects: storms };
    }

    return {
      storms,
      grid: drawn.grid,
      geo: drawn.geo,
      validTime: scene.frame.validTime,
    };
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
          grid = nativeGrid(values);
        },
      },
      "mrms"
    );

    if (!grid) throw new Error("MRMS mosaic carried no message");

    this.geo ??= nativeGeo();

    return {
      frame: {
        type: "FeatureCollection",
        validTime,
        features: [],
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
 * Crop, then — unless evaluation asked for native rings — average four
 * 1 km cells in reflectivity factor. Same window as the fill, so a click
 * is inside the ring the map draws.
 */
function prepareRadarDraw(
  grid: Grid,
  geo: Geo,
  box: LonLatBox,
  fine: boolean
): { grid: Grid; geo: Geo } {
  const cropped = crop(grid, geo, box);
  if (fine) return cropped;
  return coarsenReflectivity(cropped.grid, cropped.geo, DRAW_BLOCK);
}

/**
 * Mean each `factor`×`factor` block in Z = 10^(dBZ/10). A plain mean of
 * dBZ is not the mean of anything. No-coverage points stay out of the
 * denominator; no-echo is a real zero. The crop is already south-up, so
 * this does not flip rows the way {@link nativeGrid} does.
 */
export function coarsenReflectivity(
  grid: Grid,
  geo: Geo,
  factor: number
): { grid: Grid; geo: Geo } {
  if (factor <= 1) return { grid, geo };
  const ox = Math.floor(grid.nx / factor);
  const oy = Math.floor(grid.ny / factor);
  if (ox < 1 || oy < 1) return { grid, geo };
  const values = new Float32Array(ox * oy);
  const lats = new Float32Array(ox * oy);
  const lons = new Float32Array(ox * oy);
  const block = factor * factor;
  for (let bj = 0; bj < oy; bj++) {
    for (let bi = 0; bi < ox; bi++) {
      let z = 0;
      let covered = 0;
      let lat = 0;
      let lon = 0;
      for (let dj = 0; dj < factor; dj++) {
        const row = (bj * factor + dj) * grid.nx + bi * factor;
        for (let di = 0; di < factor; di++) {
          const k = row + di;
          lat += geo.lats[k];
          lon += geo.lons[k];
          const v = grid.values[k];
          if (v <= NO_COVERAGE) continue;
          covered++;
          if (v > NO_ECHO) z += Math.pow(10, v / 10);
        }
      }
      const o = bj * ox + bi;
      values[o] =
        covered === 0
          ? BLOCK_NO_COVERAGE
          : z === 0
            ? BLOCK_NO_ECHO
            : 10 * Math.log10(z / covered);
      lats[o] = lat / block;
      lons[o] = lon / block;
    }
  }
  return {
    grid: { nx: ox, ny: oy, values },
    geo: { nx: ox, ny: oy, lats, lons },
  };
}

/**
 * Flip a north-up mosaic south-up and keep every 1 km cell.
 *
 * MRMS scans north to south; the shared contourer infers ring orientation from
 * signed area, so a north-up grid would drop every exterior as a hole.
 */
export function nativeGrid(
  values: Float32Array,
  nx = NX,
  ny = NY
): Grid {
  const out = new Float32Array(nx * ny);
  for (let sj = 0; sj < ny; sj++) {
    out.set(values.subarray(sj * nx, (sj + 1) * nx), (ny - 1 - sj) * nx);
  }
  return { nx, ny, values: out };
}

/**
 * Lat/lon of each 1 km cell, south row first. The mosaic is a regular lat/lon
 * grid, so this is arithmetic — no GRIB read required.
 */
export function nativeGeo(nx = NX, ny = NY): Geo {
  const lats = new Float32Array(nx * ny);
  const lons = new Float32Array(nx * ny);
  for (let sj = 0; sj < ny; sj++) {
    const lat = LAT0 - STEP * sj;
    const oj = ny - 1 - sj;
    for (let i = 0; i < nx; i++) {
      const k = oj * nx + i;
      lats[k] = lat;
      lons[k] = LON0 + STEP * i;
    }
  }
  return { nx, ny, lats, lons };
}

/**
 * Index of the 1 km cell a point falls in, or -1 outside the mosaic's box.
 *
 * Nearest cell, and nothing between cells. Interpolating would invent structure
 * the mosaic does not have (`MEASUREMENTS.md` §3). Rows are found in scan order
 * — the mosaic runs north to south — and then flipped, because `nativeGrid`
 * stores them south-up to match HRRR.
 */
export function mosaicIndex(
  lat: number,
  lon: number,
  nx = NX,
  ny = NY
): number {
  const sj = Math.round((LAT0 - lat) / STEP);
  const i = Math.round((lon - LON0) / STEP);
  if (sj < 0 || sj >= ny || i < 0 || i >= nx) return -1;
  return (ny - 1 - sj) * nx + i;
}

/**
 * Ground covered by one 1 km cell at a given latitude, km^2. A 0.01 degree
 * cell is ~1.1 km tall everywhere and ~0.85 km wide at 40 N, so a fixed figure
 * would overstate the area of everything north of the Gulf.
 */
function cellKm2(lat: number): number {
  const tall = STEP * KM_PER_DEG;
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
 * message, so a mislabeled filename cannot caption the map.
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
