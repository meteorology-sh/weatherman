/**
 * The vertical coordinate: which pressure levels are read, and how a
 * temperature or an altitude is found between two of them.
 *
 * Pure maths and level bookkeeping — no network, no eccodes, no service state.
 * It exists because the whole product turns on one conversion: the physical
 * quantity is a **temperature** and the number a drone is given is an
 * **altitude**, and `MEASUREMENTS.md` §4 is explicit that the altitude is
 * derived per point and per hour rather than assumed.
 */

// Grid
import { NO_VALUE } from "../shared/grid";

/** wrfprs carries CLWMR and TMP every 25 mb. */
export const LEVEL_STEP_MB = 25;

/** Pressure of one 25 mb layer, in Pa, for the dp/g integral. */
export const LAYER_PA = LEVEL_STEP_MB * 100;
export const GRAVITY = 9.81;

/** Meters to feet: HGT is geopotential meters, operators fly in feet. */
export const METERS_TO_FEET = 3.28084;

/**
 * Coarse ladder used to find the seeding band before reading it properly.
 *
 * Every record decoded costs ~1 s regardless of how small it is, so reading all
 * 25 levels of TMP+CLWMR (50 records, ~43 s) to discover that the band occupies
 * five of them is most of the build spent on levels that contribute nothing.
 * Seven TMP records (~7 s) bound the band, and only the levels that can contain
 * it are read at full spacing. Cost is then flat across seasons (~25 s) instead
 * of worst-case always.
 */
export const SCOUT_LADDER_MB = [300, 400, 500, 600, 700, 800, 900, 1000];

/**
 * How far the ladder may look, and these bounds are load-bearing: a band that
 * falls outside them is not truncated, it *disappears* — the scout finds no
 * touching level and the service answers "no supercooled liquid water anywhere
 * in the domain", which is a false negative rather than a small error.
 *
 * They are set from the temperature, not from an altitude convention. Measured
 * on a real August analysis, the warmest 3 km cell at 400 mb was **−13.4 °C** —
 * only 1.4 °C of margin against the −12 °C edge of the band, which is thin
 * enough that a hotter airmass could push the band's top above a 400 mb ceiling.
 * 300 mb (~30,000 ft) puts ~10 °C between the band and the ceiling. The floor is
 * HRRR's own lowest level rather than 1000 mb, because in a winter airmass the
 * band reaches the ground and 1000 mb is not the ground.
 */
export const SCOUT_MIN_MB = 300;
export const SCOUT_MAX_MB = 1000;

/**
 * HRRR's lowest pressure level, below 1000 mb and off the 25 mb ladder.
 *
 * It matters in exactly the case a mid-latitude-winter product cares about most:
 * an orographic snowpack event with supercooled liquid at 950–1013 mb. Skipping
 * it drops the bottom 13 mb of every column.
 */
export const SURFACE_MB = 1013.2;

/**
 * The vertical profile behind the point readout: where 0, −5 and −18 °C sit
 * over one spot, in feet.
 *
 * The contours say *where* to fly; this says *how high*, which is the number the
 * drone is actually given. It reads HRRR rather than a second model on purpose —
 * a sounding from somewhere else would disagree with the amber on screen about
 * where the band is, and an operator cannot act on two answers.
 *
 * 50 mb rather than wrfprs' native 25 mb: 32 records is ~32 s to build, 64
 * would be ~64 s, and temperature is near-linear across a 50 mb layer (~500 m),
 * so interpolating within one costs tens of feet. The whole 300 mb–surface range
 * is read rather than the band window, because the isotherms move hundreds of
 * millibars between seasons — see SCOUT_MIN_MB for the measurement behind those
 * bounds.
 *
 * One build serves every click on that hour — it is a national profile grid,
 * not a point query — so the cost is paid once per run, not per click.
 */
const STEP_MB = 50;

/**
 * Ceiling of the grid the profile actually reads, well above the sounding's own.
 *
 * **Build wide, display narrow.** The sounding panel wants 300 mb because that
 * is where a drone's target altitudes live and levels above it are noise on the
 * readout. The cloud-top layer wants far more: anvil and cirrus sit at
 * 100–300 mb routinely, and roughly half of all cloudy 3 km cells have tops
 * above 300 mb. A 300 mb ceiling clamps every one of them to the same
 * temperature and piles most of the grid into a single bin.
 *
 * So the grid is read to 100 mb and each consumer takes the slice it needs. The
 * cost is 8 more records (~8 s on a cold build, once per run) and it is paid by
 * whichever feature asks first.
 */
const PROFILE_MIN_MB = 100;

/** Every level the profile grid holds: 100–1000 by 50, plus HRRR's lowest. */
export const PROFILE_LEVELS: number[] = (() => {
  const out: number[] = [];
  for (let mb = PROFILE_MIN_MB; mb <= SCOUT_MAX_MB; mb += STEP_MB) {
    out.push(mb);
  }
  // HRRR's lowest level is below 1000 mb and off the ladder; in a winter
  // airmass the band reaches it, so the column has to.
  out.push(SURFACE_MB);
  return out;
})();

/**
 * The levels the *sounding readout* shows: 300–1000 by 50, plus 1013.2.
 *
 * A subset of PROFILE_LEVELS, not a separate fetch. Everything above 300 mb is
 * read into the grid and simply not displayed, so this panel is unchanged by
 * the widening above.
 */
export const SOUNDING_LEVELS: number[] = PROFILE_LEVELS.filter(
  (mb) => mb >= SCOUT_MIN_MB
);

/** One level of the point profile, in the units an operator reads. */
export type SoundingLevel = {
  mb: number;
  tempC: number;
  heightFt: number;
};

/** Block-averaged temperature and height at each level, for the whole domain. */
export type ProfileGrid = {
  levels: readonly number[];
  tempC: Map<number, Float32Array>;
  heightFt: Map<number, Float32Array>;
};

/**
 * The 25 mb levels from `topMb` down to `baseMb`, inclusive — plus HRRR's
 * lowest level when the window reaches the bottom of the ladder, since that one
 * is 13 mb below 1000 and would otherwise be skipped.
 */
export function pressureLevels(topMb: number, baseMb: number): number[] {
  const out: number[] = [];
  for (let mb = topMb; mb <= baseMb; mb += LEVEL_STEP_MB) out.push(mb);
  if (baseMb >= SCOUT_MAX_MB) out.push(SURFACE_MB);
  return out;
}

/** The .idx spells whole millibars without a decimal point. */
export const mbLabel = (mb: number) => String(mb);

/**
 * Key a level by whole millibars.
 *
 * The .idx names HRRR's lowest level `1013.2 mb`, but eccodes prints its
 * `level` key as the rounded `1013` — so a map keyed on the raw values misses
 * on exactly the level that was added to reach the winter band, and the build
 * fails with "missing TMP or HGT at 1013.2 mb". The label and the key are
 * different things: `mbLabel` addresses the index, this addresses the decode.
 */
export const levelKey = (mb: number) => Math.round(mb);

/**
 * Height of an isotherm, interpolated between the two levels that bracket it.
 *
 * `levels` must run bottom up. The **lowest** crossing wins: an inversion can
 * put a column above and below freezing more than once, and the altitude that
 * matters for flying into the band is the first one reached on the way up.
 * Returns null when the column never crosses the temperature at all, which is a
 * real answer — "the whole profile is colder than −18 °C" is not the same as
 * "the band is at zero feet".
 */
export function isothermFt(
  levels: readonly SoundingLevel[],
  targetC: number
): number | null {
  for (let i = 0; i < levels.length - 1; i++) {
    const below = levels[i];
    const above = levels[i + 1];
    // Temperature falls with height, so a crossing is warmer-then-colder.
    if (below.tempC < targetC || above.tempC > targetC) continue;
    const span = below.tempC - above.tempC;
    if (span === 0) return below.heightFt;
    const f = (below.tempC - targetC) / span;
    return Math.round(below.heightFt + f * (above.heightFt - below.heightFt));
  }
  return null;
}

/**
 * The same isotherm over every cell in the domain at once, ft MSL.
 *
 * `isothermFt` above answers one click and takes the levels it was handed; this
 * answers the whole grid, and it is what a join across layers needs — the height
 * of the seeding band's edges over 118k cells is the number the band-inside-
 * cloud test is a comparison between.
 *
 * Same rule as the point version, and it has to be: the **lowest** crossing
 * wins, because an inversion can put a column through the same temperature more
 * than once and the altitude that matters is the first one reached on the way
 * up. Levels arrive top down (low pressure first), so the walk runs backwards.
 * NaN where the column never crosses — "the whole profile is colder than
 * −18 °C" is not "the band's cold edge is at sea level".
 */
export function isothermFieldFt(
  profile: ProfileGrid,
  targetC: number
): Float32Array {
  // Bottom up, so the first crossing found is the lowest one.
  const rungs = profile.levels
    .map((mb) => ({
      tempC: profile.tempC.get(levelKey(mb))!,
      heightFt: profile.heightFt.get(levelKey(mb))!,
    }))
    .reverse();

  const cells = rungs[0].tempC.length;
  const out = new Float32Array(cells).fill(NO_VALUE);

  for (let cell = 0; cell < cells; cell++) {
    for (let k = 0; k < rungs.length - 1; k++) {
      const belowC = rungs[k].tempC[cell];
      const aboveC = rungs[k + 1].tempC[cell];
      // Temperature falls with height, so a crossing is warmer-then-colder.
      if (belowC < targetC || aboveC > targetC) continue;
      const belowFt = rungs[k].heightFt[cell];
      const aboveFt = rungs[k + 1].heightFt[cell];
      const span = belowC - aboveC;
      out[cell] =
        span === 0
          ? belowFt
          : belowFt + ((belowC - targetC) / span) * (aboveFt - belowFt);
      break;
    }
  }
  return out;
}

/**
 * Temperature at an arbitrary pressure over one cell, interpolated between the
 * two profile levels that bracket it.
 *
 * **Both ends clamp rather than extrapolate**, and the top one is the case that
 * matters. A cloud top above 300 mb — deep convection — is genuinely colder
 * than the 300 mb air, so returning the 300 mb temperature *understates* how
 * cold that top is. That is the safe direction to be wrong in: it can only move
 * a top toward the warm end of the ramp, never invent a cold one, and a top
 * that high is already past the coldest contour. Extrapolating up a lapse rate
 * we did not read would be the unsafe direction.
 *
 * `levels` must run from low pressure to high, as `PROFILE_LEVELS` does.
 */
export function temperatureAtMb(
  levels: readonly number[],
  tempC: Map<number, Float32Array>,
  cell: number,
  mb: number
): number {
  const at = (level: number) => tempC.get(levelKey(level))![cell];

  const first = levels[0];
  const last = levels[levels.length - 1];
  if (mb <= first) return at(first);
  if (mb >= last) return at(last);

  let k = 0;
  while (k < levels.length - 2 && levels[k + 1] < mb) k++;
  const lo = levels[k];
  const hi = levels[k + 1];
  const f = (mb - lo) / (hi - lo);
  return at(lo) + f * (at(hi) - at(lo));
}
