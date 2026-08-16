/**
 * Observed cloud-top temperature, from GOES-East geometry and HRRR thermodynamics.
 *
 * This is the one layer on either map built from two sources on purpose, and
 * the split is the whole point. `MEASUREMENTS.md` §5 records that HRRR "nails
 * the thermodynamic profile and is much shakier on cloud", so the satellite is
 * asked the question it can answer — *where is the cloud top, and how high* —
 * and HRRR is asked the one it can — *how cold is it up there*. Neither is used
 * for the other's job.
 *
 * That makes it the only cloud layer here that can contradict the model. The
 * supercooled-liquid contours are HRRR's opinion; if the satellite sees no
 * cloud where those contours are amber, the operator learns something, which is
 * exactly the role MRMS already plays.
 */

// Services
import { bandFeatures } from "../shared/contour";
import { Hrrr } from "../hrrr/forecast";
import { pixelAt } from "./abi";
import { download, gridOf, readScene, scalar, sceneTime } from "./scene";
import { CLOUD_TOP_PRODUCT, latestPairedKey, pairedKeyAt } from "./sweep";

// Types
import type { Grid, Geo, ContourFeature } from "../shared/contour";
import type { Column } from "../hrrr/forecast";
import type { AbiGrid } from "./abi";

/**
 * Cloud-top pressure. The constant and the reason for it live in `sweep.ts`,
 * which owns both halves of a scan — this service reads one of them and never
 * chooses which scan it reads.
 */
const PRODUCT = CLOUD_TOP_PRODUCT;

/**
 * One scene's cadence. A build is dominated by the HRRR profile it leans on
 * (~25 s cold, then free for the rest of that run), and the scene itself
 * refreshes every 5 minutes, so this matches the radar service's reasoning:
 * track the feed loosely and let the frame carry its own valid time rather than
 * implying it is live.
 */
const CACHE_TTL_MS = 5 * 60_000;

/**
 * How far from the requested time a replayed sweep may sit.
 *
 * ABI scans CONUS every 5 minutes, so the nearest sweep is normally a couple of
 * minutes away. A larger gap means a gap in the record, and answering with the
 * closest thing would caption an unrelated scan with the time that was asked
 * for. Wider than the radar's tolerance because the cadence is slower.
 */
const SCENE_TOLERANCE_MS = 30 * 60_000;

/** Replayed scenes never change, so a handful are kept keyed by their S3 key. */
const ARCHIVE_CACHE = 8;

/**
 * The analysis hour. The candidate map is "right now", and `CandidateLiquidLayer`
 * is pinned the same way for the same reason.
 */
const ANALYSIS_HOUR = 0;

/** Ground covered by one 12 km cell, km^2. Mirrors CELL_KM2 in forecast.ts. */
const CELL_KM2 = 144;

const CLOUD_TOP = {
  /**
   * Degrees below zero at the cloud top.
   *
   * The field is negated once here because `features()` contours `value >=
   * level` and cloud-top temperature runs the wrong way for that: colder is the
   * direction of interest, and nesting requires the scalar to increase with it.
   * So a top at −18 °C is stored as 18, and the levels below read as −5, −12,
   * −18 and −25 °C.
   */
  property: "topColdnessC",
  /**
   * Band edges in coldness, i.e. −5, −12, −18 and −25 °C. **Disjoint, not
   * nested** — see `bandFeatures`.
   *
   * **−5 °C is a filter; the other three are not.**
   *
   * −5 °C is the rule `SENSING_STRATEGY.md` states as "the band must
   * physically lie between base and top. A shallow warm cloud never reaches
   * it." A top warmer than −5 °C means the seeding band is *above* the cloud,
   * so there is nothing inside it to seed, and that describes most cloudy
   * ground over a Texas year. Masking those off is what this layer is for.
   *
   * −12, −18 and −25 °C are **reference isotherms, not gates** — −18 °C is the
   * seeding band's cold edge, and the others bracket it. The bands drawn from
   * them fade as they get colder, and the reason is the ice: silver iodide only
   * does something in a cloud that still holds liquid, natural ice-nucleating
   * particles are scarce at warm subzero temperatures and common well below
   * them, so a colder top is likelier to have frozen on its own and spent the
   * water seeding would have converted.
   *
   * There is **no cold cutoff**, and the fade is not one. A cutoff would be a
   * claim that seeding stops paying below some cloud-top temperature; what the
   * physics supports is a gradual fall-off with no edge in it. It also cuts
   * both ways — a colder top means the band is more fully enclosed by the cloud
   * — and cloud-top temperature is the coldest part of a cloud rather than a
   * summary of it, so a vigorous cell with a very cold anvil can still carry
   * liquid in the band. Nothing is discarded for being cold: the coldest band
   * is open-ended and still drawn. Neither this layer nor the supercooled-liquid
   * one observes phase — that layer is the model's opinion about the right
   * variable, not a measurement of it. See `MEASUREMENTS.md` §2 and §4.
   */
  levels: [5, 12, 18, 25],
} as const;

/** The warm edge, as a temperature. Mirrors BAND_WARMEST_C in the app. */
export const TOP_WARMEST_C = -CLOUD_TOP.levels[0];

/**
 * Marks a cell the satellite reports as clear.
 *
 * It has to sit below the lowest contour level so nothing is drawn, and it is
 * the property this layer exists for: where GOES sees no cloud, the map draws
 * nothing at all and the basemap shows through. That is what the Band 13
 * imagery this replaced could never do — an infrared image paints warm clear
 * sky opaquely and buries whatever is underneath.
 */
export const CLEAR = -999;

/**
 * GOES pixels across one 12 km cell. The ABI pixel is ~2 km at nadir, so six of
 * them span the cell there.
 *
 * Approximate on purpose, and it errs the readable way: a pixel's ground
 * footprint grows away from the sub-satellite point, so over CONUS this window
 * covers somewhat more than 12 km and the block mean is slightly smoother than
 * the grid. Smoothing removes structure; it never invents any, which is the
 * same rule §3 applies to every other block average here.
 */
const WINDOW = 6;

export type CloudTopFrame = {
  type: "FeatureCollection";
  /** Start of the satellite scan, ISO 8601 — not when we fetched it. */
  validTime: string;
  /** HRRR run that supplied the temperatures, ISO 8601. */
  profileRun: string;
  features: ContourFeature[];
};

/**
 * What the sidebar reports. It names both sources, because this layer is a
 * claim built from two and an operator reading "cloud top −14 °C" deserves to
 * know which half of that came from a satellite and which from a model.
 */
export type CloudTopStats = {
  fetchedAt: string;
  validTime: string;
  profileRun: string;
  /** Percent of the 12 km grid the satellite sees any cloud over. */
  cloudPct: number;
  /** Percent of the grid whose cloud top is at or below −5 °C. */
  seedableTopPct: number;
  /** Ground with a seedable top, km^2. */
  seedableKm2: number;
  /** Coldest cloud top on the grid, °C. Null when there is no cloud at all. */
  coldestTopC: number | null;
};

/**
 * `cells` is the resampled scene the bands were traced from: coldness at the
 * cloud top on the 12 km grid, `CLEAR` where the satellite sees no cloud. It is
 * kept because the candidate join reads it — see `topField`.
 */
type Scene = { frame: CloudTopFrame; stats: CloudTopStats; cells: Grid };

export class CloudTopService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  /** Replayed scenes, keyed by the S3 key they were built from. */
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();

  async temperature(at?: Date): Promise<CloudTopFrame> {
    return (await this.scene(at)).frame;
  }

  /** The same build's summary. Asking for either warms both. */
  async temperatureStats(at?: Date): Promise<CloudTopStats> {
    return (await this.scene(at)).stats;
  }

  /**
   * The resampled scene the bands were traced from, for the candidate join.
   *
   * Coldness at the cloud top on the 12 km grid — `CLEAR` where the satellite
   * sees nothing, so a single `>= 5` test asks both "is there cloud" and "does
   * its top reach the seeding band". The scan's own time rides along, because a
   * join is only as current as its slowest source and the panel reports it.
   */
  async topField(at?: Date): Promise<{ cells: Grid; validTime: string }> {
    const scene = await this.scene(at);
    return { cells: scene.cells, validTime: scene.frame.validTime };
  }

  private async scene(at?: Date): Promise<Scene> {
    if (at) return this.replay(at);

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
    // The map asks for the frame and the stats at the same moment, and a cold
    // build waits on the HRRR profile. Collapse them onto one.
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
   * A past scene. Keyed by the S3 object rather than the requested time, so
   * neighbouring requests share one build, and cached without a TTL because a
   * scan from last May will not be rescanned.
   */
  private async replay(at: Date): Promise<Scene> {
    const key = await pairedKeyAt(PRODUCT, at, SCENE_TOLERANCE_MS);

    const cached = this.archive.get(key);
    if (cached) return cached;

    const running = this.archiveInflight.get(key);
    if (running) return running;

    const work = this.build(key, at)
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

  private async build(key?: string, at?: Date): Promise<Scene> {
    const sceneKey = key ?? (await latestPairedKey(PRODUCT));
    // The profile is the slow half on a cold run, and it does not depend on the
    // scene, so the two go together rather than in sequence.
    //
    // `at` travels with it: a replayed scene has to be given the temperatures
    // from *that* day's run, or the geometry would be historical and the
    // temperatures painted onto it would be today's.
    const [buffer, column] = await Promise.all([
      download(sceneKey),
      Hrrr.column(ANALYSIS_HOUR, at),
    ]);

    const { grid, pressure } = await this.decode(buffer);
    const values = this.resample(grid, pressure, column);

    const cells: Grid = {
      nx: column.geo.nx,
      ny: column.geo.ny,
      values,
    };

    const validTime = sceneTime(sceneKey);
    const profileRun = column.run.toISOString();

    return {
      frame: {
        type: "FeatureCollection",
        validTime,
        profileRun,
        features: bandFeatures(
          cells,
          column.geo,
          CLOUD_TOP.property,
          CLOUD_TOP.levels
        ),
      },
      stats: summarize(cells, validTime, profileRun),
      cells,
    };
  }

  /**
   * Read the scene: the projection constants, and cloud-top pressure in hPa
   * with clear pixels left as NaN.
   *
   * The scale factor and the fill value come out of the file, like the
   * projection geometry `gridOf` reads — hardcoding them would be the
   * pixel-archaeology version of the mistake this layer exists to undo.
   */
  private async decode(
    buffer: Buffer
  ): Promise<{ grid: AbiGrid; pressure: Float32Array }> {
    return readScene(buffer, (file) => {
      const grid = gridOf(file, "PRES");

      const pres = file.get("PRES");
      const fill = scalar(pres, "_FillValue");
      const scale = scalar(pres, "scale_factor");
      const offset = scalar(pres, "add_offset");

      const raw = pres.value;
      const pressure = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        // The fill value is what makes this layer honest: a clear pixel carries
        // no pressure, so it becomes NaN and contributes nothing downstream.
        pressure[i] = raw[i] === fill ? NaN : raw[i] * scale + offset;
      }

      return { grid, pressure };
    });
  }

  /**
   * Fold the 2 km scene onto the 12 km grid the other layers are contoured on,
   * and convert each cell's pressure to a temperature.
   *
   * Mapped **grid cell → pixel**, not the other way round. The forward
   * geostationary projection is exact arithmetic, so 118k cells each index
   * straight into the image; going pixel-first would mean searching 3.75M
   * pixels for their nearest cell.
   *
   * **A cell is cloudy only if most of its pixels are.** The alternative — any
   * cloudy pixel makes the cell cloudy — would inflate coverage at 12 km and
   * paint solid cloud over scattered cumulus. A majority needs no tuning
   * constant, and scattered cloud under half a 12 km box is not a target a
   * drone is sent to.
   */
  private resample(
    grid: AbiGrid,
    pressure: Float32Array,
    column: Column
  ): Float32Array {
    const { geo } = column;
    const out = new Float32Array(geo.lats.length).fill(CLEAR);
    const half = Math.floor(WINDOW / 2);

    for (let cell = 0; cell < geo.lats.length; cell++) {
      const at = pixelAt(grid, geo.lats[cell], geo.lons[cell]);
      if (!at) continue;
      const [col, row] = at;

      let cloudy = 0;
      let seen = 0;
      let sum = 0;
      for (let dy = -half; dy < WINDOW - half; dy++) {
        const r = row + dy;
        if (r < 0 || r >= grid.ny) continue;
        for (let dx = -half; dx < WINDOW - half; dx++) {
          const c = col + dx;
          if (c < 0 || c >= grid.nx) continue;
          seen++;
          const mb = pressure[r * grid.nx + c];
          if (Number.isNaN(mb)) continue;
          cloudy++;
          sum += mb;
        }
      }

      if (seen === 0 || cloudy * 2 < seen) continue;

      const topC = column.tempAt(cell, sum / cloudy);
      out[cell] = -topC;
    }

    return out;
  }
}

export const Goes = new CloudTopService();

/**
 * The sidebar's numbers, against the same 12 km grid the contours are drawn
 * from so the picture and the figures cannot disagree.
 */
export function summarize(
  grid: Grid,
  validTime: string,
  profileRun: string
): CloudTopStats {
  const floor = CLOUD_TOP.levels[0];
  let cloudy = 0;
  let seedable = 0;
  let coldest = -Infinity;

  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (v === CLEAR) continue;
    cloudy++;
    if (v >= floor) seedable++;
    if (v > coldest) coldest = v;
  }

  const total = grid.values.length;
  return {
    fetchedAt: new Date().toISOString(),
    validTime,
    profileRun,
    cloudPct: Math.round((10000 * cloudy) / total) / 100,
    seedableTopPct: Math.round((10000 * seedable) / total) / 100,
    seedableKm2: seedable * CELL_KM2,
    // Stored negated, reported as the temperature an operator reads.
    coldestTopC: cloudy === 0 ? null : Math.round(-coldest * 10) / 10,
  };
}

export type { Geo };
