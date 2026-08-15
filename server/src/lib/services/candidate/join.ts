/**
 * The join itself: which cells are candidates, what removed the rest, and what
 * the sidebar reports about the ground that survived.
 *
 * **Pure arithmetic over five arrays**, and that is the point of keeping it out
 * of the service. Reaching this code through `field.ts` means five network
 * builds and eccodes; here it is driven by hand-built grids, which is where the
 * reasoning that decides what an operator flies to can actually be tested.
 *
 * The service upstream fetches the arrays and contours the result. Nothing in
 * this file knows where a number came from.
 */

// Services
import { SEEDING } from "../hrrr/slw";
import { CLEAR } from "../goes/cloudtop";
import {
  BLOCK_NO_COVERAGE,
  BLOCK_NO_ECHO,
  RAIN_DBZ,
  blockIndex,
} from "../mrms/radar";
import { CELL_KM2 } from "../shared/grid";
import { BASE_WINDOW_FT, bearing } from "../hrrr/diagnostics";
import { CEILING_FT } from "../shared/aircraft";

// Types
import type { Grid, Geo } from "../shared/contour";

/**
 * The coldest cloud top that still counts as reaching the seeding band, stored
 * the way the cloud-top layer stores it: degrees **below** zero.
 *
 * A top at or colder than −5 °C means the band's warm edge lies at or below the
 * cloud top, which is one half of asking whether the band is inside the cloud.
 * It is read from `SEEDING.warmestC` rather than written as 5, so the layer and
 * the join move together when the band moves.
 */
export const TOP_REACHES_BAND = -SEEDING.warmestC;

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

/**
 * What the join decided about one cell: it is a candidate, there was nothing to
 * seed in it, or it is the first test it failed.
 */
export type Verdict = "candidate" | "noLiquid" | keyof Rejected;

/**
 * The join read over one clicked cell — what the cloud there is doing, when it
 * was measured and where the cell is.
 *
 * The same five numbers the join decides on, reported rather than counted, so
 * an operator can see *this* cloud instead of a figure about the whole country.
 * Every one of them is nullable, and the nulls mean different things: no cloud
 * base is the model saying there is no cloud, no cloud top is the satellite
 * saying it sees clear sky, and no reflectivity is either a quiet radar or no
 * radar at all — `radarCovered` separates those two.
 */
export type CandidatePoint = {
  run: string;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  /** The 12 km cell sampled — not the click, which is finer than the grid. */
  lat: number;
  lon: number;
  verdict: Verdict;
  /** Supercooled liquid water path in the seeding band over this cell, g/m². */
  slwGM2: number;
  /** Cloud base, ft MSL. Null where the model has no cloud over the cell. */
  cloudBaseFt: number | null;
  /** Observed cloud-top temperature, °C. Null where the satellite sees no cloud. */
  cloudTopC: number | null;
  /** Measured reflectivity, dBZ. Null where the radars see no echo, or nothing. */
  dbz: number | null;
  /** Is any radar looking at this cell at all? */
  radarCovered: boolean;
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
  const { slw, dbz } = inputs;

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
    const answer = verdict(inputs, i);
    // Nothing to seed here, so nothing to reject either.
    if (answer === "noLiquid") continue;
    liquid++;

    if (answer !== "candidate") {
      rejected[answer]++;
      continue;
    }

    // No coverage is not a report of clear air, so it cannot veto — but it
    // cannot clear the cell either, and the stats say how much rides on it.
    if (dbz[i] === BLOCK_NO_COVERAGE) blind++;

    values[i] = slw[i];
  }

  return { values, liquid, rejected, blind };
}

/**
 * The whole decision for one cell: a candidate, nothing to seed, or the first
 * test it failed.
 *
 * The loop above and the clicked-point readout both go through here, so the
 * green on the map and the answer in the panel cannot disagree about a cell.
 */
export function verdict(inputs: Inputs, i: number): Verdict {
  const { slw, cloudBaseFt, bandTopFt, topColdnessC, dbz } = inputs;

  if (!(slw[i] >= SEEDING.levels[0])) return "noLiquid";

  const base = cloudBaseFt[i];
  if (Number.isNaN(base)) return "noCloudBase";

  // A NaN band top means the column never reaches −18 °C, so the band has no
  // cold edge here and the comparison cannot be made. `>=` is false for NaN,
  // which lands in this branch — the honest answer, since a cell whose band
  // is unbounded above is not one we can say encloses the cloud.
  if (!(base < bandTopFt[i])) return "baseAboveBand";

  // CLEAR sits far below every band edge, so one comparison would catch both
  // of the next two. They are split because they mean opposite things: no
  // cloud at all contradicts the model, and a warm top agrees with it about
  // the cloud while placing the band above it.
  if (topColdnessC[i] === CLEAR) return "noCloudSeen";
  if (topColdnessC[i] < TOP_REACHES_BAND) return "topTooWarm";

  // Rain the radar can see disqualifies; ground no radar covers does not, and
  // the point readout says which of the two this cell is.
  const reflectivity = dbz[i];
  if (reflectivity !== BLOCK_NO_COVERAGE && reflectivity >= RAIN_DBZ) {
    return "raining";
  }

  return "candidate";
}

/** The cell a point readout is about, and the scans it was read from. */
export type Where = {
  run: string;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  lat: number;
  lon: number;
};

/**
 * Read the join's inputs over one cell.
 *
 * Pure, like `join` above and for the same reason: this is the answer an
 * operator acts on, and reaching it through the service costs five network
 * builds. The sentinels are turned back into nulls here — `CLEAR` and
 * `BLOCK_NO_COVERAGE` are both −999, which is a plausible-looking number to
 * print and a lie in every unit on this readout.
 */
export function readPoint(
  inputs: Inputs,
  cell: number,
  where: Where
): CandidatePoint {
  const coldness = inputs.topColdnessC[cell];
  const reflectivity = inputs.dbz[cell];
  const base = inputs.cloudBaseFt[cell];

  return {
    ...where,
    verdict: verdict(inputs, cell),
    slwGM2: Math.round(inputs.slw[cell]),
    cloudBaseFt: Number.isNaN(base) ? null : Math.round(base),
    // Stored as degrees below zero, which is the cloud-top layer's convention
    // and nobody else's.
    cloudTopC: coldness === CLEAR ? null : -Math.round(coldness),
    // A covered block with no echo reads as clear air, so it has no dBZ to
    // report either — the difference from an uncovered one is `radarCovered`.
    dbz:
      reflectivity === BLOCK_NO_COVERAGE || reflectivity === BLOCK_NO_ECHO
        ? null
        : Math.round(reflectivity),
    radarCovered: reflectivity !== BLOCK_NO_COVERAGE,
  };
}

/** The domain holds no seeding band at all, so this cell holds nothing to seed. */
export function emptyPoint(where: Where): CandidatePoint {
  return {
    ...where,
    verdict: "noLiquid",
    slwGM2: 0,
    cloudBaseFt: null,
    cloudTopC: null,
    dbz: null,
    radarCovered: false,
  };
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
export function emptyStats(
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
