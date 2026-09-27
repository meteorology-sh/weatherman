/**
 * The convective condensation level: how high a surface parcel has to rise
 * before the moisture it already carries condenses.
 *
 * **Why this exists.** HRRR diagnoses a cloud base only where it has modeled a
 * cloud. Under the convection this product cares about it frequently has none,
 * and a map drawn on `HGT:cloud base` alone is full of holes exactly where a
 * storm is. The CCL is defined everywhere the column is — over clear ground
 * too — so it supplies a base height where the model declines to.
 *
 * **It is a height, never an observation of cloud.** A CCL over dry ground is
 * the altitude a cloud base *would* sit at, not evidence that one is there.
 * Whether a cloud exists is settled by measurement elsewhere; nothing in this
 * file may be read as cloud presence, and it is never labelled "cloud base".
 *
 * **CCL rather than LCL.** Against the operators' own printed cloud base on
 * 104-127 balloon mornings, off the same balloon: the CCL runs +961 ft with a
 * 1,385 ft typical miss and lands within 2,000 ft on 61% of mornings; the LCL
 * runs -2,566 ft with a 2,749 ft typical miss and 35%. The CCL is the closer
 * of the two on 68% of mornings. The LCL is a lifted-parcel height and sits
 * systematically low; the CCL is where the environment itself saturates, which
 * is the quantity a convective cloud base actually is.
 *
 * Pure maths over arrays, and tested that way: reaching it through the service
 * is a wrfprs download and eccodes.
 */

// Grid
import { levelKey } from "./profile";

/** Ratio of the gas constants for dry air and water vapour. Dimensionless. */
const EPSILON = 0.622;

/**
 * Saturation vapour pressure over liquid water, hPa, from temperature in °C.
 *
 * Bolton (1980) eq. 10. Over liquid at every temperature this reaches, rather
 * than switching to ice below freezing: the CCL crossing is found in the warm
 * part of the column, and a mixed formulation would put a discontinuity in the
 * middle of a monotone search for no gain.
 */
export function saturationVaporPressure(tempC: number): number {
  return 6.112 * Math.exp((17.67 * tempC) / (tempC + 243.5));
}

/**
 * Saturation mixing ratio, kg/kg, at a temperature and pressure.
 *
 * Undefined where the saturation vapour pressure reaches the ambient pressure —
 * far above anything this search walks — so the caller gets a non-finite value
 * rather than a negative mixing ratio.
 */
export function saturationMixingRatio(
  tempC: number,
  pressureMb: number
): number {
  const es = saturationVaporPressure(tempC);
  if (!(pressureMb > es)) return Number.NaN;
  return (EPSILON * es) / (pressureMb - es);
}

/**
 * Mixing ratio, kg/kg, from specific humidity, kg/kg.
 *
 * The two differ by under 2% in the lower troposphere, which is well inside the
 * miss this height carries. The conversion is here anyway because it is exact
 * and free, and because mixing ratio is the quantity the saturation curve is
 * written in.
 */
export function mixingRatio(specificHumidity: number): number {
  if (!Number.isFinite(specificHumidity)) return Number.NaN;
  if (specificHumidity <= 0 || specificHumidity >= 1) return Number.NaN;
  return specificHumidity / (1 - specificHumidity);
}

/** The profile grid this reads: temperature and height on a pressure ladder. */
export type CclProfile = {
  /** Pressure levels, mb. Any order; the search sorts them itself. */
  levels: readonly number[];
  /** °C at each level, keyed as `levelKey(mb)`. */
  tempC: Map<number, Float32Array>;
  /** ft MSL at each level, keyed as `levelKey(mb)`. */
  heightFt: Map<number, Float32Array>;
  /** Terrain, ft MSL. Levels below it are underground and are not searched. */
  surfaceFt: Float32Array;
};

/**
 * The CCL over one cell, ft MSL, from a ladder already sorted bottom-up.
 *
 * The grid pass and the point readout both come through here, so the height a
 * click prints and the height the base layer used cannot disagree about a cell.
 */
function cclOverCell(
  profile: CclProfile,
  ladder: readonly number[],
  temps: readonly (Float32Array | undefined)[],
  heights: readonly (Float32Array | undefined)[],
  parcel: number,
  i: number
): number {
  if (!Number.isFinite(parcel)) return Number.NaN;
  const surface = profile.surfaceFt[i];

  // The last level below the crossing, carried so the crossing can be
  // interpolated rather than snapped to a 50 mb rung (~1,500 ft).
  let belowWs = Number.NaN;
  let belowFt = Number.NaN;

  for (let k = 0; k < ladder.length; k++) {
    const t = temps[k];
    const h = heights[k];
    if (!t || !h) continue;

    const heightFt = h[i];
    const tempC = t[i];
    if (!Number.isFinite(heightFt) || !Number.isFinite(tempC)) continue;
    // Underground, or the terrain height itself is unknown.
    if (Number.isFinite(surface) && heightFt < surface) continue;

    const ws = saturationMixingRatio(tempC, ladder[k]);
    if (!Number.isFinite(ws)) continue;

    if (ws <= parcel) {
      // Saturated at the first level above the ground: the parcel is already
      // at its condensation level, so the base is the ground.
      if (!Number.isFinite(belowWs)) {
        return Number.isFinite(surface) ? surface : heightFt;
      }
      // Linear in the saturation mixing ratio across the layer. ws falls
      // monotonically here, so the denominator cannot be zero.
      const span = belowWs - ws;
      const fraction = span === 0 ? 0 : (belowWs - parcel) / span;
      return belowFt + fraction * (heightFt - belowFt);
    }

    belowWs = ws;
    belowFt = heightFt;
  }

  return Number.NaN;
}

/** Bottom up: descending pressure is ascending height. */
function bottomUp(profile: CclProfile) {
  const ladder = [...profile.levels].sort((a, b) => b - a);
  return {
    ladder,
    temps: ladder.map((mb) => profile.tempC.get(levelKey(mb))),
    heights: ladder.map((mb) => profile.heightFt.get(levelKey(mb))),
  };
}

/**
 * The CCL over one cell, ft MSL, from the surface specific humidity there.
 *
 * For the point readout, which needs one column rather than the domain.
 */
export function cclFtAt(
  profile: CclProfile,
  specificHumidity2m: number,
  cell: number
): number {
  const { ladder, temps, heights } = bottomUp(profile);
  return cclOverCell(
    profile,
    ladder,
    temps,
    heights,
    mixingRatio(specificHumidity2m),
    cell
  );
}

/**
 * The CCL over every cell, ft MSL. NaN where the column never saturates.
 *
 * The search walks the column upward from the ground and stops at the first
 * level whose saturation mixing ratio has fallen to the parcel's own. That is
 * the CCL: below it the environment holds more moisture than the parcel
 * carries, above it less.
 *
 * **Underground levels are skipped.** HRRR extrapolates its pressure levels
 * beneath the terrain rather than leaving them missing, so over the Llano
 * Estacado the 1000 mb level is inside the ground and its temperature is a
 * fiction. Starting the walk at the first level above the terrain is what keeps
 * the crossing from being found in rock.
 *
 * **A column that never saturates has no CCL**, and that is an answer rather
 * than a gap: an airmass too dry for its own surface moisture to condense
 * anywhere in the profile has no convective cloud base, and returning a height
 * at the top of the ladder would invent one.
 */
export function cclFt(
  profile: CclProfile,
  specificHumidity2m: Float32Array
): Float32Array {
  const { ladder, temps, heights } = bottomUp(profile);
  const n = profile.surfaceFt.length;
  const out = new Float32Array(n);
  out.fill(Number.NaN);

  for (let i = 0; i < n; i++) {
    out[i] = cclOverCell(
      profile,
      ladder,
      temps,
      heights,
      mixingRatio(specificHumidity2m[i]),
      i
    );
  }

  return out;
}
