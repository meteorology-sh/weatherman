/**
 * Cloud base in the 4,000–12,000 ft AGL window.
 *
 * The Comptroller figure is a height above the ground, not above the sea.
 * MSL would move the window with the terrain; AGL is what transfers from
 * the Gulf coast to high ground. Drawn wherever the model has a base in
 * that window — a national fill, not a Texas-only mask.
 *
 * Pure, so it can be tested on hand-built columns without eccodes.
 */

import { BASE_WINDOW_FT } from "./diagnostics";

const [WINDOW_LOW, WINDOW_HIGH] = BASE_WINDOW_FT;

/** True if the base sits in the Comptroller window, half-open at the top. */
export function inBaseWindow(aglFt: number): boolean {
  return aglFt >= WINDOW_LOW && aglFt < WINDOW_HIGH;
}

/**
 * 1 where the column has a base in the window. NaN everywhere else, so
 * the contourer draws nothing there.
 */
export function windowValues(
  cloudBaseFt: Float32Array,
  surfaceFt: Float32Array
): Float32Array {
  const out = new Float32Array(cloudBaseFt.length);
  out.fill(Number.NaN);
  for (let i = 0; i < cloudBaseFt.length; i++) {
    const base = cloudBaseFt[i];
    if (!Number.isFinite(base) || !Number.isFinite(surfaceFt[i])) continue;
    const agl = base - surfaceFt[i];
    if (inBaseWindow(agl)) out[i] = 1;
  }
  return out;
}

/**
 * The cloud base itself, in ft MSL, wherever that base sits in the window —
 * NaN everywhere else, so the contourer draws nothing there.
 *
 * The trimmed half of the drawn layer. {@link windowValues} above answers
 * "is there flyable cloud here", which is what the evaluation harness scores
 * and what the join reads; this answers "how high is the flyable cloud", so
 * the switch narrows the map's height ramp rather than flattening it to one
 * gate colour. Same test, same window, same field — only the value kept
 * differs.
 */
export function windowBaseValues(
  cloudBaseFt: Float32Array,
  surfaceFt: Float32Array
): Float32Array {
  const out = new Float32Array(cloudBaseFt.length);
  out.fill(Number.NaN);
  for (let i = 0; i < cloudBaseFt.length; i++) {
    const base = cloudBaseFt[i];
    if (!Number.isFinite(base) || !Number.isFinite(surfaceFt[i])) continue;
    if (inBaseWindow(base - surfaceFt[i])) out[i] = base;
  }
  return out;
}
