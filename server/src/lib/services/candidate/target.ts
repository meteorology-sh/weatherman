/**
 * The seeding opportunity: a workable cloud base next to a storm whose echo
 * reaches past freezing.
 *
 * Three tests on one 3 km cell — a cloud base under 18,000 ft MSL, a measured
 * 18 dBZ echo top at or above the freezing level nearby, and rain nearby. Not
 * a quiet supercooled-liquid column under a cold top: this does not gate on
 * modeled liquid in the seeding band, and it does not cross a cell off for
 * rain.
 *
 * **The base is the one the cloud-base layer draws** — HRRR's own where the
 * model has a cloud, the convective condensation level where it does not, under
 * the same 18,000 ft MSL bound. So the base behind a green cell here is the
 * base painted over it there, and both come from `cloudbase.ts`.
 *
 * Pure, and tested on hand-built grids, for the same reason `join.ts` is:
 * reaching this through the service is five network builds and eccodes.
 *
 * **What this still cannot ask.** Growing / first half-lifetime needs tracked
 * objects. Inflow in ft/min is a pilot call. The upwind flank is a geometry
 * this 1-cell neighborhood is not. Severe-weather watches are not ingested.
 * Those are the remaining miss if 2025 still disagrees, not a looser window.
 *
 * **The neighborhood is one HRRR cell.** 8-connected, no wrap. That is the
 * grid's own spacing — South Texas's typical release sits 1.4 km outside 20 dBZ
 * — not a radius chosen to swallow the 23 km cloud-top miss.
 */

// Services
import { BASE_CEILING_FT } from "./cloudbase";
import { BLOCK_NO_COVERAGE, RAIN_DBZ } from "../mrms/radar";
import { CELL_KM2, inBox } from "../shared/grid";
import type { LonLatBox } from "../shared/grid";

// Types
import type { Geo } from "../shared/contour";

/**
 * Why a column is not a Texas target.
 *
 * The counts partition: a cell is charged to the first test it fails, in the
 * order below, so rejected ground cannot add up to more than the cells asked.
 */
export type TargetRejected = {
  /** Neither the model nor the CCL gives this column a cloud base. */
  noCloudBase: number;
  /** The base sits at or above 18,000 ft MSL. */
  baseTooHigh: number;
  /** No column in the neighborhood has a freezing level. */
  noFreezingLevel: number;
  /**
   * Neither payload has anything to work with: no column in the neighborhood
   * has an echo top at or above freezing, and this column's base is already at
   * or above the freezing level, so there is no warm layer either.
   */
  noIceNoWarmLayer: number;
  /** No column in the neighborhood has measured echo at 20 dBZ. */
  noStorm: number;
};

export type TargetVerdict = "target" | keyof TargetRejected;

/**
 * Which flare the column supports.
 *
 * Silver iodide needs cloud that reaches the freezing level; a salt flare
 * needs a warm layer under it and does not care what the top did. The two are
 * independent over a season — a deep warm layer says nothing about whether the
 * top glaciated — so this is reported rather than folded into the verdict, and
 * a cell can support both. `docs/HYGROSCOPIC.md` is the reasoning.
 */
export type SeedingPayload = "ice" | "salt" | "both";

export type TargetInputs = {
  /** HRRR's own cloud base, ft MSL. NaN where the model has no cloud. */
  cloudBaseFt: Float32Array;
  /** Convective condensation level, ft MSL. The base where HRRR has none. */
  cclFt: Float32Array;
  /** Terrain, ft MSL. Carried for the AGL readout, not for any test. */
  surfaceFt: Float32Array;
  /** 0 °C height, ft MSL. NaN where the column never crosses freezing. */
  freezingFt: Float32Array;
  /** Measured 18 dBZ echo top, ft MSL. NaN where there is no 18 dBZ. */
  echoTopFt: Float32Array;
  /** Reflectivity already sampled onto this grid, dBZ. */
  dbz: Float32Array;
  nx: number;
  ny: number;
};

export type TargetJoin = {
  /** 1 where every test passes, 0 elsewhere. A mask, not a score. */
  values: Float32Array;
  rejected: TargetRejected;
  /** Cells that passed. */
  target: number;
};

/**
 * 1 where the Texas tests pass. NaN everywhere else, so the contourer
 * draws nothing there — the same shape as the cloud-base fill and
 * echo past freezing.
 */
export function flyValues(joined: TargetJoin): Float32Array {
  const out = new Float32Array(joined.values.length);
  out.fill(Number.NaN);
  for (let i = 0; i < joined.values.length; i++) {
    if (joined.values[i] > 0) out[i] = 1;
  }
  return out;
}

/**
 * The target join read over one cell.
 *
 * The seeding-opportunity readout stays on `CandidatePoint.verdict`. These
 * four are the Texas question asked of the same 3 km square.
 */
export type TargetPoint = {
  target: TargetVerdict;
  /**
   * Which flare this column supports: ice, salt, or both. Null where it
   * supports neither.
   */
  payload: SeedingPayload | null;
  /**
   * Base to freezing level, ft — the layer a salt flare works in. Null where
   * either height is missing, and negative is not reported: a base at or above
   * the freezing level has no warm layer at all.
   */
  warmCloudDepthFt: number | null;
  /** Cloud base above the terrain, ft. Null where there is no base. */
  cloudBaseAglFt: number | null;
  /** Freezing level, ft MSL. Null where the column never crosses 0 °C. */
  freezingFt: number | null;
  /** Measured 18 dBZ echo top, ft MSL. Null where there is no 18 dBZ. */
  echoTopFt: number | null;
};

export type TargetStats = {
  run: string;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  /** Percent of the counted ground that passed every test. */
  coveragePct: number;
  /** Ground that passed, km². */
  targetKm2: number;
  /** Ground that was asked, km² — the box, or the whole domain. */
  boxKm2: number;
  /** Ground each test removed, km². These partition `boxKm2 - targetKm2`. */
  rejected: TargetRejected;
};

type TargetContext = {
  run: Date;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  geo: Geo;
  box?: LonLatBox;
};

/**
 * The highest workable cloud base, ft MSL.
 *
 * The same bound the cloud-base layer draws to, read from the same constant, so
 * a cell this layer calls seedable is a cell that layer paints a base for.
 *
 * **There is no lower bound.** A low base is still cloud worth working. A
 * program with a minimum altitude of its own applies it in its own operations;
 * it is not a property of the cloud and is not gated here.
 */
const CEILING = BASE_CEILING_FT;

/**
 * 8-connected neighborhood including the cell itself. No wrap: a cell on
 * the domain edge has fewer neighbors, it does not see the opposite side.
 */
function neighborhood(i: number, nx: number, ny: number): number[] {
  const x = i % nx;
  const y = (i - x) / nx;
  const out: number[] = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const xx = x + dx;
      const yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= nx || yy >= ny) continue;
      out.push(yy * nx + xx);
    }
  }
  return out;
}

/**
 * The base this layer tests, ft MSL: HRRR's own where the model has one, the
 * convective condensation level where it does not.
 *
 * The same two heights, in the same order of preference, that the cloud-base
 * layer merges — so the base behind a seeding-opportunity cell is the base that
 * layer draws over it. NaN only where neither is available.
 */
export function workableBaseFt(inputs: TargetInputs, i: number): number {
  const modeled = inputs.cloudBaseFt[i];
  return Number.isFinite(modeled) ? modeled : inputs.cclFt[i];
}

/**
 * The whole decision for one cell.
 *
 * The loop and the point readout both go through here, so a target on the
 * map and the answer in the panel cannot disagree about a cell.
 */
export function verdict(inputs: TargetInputs, i: number): TargetVerdict {
  // One height test on one workable base: HRRR's own where it has one, the CCL
  // where it does not. The base test used to be skipped wherever the model grew
  // no cloud — which is most cells under convection — so a column with no
  // modeled base passed it by default. It is now answerable almost everywhere,
  // so it is asked rather than waived.
  const base = workableBaseFt(inputs, i);
  if (!Number.isFinite(base)) return "noCloudBase";
  if (!(base < CEILING)) return "baseTooHigh";

  const around = neighborhood(i, inputs.nx, inputs.ny);

  let sawFreezing = false;
  let pastFreezing = false;
  let storm = false;
  for (const k of around) {
    const freezing = inputs.freezingFt[k];
    if (Number.isFinite(freezing)) {
      sawFreezing = true;
      const top = inputs.echoTopFt[k];
      if (Number.isFinite(top) && top >= freezing) pastFreezing = true;
    }
    const reflectivity = inputs.dbz[k];
    if (reflectivity !== BLOCK_NO_COVERAGE && reflectivity >= RAIN_DBZ) {
      storm = true;
    }
  }

  if (!sawFreezing) return "noFreezingLevel";
  if (!storm) return "noStorm";
  // Ice needs a top that reached freezing. Salt needs only a warm layer, which
  // is what a base below the freezing level is. A cell passes on either, and
  // fails only when the cloud offers neither.
  if (!pastFreezing && !hasWarmLayer(inputs, i)) return "noIceNoWarmLayer";
  return "target";
}

/**
 * Is there a warm layer between the base and the freezing level?
 *
 * A base below the freezing level is a base warmer than 0 °C, which is the
 * whole condition — the warm-rain process a salt flare speeds up runs between
 * those two heights. Reading it as two heights rather than as a temperature
 * keeps it on the fields the join already carries, and it is a physical
 * statement rather than a tuned depth: how much warm layer is enough is a
 * question for the operator, and `warmCloudDepthFt` on the point is the number
 * to answer it with.
 */
function hasWarmLayer(inputs: TargetInputs, i: number): boolean {
  const base = workableBaseFt(inputs, i);
  const freezing = inputs.freezingFt[i];
  return Number.isFinite(base) && Number.isFinite(freezing) && base < freezing;
}

/**
 * Which payload this cell supports, whether or not the cell is a target.
 *
 * The ice half is the neighborhood test the fill itself runs, so a cell the
 * map lights for ice reads "ice" here. Null where the cloud offers neither,
 * which is the same condition as `noIceNoWarmLayer`.
 */
export function payloadAt(
  inputs: TargetInputs,
  i: number
): SeedingPayload | null {
  const salt = hasWarmLayer(inputs, i);
  let ice = false;
  for (const k of neighborhood(i, inputs.nx, inputs.ny)) {
    const freezing = inputs.freezingFt[k];
    const top = inputs.echoTopFt[k];
    if (Number.isFinite(freezing) && Number.isFinite(top) && top >= freezing) {
      ice = true;
      break;
    }
  }
  if (ice && salt) return "both";
  if (ice) return "ice";
  if (salt) return "salt";
  return null;
}

/** Which cells are targets, and what removed the rest. */
export function join(inputs: TargetInputs): TargetJoin {
  const values = new Float32Array(inputs.cloudBaseFt.length);
  const rejected: TargetRejected = {
    noCloudBase: 0,
    baseTooHigh: 0,
    noFreezingLevel: 0,
    noIceNoWarmLayer: 0,
    noStorm: 0,
  };
  let target = 0;

  for (let i = 0; i < values.length; i++) {
    const answer = verdict(inputs, i);
    if (answer === "target") {
      values[i] = 1;
      target++;
    } else {
      rejected[answer]++;
    }
  }

  return { values, rejected, target };
}

/** The four Texas readings over one cell. */
export function readTarget(inputs: TargetInputs, i: number): TargetPoint {
  const base = workableBaseFt(inputs, i);
  const surface = inputs.surfaceFt[i];
  const freezing = inputs.freezingFt[i];
  const echoTop = inputs.echoTopFt[i];

  const warm =
    Number.isFinite(base) && Number.isFinite(freezing) && base < freezing
      ? Math.round(freezing - base)
      : null;

  return {
    target: verdict(inputs, i),
    payload: payloadAt(inputs, i),
    warmCloudDepthFt: warm,
    // Above the ground, off whichever height answered. Null only where neither
    // did, which is "this column has no cloud base" rather than a missing read.
    cloudBaseAglFt:
      !Number.isFinite(base) || !Number.isFinite(surface)
        ? null
        : Math.round(base - surface),
    freezingFt: Number.isNaN(freezing) ? null : Math.round(freezing),
    echoTopFt: Number.isNaN(echoTop) ? null : Math.round(echoTop),
  };
}

/**
 * Fold the join into the numbers eval needs: how much of the asked ground
 * passed, and what removed the rest.
 *
 * The join itself always runs on the full domain so a cell just inside a box
 * can still see a neighbor just outside it. Counting is what the box limits.
 * Rejections inside a box are re-charged from `verdict`, because the join's
 * own counts include cells the box did not ask about.
 */
export function summarize(
  inputs: TargetInputs,
  joined: TargetJoin,
  context: TargetContext
): TargetStats {
  const { geo, box } = context;
  const inAsked = (i: number) => !box || inBox(geo.lats[i], geo.lons[i], box);

  const rejected: TargetRejected = {
    noCloudBase: 0,
    baseTooHigh: 0,
    noFreezingLevel: 0,
    noIceNoWarmLayer: 0,
    noStorm: 0,
  };
  let asked = 0;
  let passed = 0;

  for (let i = 0; i < joined.values.length; i++) {
    if (!inAsked(i)) continue;
    asked++;
    if (joined.values[i] > 0) {
      passed++;
      continue;
    }
    const answer = verdict(inputs, i);
    if (answer !== "target") rejected[answer]++;
  }

  const pct = (part: number, whole: number) =>
    whole === 0 ? 0 : Math.round((10000 * part) / whole) / 100;

  return {
    run: context.run.toISOString(),
    validTime: context.validTime,
    sceneTime: context.sceneTime,
    radarTime: context.radarTime,
    coveragePct: pct(passed, asked),
    targetKm2: passed * CELL_KM2,
    boxKm2: asked * CELL_KM2,
    rejected: {
      noCloudBase: rejected.noCloudBase * CELL_KM2,
      baseTooHigh: rejected.baseTooHigh * CELL_KM2,
      noFreezingLevel: rejected.noFreezingLevel * CELL_KM2,
      noIceNoWarmLayer: rejected.noIceNoWarmLayer * CELL_KM2,
      noStorm: rejected.noStorm * CELL_KM2,
    },
  };
}
