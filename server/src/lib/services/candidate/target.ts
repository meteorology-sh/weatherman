/**
 * The Texas-target join: a cloud-base column next to a storm, not a quiet
 * supercooled-liquid column under a cold top.
 *
 * Texas programmes select convective cloud with a base in the 4,000–12,000 ft
 * window, depth past the freezing level, and a raining cell to work the flank
 * of. They do not gate on modelled liquid in the seeding band, and they do not
 * cross a cell off for rain. That arithmetic lives here, on the same grids the
 * seeding-opportunity join already reads, plus terrain, the freezing level and
 * the measured 18 dBZ echo top the map draws.
 *
 * Pure, and tested on hand-built grids, for the same reason `join.ts` is:
 * reaching this through the service is five network builds and eccodes.
 *
 * **What this still cannot ask.** Growing / first half-lifetime needs tracked
 * objects. Inflow in ft/min is a pilot call. The upwind flank is a geometry
 * this 1-cell neighbourhood is not. Severe-weather watches are not ingested.
 * Those are the remaining miss if 2025 still disagrees, not a looser window.
 *
 * **The neighbourhood is one HRRR cell.** 8-connected, no wrap. That is the
 * grid's own spacing — South Texas's typical release sits 1.4 km outside 20 dBZ
 * — not a radius chosen to swallow the 23 km cloud-top miss.
 */

// Services
import { CEILING_FT } from "../shared/aircraft";
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
  /** The model has no cloud base — nothing to climb into. */
  noCloudBase: number;
  /** Base sits above the aircraft's service ceiling — it cannot be reached. */
  baseAboveCeiling: number;
  /** No column in the neighbourhood has a freezing level. */
  noFreezingLevel: number;
  /** No column in the neighbourhood has echo top at or above freezing. */
  topBelowFreezing: number;
  /** No column in the neighbourhood has measured echo at 20 dBZ. */
  noStorm: number;
};

export type TargetVerdict = "target" | keyof TargetRejected;

export type TargetInputs = {
  /** Cloud base, ft MSL. NaN where the model has no cloud. */
  cloudBaseFt: Float32Array;
  /** Terrain, ft MSL. Reported on a click; the ceiling test does not use it. */
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
 * draws nothing there — the same shape as the Comptroller window and
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
 * The only height test on a cell: is the cloud base under the aircraft's
 * service ceiling.
 *
 * **There is no lower bound.** A low base is still cloud an aircraft can climb
 * into, so subtracting one would reject ground that is flyable. The ceiling is
 * a property of the airframe and is read in ft MSL, which is also what removes
 * the MSL-against-AGL disagreement a fixed window has over high terrain.
 *
 * A programme with a minimum altitude of its own applies it in its own
 * operations; it is not a property of the cloud and is not gated here.
 */
const CEILING = CEILING_FT;

/**
 * 8-connected neighbourhood including the cell itself. No wrap: a cell on
 * the domain edge has fewer neighbours, it does not see the opposite side.
 */
function neighbourhood(i: number, nx: number, ny: number): number[] {
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
 * The whole decision for one cell.
 *
 * The loop and the point readout both go through here, so a target on the
 * map and the answer in the panel cannot disagree about a cell.
 */
export function verdict(inputs: TargetInputs, i: number): TargetVerdict {
  const base = inputs.cloudBaseFt[i];
  if (Number.isNaN(base)) return "noCloudBase";

  if (!(base < CEILING)) return "baseAboveCeiling";

  const around = neighbourhood(i, inputs.nx, inputs.ny);

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
  if (!pastFreezing) return "topBelowFreezing";
  if (!storm) return "noStorm";
  return "target";
}

/** Which cells are targets, and what removed the rest. */
export function join(inputs: TargetInputs): TargetJoin {
  const values = new Float32Array(inputs.cloudBaseFt.length);
  const rejected: TargetRejected = {
    noCloudBase: 0,
    baseAboveCeiling: 0,
    noFreezingLevel: 0,
    topBelowFreezing: 0,
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
  const base = inputs.cloudBaseFt[i];
  const surface = inputs.surfaceFt[i];
  const freezing = inputs.freezingFt[i];
  const echoTop = inputs.echoTopFt[i];

  return {
    target: verdict(inputs, i),
    cloudBaseAglFt:
      Number.isNaN(base) || Number.isNaN(surface)
        ? null
        : Math.round(base - surface),
    freezingFt: Number.isNaN(freezing) ? null : Math.round(freezing),
    echoTopFt: Number.isNaN(echoTop) ? null : Math.round(echoTop),
  };
}

export function emptyTarget(): TargetPoint {
  return {
    target: "noCloudBase",
    cloudBaseAglFt: null,
    freezingFt: null,
    echoTopFt: null,
  };
}

/**
 * Fold the join into the numbers eval needs: how much of the asked ground
 * passed, and what removed the rest.
 *
 * The join itself always runs on the full domain so a cell just inside a box
 * can still see a neighbour just outside it. Counting is what the box limits.
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
    baseAboveCeiling: 0,
    noFreezingLevel: 0,
    topBelowFreezing: 0,
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
      baseAboveCeiling: rejected.baseAboveCeiling * CELL_KM2,
      noFreezingLevel: rejected.noFreezingLevel * CELL_KM2,
      topBelowFreezing: rejected.topBelowFreezing * CELL_KM2,
      noStorm: rejected.noStorm * CELL_KM2,
    },
  };
}
