/**
 * The 12Z sounding table, as fields on the 3 km grid.
 *
 * CAPE, CIN, LCL, freezing level, −15 °C, and warm-cloud depth are the
 * rows Texas programs print from the morning balloon. They are already
 * in HRRR. This file is the arithmetic that turns those arrays into the
 * bands the map draws. Cloud base is the remaining row, and it already
 * has its own layer.
 *
 * Warm-cloud depth is produced as depth. That is not hygroscopic
 * targeting.
 *
 * Pure, so it can be tested on hand-built columns without eccodes.
 */

import { CLOUD_BASE } from "./diagnostics";

/**
 * The −15 °C isotherm the 12Z table prints. Distinct from the seeding
 * band's cold edge, which is −18 °C.
 */
export const BRIEFING_COLD_C = -15;

/**
 * Mixed-layer CAPE, J/kg. NWS instability classes: 1,000 / 2,500 /
 * 4,000. The mixed-layer parcel is the one a turret grows out of.
 */
export const CAPE = {
  property: "mixedCapeJKg",
  edges: [1000, 2500, 4000] as const,
} as const;

/**
 * Convective inhibition, J/kg, as a magnitude. HRRR stores CIN as
 * zero or negative; the map and the click report how much inhibition
 * there is. NWS classes: 50 / 100 / 200.
 */
export const CIN = {
  property: "cinJKg",
  edges: [50, 100, 200] as const,
} as const;

/**
 * Lifting condensation level, ft MSL. Same edges as cloud base: thirds
 * of the service ceiling, so the two height ramps compare.
 */
export const LCL = {
  property: "lclFt",
  edges: CLOUD_BASE.edges,
} as const;

/** 0 °C, ft MSL. Same edges as cloud base. */
export const FREEZING = {
  property: "freezingFt",
  edges: CLOUD_BASE.edges,
} as const;

/** −15 °C, ft MSL. Same edges as cloud base. */
export const MINUS15 = {
  property: "minus15Ft",
  edges: CLOUD_BASE.edges,
} as const;

/**
 * Freezing level minus cloud base, ft. Blank where either is missing
 * or the base sits at or above freezing — there is no warm cloud then.
 */
export const WARM_DEPTH = {
  property: "warmCloudDepthFt",
  edges: CLOUD_BASE.edges,
} as const;

export const BRIEFING_FIELDS = [
  "cape",
  "cin",
  "lcl",
  "freezing",
  "minus15",
  "warm-depth",
] as const;

export type BriefingField = (typeof BRIEFING_FIELDS)[number];

export function isBriefingField(value: string): value is BriefingField {
  return (BRIEFING_FIELDS as readonly string[]).includes(value);
}

/** Magnitude of CIN. HRRR is ≤ 0; NaN stays NaN. */
export function cinMagnitude(cinJKg: Float32Array): Float32Array {
  const out = new Float32Array(cinJKg.length);
  for (let i = 0; i < cinJKg.length; i++) {
    const v = cinJKg[i];
    if (!Number.isFinite(v)) {
      out[i] = Number.NaN;
      continue;
    }
    out[i] = v < 0 ? -v : 0;
  }
  return out;
}

/**
 * Warm-cloud depth, ft. NaN where the column has no freezing level, no
 * cloud base, or a base at or above freezing.
 */
export function warmCloudDepthValues(
  freezingFt: Float32Array,
  cloudBaseFt: Float32Array
): Float32Array {
  const n = Math.min(freezingFt.length, cloudBaseFt.length);
  const out = new Float32Array(freezingFt.length);
  out.fill(Number.NaN);
  for (let i = 0; i < n; i++) {
    const freeze = freezingFt[i];
    const base = cloudBaseFt[i];
    if (!Number.isFinite(freeze) || !Number.isFinite(base)) continue;
    const depth = freeze - base;
    if (depth > 0) out[i] = depth;
  }
  return out;
}
