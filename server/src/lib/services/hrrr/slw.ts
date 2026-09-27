/**
 * Supercooled liquid water in the seeding band: the one HRRR field that is
 * derived rather than read, and the question the whole product exists to
 * answer.
 *
 * It lives next to the service rather than inside it because the reasoning is
 * the layer, not the plumbing — which levels count as in-band, how they are
 * bounded before anything is downloaded, and what the summary reports. The
 * service caches the result and contours it; everything about *what* is being
 * integrated is here.
 */

// Services
import { frame } from "../shared/contour";
import {
  CLWMR_NAME,
  eachHrrrMessage,
  fetchRanges,
  gribUrl,
  index,
  pick,
} from "./bytes";
import { CELL_KM2, NX, NY, POINTS } from "../shared/grid";
import {
  GRAVITY,
  LAYER_PA,
  SCOUT_LADDER_MB,
  SCOUT_MAX_MB,
  SCOUT_MIN_MB,
  mbLabel,
  pressureLevels,
} from "./profile";

// Types
import type { ContourFrame, Grid } from "../shared/contour";
import type { Cycle, IdxRow } from "./bytes";

/**
 * The band, the levels drawn, and the property they are drawn under.
 *
 * CLWMR (cloud water mixing ratio) is 3D: 40 pressure levels in wrfprs. Drawing
 * it at a single level would be arbitrary, because the -5..-18 C band moves —
 * it sat at 425-525 mb over Texas in July and lives near 700-950 mb in a winter
 * airmass. So we integrate CLWMR over exactly the levels that are in the band
 * at each point:
 *
 *   SLW = sum over levels in band of  q_c * dp / g      [kg/m^2 -> x1000 g/m^2]
 *
 * Unlike PRATE this exists at f00: a mixing ratio is a *state* the analysis
 * holds, not a flux needing a timestep. That is what lets the candidate map show
 * it for "right now".
 */
export const SEEDING = {
  property: "slwPath",
  /**
   * g/m^2. Measured against a real analysis rather than chosen for round
   * numbers: >=10 covers 1.73% of CONUS, >=50 0.90%, >=150 ~0.3%, >=400 0.07%.
   * That is the same footprint precipitation has, so the same faint stacked
   * fills keep the basemap readable.
   */
  levels: [10, 50, 150, 400],
  /**
   * The band worth seeding.
   *
   * **Warm edge, −5 °C: a physical threshold.** Silver iodide barely nucleates
   * ice above it, so liquid warmer than this is not seedable with AgI at all.
   *
   * **Cold edge, −18 °C: a judgment, and a deliberately generous one.** AgI
   * keeps working to roughly −20 °C; what falls off below about −12 °C is not
   * the seeding agent but the *supply* — natural ice nuclei activate and take
   * the liquid first, so there is progressively less of it to find. −12 °C is
   * where the literature puts the point of diminishing returns, and stopping
   * there would discard real supercooled liquid at −13 to −18 °C that AgI would
   * convert. The edge sits at −18 °C on the principle that a tool for *finding*
   * candidates shows what is there and lets the operator judge, rather than
   * pre-filtering to what is likeliest.
   *
   * Both edges are read by the SLW integral and the sounding, so they move
   * together.
   */
  warmestC: -5,
  coldestC: -18,
} as const;

/**
 * What the sidebar reports for the supercooled-liquid layer. Deliberately the
 * numbers an operator acts on — is there any, how much, how much ground does it
 * cover, and what altitude is it at — rather than a domain average, which for a
 * field covering ~2% of the country is a number about the other 98%.
 */
export type SlwStats = {
  run: string;
  hour: number;
  validTime: string;
  /** Percent of the HRRR domain at or above the lowest contour. */
  coveragePct: number;
  /** Ground at or above the lowest contour, km^2. */
  seedableKm2: number;
  /** Peak supercooled liquid water path, g/m^2. */
  peak: number;
  /** Pressure window the -5..-18 C band occupied, mb. Null when it is absent. */
  bandTopMb: number | null;
  bandBaseMb: number | null;
};

/** One hour's build: the frame, its summary, and the grid both came from. */
export type Slw = {
  frame: ContourFrame;
  stats: SlwStats;
  /**
   * The grid the contours were traced from, kept so a join can read it. Null
   * when no point in the domain is in the seeding band at all, which is the one
   * case with no grid to keep.
   */
  grid: Grid | null;
};

/**
 * Integrate CLWMR over the -5..-18 C band and contour the result.
 *
 * Two passes on purpose — see SCOUT_LADDER_MB. The scout only chooses which
 * levels to read; TMP at those levels still decides band membership per point,
 * so nothing here depends on a lapse-rate assumption.
 *
 * `contour` is handed in rather than imported: tracing needs the lat/lon grid,
 * which the service builds once from whichever record arrives first and holds
 * for every field. Passing it keeps that one owner.
 */
export async function buildSlw(
  cycle: Cycle,
  hour: number,
  contour: (grid: Grid, grib: Buffer) => Promise<ContourFrame["features"]>
): Promise<Slw> {
  const { run, origin } = cycle;
  const rows = await index(cycle, hour, "wrfprs");
  const url = gribUrl(cycle, hour, "wrfprs");

  const window = await scout(rows, url, origin);
  if (!window) {
    // No point in the domain is between -5 and -18 C at any level.
    return {
      frame: frame(run, hour, []),
      stats: emptyStats(run, hour),
      grid: null,
    };
  }

  const levels = pressureLevels(window.topMb, window.baseMb);
  // The archive names cloud mixing ratio CLMR where NOMADS names it CLWMR.
  // eccodes calls it `clwmr` on both, so only this lookup needs to know.
  const wanted = levels.flatMap((mb) =>
    ["TMP", CLWMR_NAME[origin]].map((name) =>
      pick(rows, name, `${mbLabel(mb)} mb`)
    )
  );
  const grib = await fetchRanges(url, wanted, origin);

  // kg/m^2 at the native 3 km grid.
  const path = new Float32Array(POINTS);
  let temps: Float32Array | null = null;
  let topMb: number | null = null;
  let baseMb: number | null = null;

  await eachHrrrMessage(grib, (name, level, values) => {
    if (name === "t") {
      temps = values;
      return;
    }
    // wrfprs orders each level's records TMP before CLWMR, so `temps` is this
    // level's temperature. Refuse to guess if that ever stops holding.
    if (!temps) {
      throw new Error(`CLWMR at ${level} mb arrived before its temperature`);
    }
    const t = temps;
    let inBand = false;
    for (let i = 0; i < POINTS; i++) {
      const q = values[i];
      if (q <= 0) continue;
      const celsius = t[i] - 273.15;
      if (celsius < SEEDING.coldestC || celsius > SEEDING.warmestC) continue;
      path[i] += (q * LAYER_PA) / GRAVITY;
      inBand = true;
    }
    if (inBand) {
      topMb = topMb === null ? level : Math.min(topMb, level);
      baseMb = baseMb === null ? level : Math.max(baseMb, level);
    }
    temps = null;
  });

  // kg/m^2 -> g/m^2, which is the unit the seeding literature uses and the
  // one the contour levels are expressed in.
  for (let i = 0; i < path.length; i++) path[i] *= 1000;
  const grid: Grid = { nx: NX, ny: NY, values: path };

  return {
    frame: frame(run, hour, await contour(grid, grib)),
    stats: stats(run, hour, grid, topMb, baseMb),
    grid,
  };
}

/**
 * Bound the seeding band with a coarse TMP ladder. Returns the pressure window
 * that can contain it, or null when nothing in the domain is in the band.
 *
 * A level can only hold in-band points if its temperature range across the
 * domain overlaps -5..-18 C, so min/max per ladder level is enough to bracket
 * it. The window is padded a full ladder step because the band can sit
 * entirely between two rungs.
 */
async function scout(
  rows: IdxRow[],
  url: string,
  origin: Cycle["origin"]
): Promise<{ topMb: number; baseMb: number } | null> {
  const grib = await fetchRanges(
    url,
    SCOUT_LADDER_MB.map((mb) => pick(rows, "TMP", `${mb} mb`)),
    origin
  );

  const seen: { mb: number; min: number; max: number }[] = [];
  await eachHrrrMessage(grib, (_name, level, values) => {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < POINTS; i++) {
      const c = values[i] - 273.15;
      if (c < min) min = c;
      if (c > max) max = c;
    }
    seen.push({ mb: level, min, max });
  });
  seen.sort((a, b) => a.mb - b.mb);

  const touching = seen.filter(
    (s) => s.max >= SEEDING.coldestC && s.min <= SEEDING.warmestC
  );
  if (touching.length === 0) return null;

  const step = SCOUT_LADDER_MB[1] - SCOUT_LADDER_MB[0];
  return {
    topMb: Math.max(SCOUT_MIN_MB, touching[0].mb - step),
    baseMb: Math.min(SCOUT_MAX_MB, touching[touching.length - 1].mb + step),
  };
}

/** The summary for an hour with no seeding band anywhere in the domain. */
export function emptyStats(run: Date, hour: number): SlwStats {
  return {
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    coveragePct: 0,
    seedableKm2: 0,
    peak: 0,
    bandTopMb: null,
    bandBaseMb: null,
  };
}

export function stats(
  run: Date,
  hour: number,
  grid: Grid,
  bandTopMb: number | null,
  bandBaseMb: number | null
): SlwStats {
  const floor = SEEDING.levels[0];
  let seedable = 0;
  let peak = 0;
  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (v >= floor) seedable++;
    if (v > peak) peak = v;
  }
  const total = grid.values.length;
  return {
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    // Reported against the same 3 km grid the contours are drawn from, so the
    // number and the picture cannot disagree.
    coveragePct: Math.round((10000 * seedable) / total) / 100,
    seedableKm2: seedable * CELL_KM2,
    peak: Math.round(peak),
    bandTopMb,
    bandBaseMb,
  };
}
