/**
 * The candidate field: one layer instead of four an operator intersects by eye.
 *
 * Every other layer here answers one question about the sky. This one asks all
 * of them at once, per 12 km cell, and draws only where every answer is yes:
 * the model has supercooled liquid in the seeding band, the satellite agrees
 * there is cloud whose top reaches that band, the model gives a cloud base low
 * enough that the band is inside the cloud rather than above it, and the radar
 * is not already watching the cell rain itself out.
 *
 * **The join is an array pass, not a geometric operation.** Contouring is the
 * last step of each source's build, so this reads the grids those builds already
 * produced — before they became polygons — and traces one set of contours at the
 * end. Intersecting thousands of rings to recover a per-cell answer each build
 * already had would be slower and less exact.
 *
 * **It exists only at the analysis hour.** Satellites cannot forecast, so a
 * join that leans on an observed cloud top cannot be run at f06. There is no
 * `hour` parameter, and `at` replays the whole join at a past hour instead.
 */

// Services
import { features } from "./contour";
import { Hrrr, SEEDING } from "./forecast";
import { CLEAR, Goes } from "./cloudtop";
import { BLOCK_NO_COVERAGE, Mrms, RAIN_DBZ, blockIndex } from "./radar";
import { CELL_KM2 } from "./grid";
import { BASE_WINDOW_FT, bearing } from "./diagnostics";

// Types
import type { Grid, Geo, ContourFeature } from "./contour";

/**
 * The analysis hour. The candidate map is "right now", and every HRRR input
 * here is a state the analysis holds rather than a flux needing a timestep.
 */
const ANALYSIS_HOUR = 0;

/** Two minutes. Every input has its own cache; this only collapses the join. */
const CACHE_TTL_MS = 2 * 60_000;

/** Replayed hours never change, so a handful are kept keyed by the hour asked for. */
const ARCHIVE_CACHE = 8;

/**
 * The coldest cloud top that still counts as reaching the seeding band, stored
 * the way the cloud-top layer stores it: degrees **below** zero.
 *
 * A top at or colder than −5 °C means the band's warm edge lies at or below the
 * cloud top, which is one half of asking whether the band is inside the cloud.
 * It is read from `SEEDING.warmestC` rather than written as 5, so the layer and
 * the join move together when the band moves.
 */
const TOP_REACHES_BAND = -SEEDING.warmestC;

/**
 * A reported ceiling, in ft MSL — **never a gate**.
 *
 * The drone's design figure. The seeding band's base swings ~9,000 ft across a
 * Texas year, so a band above this in July is correct output rather than a
 * warning condition, and nothing here filters on it. The stats say what share of
 * candidate ground has a band base an aircraft with this ceiling could reach,
 * and the operator judges.
 */
export const CEILING_FT = 18000;

/** The scalar the contours are traced on. */
const CANDIDATE = {
  /**
   * Supercooled liquid water path, g/m², in cells that pass every test.
   *
   * The candidate field **is** the liquid-water field with the other criteria
   * applied, so it carries the same quantity on the same levels. That is what
   * makes the two layers readable against each other: amber with no green over
   * it is liquid the join threw away, and the sidebar says which test threw it.
   */
  property: "seedableSlwPath",
  levels: SEEDING.levels,
} as const;

/** Why a cell holding in-band liquid is not a candidate. */
export type Rejected = {
  /** The model has no cloud base over the cell — nothing to climb into. */
  noCloudBase: number;
  /** The base sits above the band's cold edge: the whole cloud is colder than the band. */
  baseAboveBand: number;
  /** The satellite sees no cloud at all, contradicting the model outright. */
  noCloudSeen: number;
  /** The observed top is warmer than −5 °C, so the band is above the cloud. */
  topTooWarm: number;
  /** Radar is already watching it precipitate. */
  raining: number;
};

export type CandidateFrame = {
  type: "FeatureCollection";
  /** HRRR cycle the model half came from, ISO 8601. */
  run: string;
  /** Analysis valid time, ISO 8601. */
  validTime: string;
  /** Start of the satellite scan the observed half came from. */
  sceneTime: string;
  /** Time of the radar scan that vetoed. */
  radarTime: string;
  features: ContourFeature[];
};

/**
 * What the sidebar reports.
 *
 * Three groups, and they answer different questions. **How much** is the
 * candidate area itself. **What the join removed** is the accounting that makes
 * an empty map explainable — a blank candidate layer over an amber liquid layer
 * is a bug report unless the panel can say which test emptied it. **The
 * attributes** are the convective and steering numbers over the candidate
 * ground; they are reported and nothing gates on them.
 */
export type CandidateStats = {
  run: string;
  validTime: string;
  sceneTime: string;
  radarTime: string;

  /** Percent of the HRRR domain that passes every test. */
  coveragePct: number;
  /** Ground that passes every test, km². */
  candidateKm2: number;
  /** Richest candidate cell, g/m². */
  peak: number;

  /** Ground holding in-band liquid before the join, km² — what it started from. */
  liquidKm2: number;
  /** Ground each test removed, km². These partition `liquidKm2 - candidateKm2`. */
  rejected: Rejected;
  /**
   * Candidate ground no radar covers, km².
   *
   * Not a pass and not a fail. Absence of coverage is not evidence of rain, so
   * it does not veto — but a third of the mosaic's box has no radar over it, and
   * a candidate standing there is unchecked rather than cleared.
   */
  blindKm2: number;

  /** Median cloud base over candidate ground, ft MSL. Null when there is none. */
  medianBaseFt: number | null;
  /** Percent of candidate ground whose base is inside the operational window. */
  windowPct: number;
  /** Median height of the band's warm edge over candidate ground, ft MSL. */
  medianBandBaseFt: number | null;
  /** The ceiling those two are reported against. */
  ceilingFt: number;
  /** Percent of candidate ground whose band base is below that ceiling. */
  reachablePct: number;

  /** Strongest mixed-layer CAPE over candidate ground, J/kg. */
  peakMixedCapeJKg: number;
  /** Strongest vertically integrated liquid over candidate ground, kg/m². */
  peakVilKgM2: number;
  /** Storm motion at the richest candidate cell, knots. */
  stormMotionKt: number;
  /** Bearing that cell is moving toward, degrees. Null when still. */
  stormMotionTowardDeg: number | null;
};

/** Everything the join reads, all on the HRRR 12 km grid except the radar. */
export type Inputs = {
  /** Supercooled liquid water path, g/m². */
  slw: Float32Array;
  /** Cloud base, ft MSL. NaN where the model has no cloud. */
  cloudBaseFt: Float32Array;
  /** Cold edge of the seeding band, ft MSL. NaN where the column never reaches it. */
  bandTopFt: Float32Array;
  /** Cloud-top coldness, °C below zero. `CLEAR` where the satellite sees nothing. */
  topColdnessC: Float32Array;
  /** Reflectivity already sampled onto the HRRR grid, dBZ. */
  dbz: Float32Array;
};

export type Join = {
  /** The scalar to contour: `slw` where every test passes, 0 elsewhere. */
  values: Float32Array;
  /** Cells holding in-band liquid before any test. */
  liquid: number;
  rejected: Rejected;
  /** Candidate cells no radar covers. */
  blind: number;
};

type Scene = { frame: CandidateFrame; stats: CandidateStats };

export class CandidateService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();

  async field(at?: Date): Promise<CandidateFrame> {
    return (await this.scene(at)).frame;
  }

  /** The same build's summary. Asking for either warms both. */
  async fieldStats(at?: Date): Promise<CandidateStats> {
    return (await this.scene(at)).stats;
  }

  private async scene(at?: Date): Promise<Scene> {
    if (at) return this.replay(at);

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
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
   * A past hour, keyed by the hour that was asked for.
   *
   * No TTL — the inputs are archived scans and a run that will not be rerun.
   * The replay page always sends the same string for an hour, so two requests
   * for one hour share a build.
   */
  private async replay(at: Date): Promise<Scene> {
    const key = at.toISOString();

    const cached = this.archive.get(key);
    if (cached) return cached;

    const running = this.archiveInflight.get(key);
    if (running) return running;

    const work = this.build(at)
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
   * Warm all five inputs, then join them.
   *
   * In parallel, and that is the difference between a cold build costing the
   * slowest source and costing their sum. They overlap more than they look:
   * the band edges and the satellite's temperatures come from the same HRRR
   * profile grid, and the service collapses those onto one download.
   */
  private async build(at?: Date): Promise<Scene> {
    const [liquid, base, band, tops, radar] = await Promise.all([
      Hrrr.liquidField(ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("cloudBase", ANALYSIS_HOUR, at),
      Hrrr.bandField(ANALYSIS_HOUR, at),
      Goes.topField(at),
      Mrms.reflectivityField(at),
    ]);

    const run = liquid.run;
    const validTime = new Date(
      run.getTime() + ANALYSIS_HOUR * 3_600_000
    ).toISOString();
    const geo = band.geo;

    // No point in the domain is in the seeding band at any level, so there is
    // no liquid grid to join and nothing can be a candidate.
    if (!liquid.values) {
      return {
        frame: {
          type: "FeatureCollection",
          run: run.toISOString(),
          validTime,
          sceneTime: tops.validTime,
          radarTime: radar.validTime,
          features: [],
        },
        stats: empty(run, validTime, tops.validTime, radar.validTime),
      };
    }

    const joined = join({
      slw: liquid.values,
      cloudBaseFt: base.values!,
      bandTopFt: band.topFt,
      topColdnessC: tops.cells.values,
      dbz: sampleRadar(radar.grid, geo),
    });

    const grid: Grid = { nx: geo.nx, ny: geo.ny, values: joined.values };

    // The convective and steering numbers over the ground that passed. They are
    // read here rather than in `join` because they answer a different question:
    // join decides *whether* a cell is a candidate, this describes the ones that
    // are, and nothing it reads may change the decision.
    const [mixedCape, vil, stormU, stormV] = await Promise.all([
      Hrrr.diagnosticField("mixedCape", ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("vil", ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("stormU", ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("stormV", ANALYSIS_HOUR, at),
    ]);

    return {
      frame: {
        type: "FeatureCollection",
        run: run.toISOString(),
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        features: features(grid, geo, CANDIDATE.property, CANDIDATE.levels),
      },
      stats: summarize(joined, {
        run,
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        cloudBaseFt: base.values!,
        bandBaseFt: band.baseFt,
        mixedCape: mixedCape.values,
        vil: vil.values,
        stormU: stormU.values,
        stormV: stormV.values,
      }),
    };
  }
}

export const Seedability = new CandidateService();

/**
 * Sample the radar mosaic onto the HRRR grid.
 *
 * The mosaic is a regular lat/lon grid and HRRR's is Lambert, so the two arrays
 * do not line up cell for cell and the join cannot assume they do. Both are
 * ~12 km, so taking the block each HRRR cell's centre falls in resamples one
 * grid onto another of the same spacing — no interpolation, and no structure
 * invented (`MEASUREMENTS.md` §3).
 *
 * A cell outside the mosaic's box reads as no coverage, which is what it is.
 */
export function sampleRadar(mosaic: Grid, geo: Geo): Float32Array {
  const out = new Float32Array(geo.lats.length).fill(BLOCK_NO_COVERAGE);
  for (let cell = 0; cell < geo.lats.length; cell++) {
    const k = blockIndex(geo.lats[cell], geo.lons[cell]);
    if (k >= 0) out[cell] = mosaic.values[k];
  }
  return out;
}

/**
 * The join itself: which cells are candidates, and what removed the rest.
 *
 * Pure, and exported for the tests — everything here is arithmetic over five
 * arrays, and the only way to reach it through the service is five network
 * builds and eccodes.
 *
 * **The tests run in a fixed order so the rejection counts partition.** A cell
 * usually fails more than one, and counting each failure separately would
 * report more rejected ground than there was liquid. The order runs from the
 * question asked first — can an aircraft get into this cloud — outward to the
 * disqualifier, matching how the map is layered.
 *
 * **Why the base is compared against the band's *cold* edge.** The test is
 * whether the cloud and the seeding band overlap at all. The cloud spans base
 * to top; the band spans its warm edge (−5 °C, lower) to its cold edge (−18 °C,
 * higher). Two intervals overlap when each starts below where the other ends, so
 * the two halves are `cloud top > band base` — which is exactly the satellite's
 * "top colder than −5 °C" — and `cloud base < band top`. Comparing the base
 * against the *warm* edge instead would throw away a cloud whose base is already
 * colder than −5 °C, which is a cloud with the band inside it from the bottom
 * up.
 */
export function join(inputs: Inputs): Join {
  const { slw, cloudBaseFt, bandTopFt, topColdnessC, dbz } = inputs;
  const floor = SEEDING.levels[0];

  const values = new Float32Array(slw.length);
  const rejected: Rejected = {
    noCloudBase: 0,
    baseAboveBand: 0,
    noCloudSeen: 0,
    topTooWarm: 0,
    raining: 0,
  };
  let liquid = 0;
  let blind = 0;

  for (let i = 0; i < slw.length; i++) {
    // Nothing to seed here, so nothing to reject either.
    if (!(slw[i] >= floor)) continue;
    liquid++;

    const base = cloudBaseFt[i];
    if (Number.isNaN(base)) {
      rejected.noCloudBase++;
      continue;
    }

    // A NaN band top means the column never reaches −18 °C, so the band has no
    // cold edge here and the comparison cannot be made. `>=` is false for NaN,
    // which lands in this branch — the honest answer, since a cell whose band
    // is unbounded above is not one we can say encloses the cloud.
    if (!(base < bandTopFt[i])) {
      rejected.baseAboveBand++;
      continue;
    }

    // CLEAR sits far below every band edge, so one comparison would catch both
    // of the next two. They are split because they mean opposite things: no
    // cloud at all contradicts the model, and a warm top agrees with it about
    // the cloud while placing the band above it.
    if (topColdnessC[i] === CLEAR) {
      rejected.noCloudSeen++;
      continue;
    }
    if (topColdnessC[i] < TOP_REACHES_BAND) {
      rejected.topTooWarm++;
      continue;
    }

    // No coverage is not a report of clear air, so it cannot veto — but it
    // cannot clear the cell either, and the stats say how much rides on it.
    const reflectivity = dbz[i];
    if (reflectivity !== BLOCK_NO_COVERAGE && reflectivity >= RAIN_DBZ) {
      rejected.raining++;
      continue;
    }
    if (reflectivity === BLOCK_NO_COVERAGE) blind++;

    values[i] = slw[i];
  }

  return { values, liquid, rejected, blind };
}

type Context = {
  run: Date;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  cloudBaseFt: Float32Array;
  bandBaseFt: Float32Array;
  mixedCape: Float32Array | undefined;
  vil: Float32Array | undefined;
  stormU: Float32Array | undefined;
  stormV: Float32Array | undefined;
};

/**
 * Fold the join into the numbers the sidebar reports, against the same grid the
 * contours are traced from so the picture and the figures cannot disagree.
 *
 * Every attribute is read **over candidate ground only**. A domain-wide CAPE
 * peak would be a number about a thunderstorm somewhere else.
 */
export function summarize(joined: Join, context: Context): CandidateStats {
  const { values, liquid, rejected, blind } = joined;
  const [low, high] = BASE_WINDOW_FT;

  const bases: number[] = [];
  const bandBases: number[] = [];
  let candidates = 0;
  let inWindow = 0;
  let reachable = 0;
  let peak = 0;
  let peakCell = -1;
  let peakCape = 0;
  let peakVil = 0;

  for (let i = 0; i < values.length; i++) {
    if (values[i] <= 0) continue;
    candidates++;

    if (values[i] > peak) {
      peak = values[i];
      peakCell = i;
    }

    const base = context.cloudBaseFt[i];
    if (!Number.isNaN(base)) {
      bases.push(base);
      if (base >= low && base < high) inWindow++;
    }

    const bandBase = context.bandBaseFt[i];
    if (!Number.isNaN(bandBase)) {
      bandBases.push(bandBase);
      if (bandBase < CEILING_FT) reachable++;
    }

    const cape = context.mixedCape?.[i] ?? 0;
    if (cape > peakCape) peakCape = cape;
    const vil = context.vil?.[i] ?? 0;
    if (vil > peakVil) peakVil = vil;
  }

  const u = peakCell >= 0 ? (context.stormU?.[peakCell] ?? 0) : 0;
  const v = peakCell >= 0 ? (context.stormV?.[peakCell] ?? 0) : 0;
  const speed = Math.round(Math.hypot(u, v) * 1.94384);

  const total = values.length;
  const pct = (part: number, whole: number) =>
    whole === 0 ? 0 : Math.round((10000 * part) / whole) / 100;

  return {
    run: context.run.toISOString(),
    validTime: context.validTime,
    sceneTime: context.sceneTime,
    radarTime: context.radarTime,

    coveragePct: pct(candidates, total),
    candidateKm2: candidates * CELL_KM2,
    peak: Math.round(peak),

    liquidKm2: liquid * CELL_KM2,
    rejected: {
      noCloudBase: rejected.noCloudBase * CELL_KM2,
      baseAboveBand: rejected.baseAboveBand * CELL_KM2,
      noCloudSeen: rejected.noCloudSeen * CELL_KM2,
      topTooWarm: rejected.topTooWarm * CELL_KM2,
      raining: rejected.raining * CELL_KM2,
    },
    blindKm2: blind * CELL_KM2,

    medianBaseFt: median(bases),
    windowPct: pct(inWindow, candidates),
    medianBandBaseFt: median(bandBases),
    ceilingFt: CEILING_FT,
    reachablePct: pct(reachable, candidates),

    peakMixedCapeJKg: Math.round(peakCape),
    peakVilKgM2: Math.round(peakVil * 10) / 10,
    stormMotionKt: speed,
    // atan2(0, 0) is 0, which would print "toward north" for still air.
    stormMotionTowardDeg: speed === 0 ? null : bearing(u, v),
  };
}

/** Sorts a copy — the caller's array is read again for other figures. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.floor((sorted.length - 1) / 2)]);
}

/** The domain holds no seeding band at all, so nothing can be a candidate. */
function empty(
  run: Date,
  validTime: string,
  sceneTime: string,
  radarTime: string
): CandidateStats {
  return {
    run: run.toISOString(),
    validTime,
    sceneTime,
    radarTime,
    coveragePct: 0,
    candidateKm2: 0,
    peak: 0,
    liquidKm2: 0,
    rejected: {
      noCloudBase: 0,
      baseAboveBand: 0,
      noCloudSeen: 0,
      topTooWarm: 0,
      raining: 0,
    },
    blindKm2: 0,
    medianBaseFt: null,
    windowPct: 0,
    medianBandBaseFt: null,
    ceilingFt: CEILING_FT,
    reachablePct: 0,
    peakMixedCapeJKg: 0,
    peakVilKgM2: 0,
    stormMotionKt: 0,
    stormMotionTowardDeg: null,
  };
}
