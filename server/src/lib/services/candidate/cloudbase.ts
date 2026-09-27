/**
 * Cloud base as one layer: the model's own base where it has one, the
 * convective condensation level where it does not, drawn wherever a measured
 * echo top stands over it.
 *
 * **Why the two are merged.** HRRR reports `HGT:cloud base` only where it has
 * modeled a cloud, and under exactly the convection this product exists for it
 * frequently has none — the map went blank where a storm was. The CCL is
 * defined over every column, so it fills those cells with a base height rather
 * than a hole. Both are model output; neither is measured. That is stated
 * rather than hidden, and the point readout says which of the two answered.
 *
 * **The echo top is what makes it a cloud.** A CCL exists over dry ground, so
 * a fill drawn on the merged height alone would paint clear sky. The measured
 * 18 dBZ echo top is the cloud: a cell is drawn only where an echo top sits
 * above the base, which is the statement "there is a column of cloud from this
 * height upward" and is a measurement rather than a second model opinion. It
 * gates the model's own base for the same reason — HRRR reports a base for any
 * deck, including thin high cloud that no radar sees, and that is not the
 * convective base this layer is about.
 *
 * **No height is cut.** The ramp's last band is open above 18,000 ft MSL and
 * still drawn, because a base too high to work and no cloud at all are
 * different answers. Whether a base can be flown is a judgement, and it belongs
 * to the seeding-opportunity layer that makes it — this one reports the height
 * it measured. Read in MSL because that is the datum the height itself is in.
 *
 * Pure over arrays, like `join.ts` and `target.ts`, and tested on hand-built
 * grids for the same reason.
 */

// Services
import { CELL_KM2, inBox } from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import { bandFeatures } from "../shared/contour";

// Types
import type { ContourFeature, Geo, Grid, RingStyle } from "../shared/contour";

/**
 * The highest workable cloud base, ft MSL.
 *
 * **A judgement, not a cutoff.** It decides fly / don't fly in `target.ts`, and
 * on this layer it is only the edge where the ramp opens: a base above it is
 * still measured, still real, and still drawn. Cutting it would delete data to
 * express an opinion the seeding-opportunity layer already expresses.
 */
export const BASE_CEILING_FT = 18000;

/**
 * Which of the two heights answered for a cell.
 *
 * The distinction is reported and never drawn. Both are model output and the
 * fill is one ramp; splitting the colour would claim a difference in kind
 * between them that the numbers do not support.
 */
export type BaseSource = "model" | "ccl";

export type MergedBaseInputs = {
  /** HRRR `HGT:cloud base`, ft MSL. NaN where the model has no cloud. */
  cloudBaseFt: Float32Array;
  /** Convective condensation level, ft MSL. NaN where the column never saturates. */
  cclFt: Float32Array;
  /** Measured 18 dBZ echo top, ft MSL. NaN where there is no 18 dBZ. */
  echoTopFt: Float32Array;
};

/**
 * The merged height over one cell, and where it came from.
 *
 * Null where the layer draws nothing, and the two ways that happens are not
 * distinguished here: no echo top over the cell, or neither height available.
 * Height alone never rules a cell out — see `BASE_CEILING_FT`.
 */
export function mergedBaseAt(
  inputs: MergedBaseInputs,
  i: number
): { baseFt: number | null; source: BaseSource | null } {
  const modeled = inputs.cloudBaseFt[i];
  const modelHasBase = Number.isFinite(modeled);
  const base = modelHasBase ? modeled : inputs.cclFt[i];
  if (!Number.isFinite(base)) return { baseFt: null, source: null };

  // Measured cloud, and the top has to be above the base for the pair to
  // describe a column rather than two unrelated heights.
  const top = inputs.echoTopFt[i];
  if (!Number.isFinite(top) || !(top > base)) {
    return { baseFt: null, source: null };
  }

  return {
    baseFt: Math.round(base),
    source: modelHasBase ? "model" : "ccl",
  };
}

/**
 * The layer's grid: merged base in ft MSL, NaN where nothing is drawn.
 *
 * NaN rather than zero so the contourer traces no ring there — the same shape
 * the target fill and the echo-past-freezing fill use. Zero would be a cloud
 * base at sea level.
 */
export function mergedBaseValues(inputs: MergedBaseInputs): Float32Array {
  const n = inputs.cloudBaseFt.length;
  const out = new Float32Array(n);
  out.fill(Number.NaN);
  for (let i = 0; i < n; i++) {
    const { baseFt } = mergedBaseAt(inputs, i);
    if (baseFt !== null) out[i] = baseFt;
  }
  return out;
}

/**
 * The merged cloud base read over one cell.
 *
 * The height and its source are reported even where the layer draws nothing,
 * because a click is asking about the column rather than about the fill: a base
 * at 19,000 ft MSL with no echo over it is a real answer, and printing a dash
 * for it would lose the reason the map is blank there. `drawn` is the fill's
 * own answer, so the panel and the picture cannot disagree.
 */
export type MergedBasePoint = {
  /** Merged base, ft MSL. Null where neither height is available. */
  cloudBaseMslFt: number | null;
  /** Which height answered. Null where neither did. */
  baseSource: BaseSource | null;
  /** Does the cloud-base layer fill this cell? */
  baseDrawn: boolean;
  /**
   * The convective condensation level itself, ft MSL, whether or not it was
   * the height that answered. Null where the column never saturates.
   *
   * It is reported beside the merged base rather than folded into it because
   * the two are different claims: the merged base says how high the cloud
   * starts, the CCL says how high a surface parcel would have to rise to
   * condense. Naming the source without printing the height leaves a reader
   * unable to tell a fallback that agreed with HRRR from one that did not.
   */
  cclFt: number | null;
};

/** The merged base over one cell, whether or not the layer draws it. */
export function readMergedBase(
  inputs: MergedBaseInputs,
  i: number
): MergedBasePoint {
  const modeled = inputs.cloudBaseFt[i];
  const modelHasBase = Number.isFinite(modeled);
  const base = modelHasBase ? modeled : inputs.cclFt[i];
  const has = Number.isFinite(base);

  const ccl = inputs.cclFt[i];

  return {
    cloudBaseMslFt: has ? Math.round(base) : null,
    baseSource: has ? (modelHasBase ? "model" : "ccl") : null,
    baseDrawn: mergedBaseAt(inputs, i).baseFt !== null,
    cclFt: Number.isFinite(ccl) ? Math.round(ccl) : null,
  };
}

/** What the sidebar reports for the merged cloud-base layer. */
export type MergedBaseStats = {
  run: string;
  validTime: string;
  /** Start of the radar scan the echo top came from. */
  radarTime: string;
  /** Ground the layer draws, km². */
  drawnKm2: number;
  /** Percent of the asked ground the layer draws. */
  drawnPct: number;
  /** Of the drawn ground, how much took HRRR's own base, km². */
  modelKm2: number;
  /** Of the drawn ground, how much fell back to the CCL, km². */
  cclKm2: number;
  /** Median drawn base, ft MSL. Null where the layer draws nothing. */
  medianFt: number | null;
};

type BaseContext = {
  run: Date;
  validTime: string;
  radarTime: string;
  geo: Geo;
  box?: LonLatBox;
};

/**
 * Fold the layer into the numbers the panel prints.
 *
 * The model/CCL split is the figure worth watching: it says how much of the
 * drawn map is resting on the fallback rather than on HRRR's own diagnosis, and
 * a run where that share moves is a run where the picture changed for a reason
 * other than the weather.
 */
export function summarizeMergedBase(
  inputs: MergedBaseInputs,
  context: BaseContext
): MergedBaseStats {
  const { geo, box } = context;
  const bases: number[] = [];
  let asked = 0;
  let model = 0;
  let ccl = 0;

  for (let i = 0; i < inputs.cloudBaseFt.length; i++) {
    if (box && !inBox(geo.lats[i], geo.lons[i], box)) continue;
    asked++;
    const { baseFt, source } = mergedBaseAt(inputs, i);
    if (baseFt === null) continue;
    bases.push(baseFt);
    if (source === "model") model++;
    else ccl++;
  }

  bases.sort((a, b) => a - b);

  return {
    run: context.run.toISOString(),
    validTime: context.validTime,
    radarTime: context.radarTime,
    drawnKm2: bases.length * CELL_KM2,
    drawnPct:
      asked === 0 ? 0 : Math.round((10000 * bases.length) / asked) / 100,
    modelKm2: model * CELL_KM2,
    cclKm2: ccl * CELL_KM2,
    medianFt: bases.length ? bases[Math.floor((bases.length - 1) / 2)] : null,
  };
}

/**
 * The ramp the fill is traced on: band edges in ft MSL.
 *
 * Thirds of the workable bound, so every edge traces back to that one number
 * rather than being picked from a coverage table.
 *
 * Disjoint because a height is a position and not an accumulation — exactly one
 * band applies to a cell, and `baseFeatures` carries what that costs.
 *
 * **The last band is open above the bound and still drawn.** A base too high to
 * work and no cloud at all are different answers, and blanking the first would
 * make them the same. Whether that base can be flown is the seeding
 * opportunity's judgement, not this layer's.
 */
export const MERGED_BASE = {
  property: "cloudBaseFt",
  edges: [
    0,
    BASE_CEILING_FT / 3,
    (2 * BASE_CEILING_FT) / 3,
    BASE_CEILING_FT,
  ] as const,
} as const;

/**
 * The layer's fill: one MultiPolygon per band, and a cell in exactly one of
 * them.
 *
 * **Disjoint, because the fill is one you can see through.** `bandFeatures` and
 * not `features`: nested rings would put a cell inside its own band and inside
 * every band below it, and two translucent fills over each other composite into
 * a shade the ramp does not have. Only an opaque fill can carry the ramp in the
 * draw order instead, and an opaque fill takes the basemap with it.
 *
 * Cutting the bands apart costs a hole in each one, and a hole has to lie
 * inside the ring it is cut from — see `nest` in `../shared/contour.ts` for
 * what that takes and what it looked like when it was not done.
 *
 * Traced here rather than at the call site so the disjointness is a property of
 * the layer and not of whichever method happens to draw it.
 */
export function baseFeatures(
  grid: Grid,
  geo: Geo,
  style: RingStyle
): ContourFeature[] {
  return bandFeatures(
    grid,
    geo,
    MERGED_BASE.property,
    MERGED_BASE.edges,
    style
  );
}
