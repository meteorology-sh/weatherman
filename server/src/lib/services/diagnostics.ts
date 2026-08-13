/**
 * The 2D diagnostics in `wrfsfc` — what they are, and how one cell folds into
 * the readout an operator sees.
 *
 * This is the file the cloud-cover and precipitation layers already download,
 * read for everything else it carries. **Attributes, never gates**: with one
 * exception the panel prints these and nothing filters on them, because
 * `MEASUREMENTS.md` §6 is explicit that a threshold needs a citation and not a
 * coverage table, and none of these has one yet.
 *
 * The exception is cloud base and cloud top, which are the two ends of a real
 * question — is the seeding band inside this cloud — and `bandInCloud` answers
 * it at one point.
 */

// Grid
import { CELL_KM2 } from "./grid";
import { METRES_TO_FEET } from "./profile";

// Types
import type { Grid } from "./contour";

/**
 * What a bitmapped-missing point is printed as while decoding these records.
 *
 * eccodes defaults to 9999, and **for a height in metres that is a real
 * value**: HRRR's `HGT:cloud top` carries tops to 15,698 m in this same file,
 * so 9999 would silently read genuine deep convection as nodata. The first pass
 * at this layer produced cloud tops below cloud bases for exactly that reason.
 * The sentinel has to sit outside the field's physical range instead.
 */
export const SFC_MISSING = -9_999_999;

/**
 * RETOP's own no-echo value. It carries no bitmap and writes −999 where the
 * model diagnoses no radar echo, so `SFC_MISSING` never sees those points and
 * this has to be dropped by hand. 97.6% of CONUS on the sampled hour.
 */
const NO_ECHO = -999;

/** m/s to knots, which is what a storm-motion vector is read in. */
const KNOTS = 1.94384;

/**
 * The window Texas operations select cloud bases in, ft MSL.
 *
 * **Cited, not derived.** The state's published description of its permitted
 * programmes targets convective clouds with bases between 4,000 and 12,000 ft;
 * this is that number, not a cutoff chosen from a coverage table. It is
 * reported and drawn, never used to filter anything out — a base outside it is
 * still a base, and the layer still paints it.
 *
 * **The datum is ours, not theirs.** The published figure does not say MSL or
 * AGL, and over Texas the two differ by up to ~4,000 ft between the coast and
 * the Llano Estacado. This app reads it as MSL because that is the datum
 * everything else here is in — `HGT:cloud base` is geopotential metres above
 * sea level, the sounding's band base and freezing level are MSL, and asking
 * whether the band lies between base and top is a comparison between those
 * three numbers, which is only meaningful in one datum. The point readout
 * carries the height above ground alongside it.
 */
export const BASE_WINDOW_FT = [4000, 12000] as const;

/**
 * Cloud base, contoured into **disjoint bands** rather than nested contours.
 *
 * The shape is chosen by measuring the coverage of each level first. Over the
 * Texas box on a rainy-season afternoon (2025-05-15 18z f00, 11,071 12 km
 * cells) 39.3% of cells carry a base at all, and those split 18% below
 * 4,000 ft, 12% inside the window, and 70% above 12,000 ft. That is bimodal —
 * low convective bases, or the base of a cirrus deck with clear air underneath
 * — and nesting cannot express it: "lower is better" up to a point and then
 * "lower" means fog. Exactly one band applies to a cell, so the legend reads
 * straight, the same way cloud-top temperature does.
 *
 * The edges are the operational window's own, so the middle band **is** the
 * window rather than an approximation of it.
 */
export const CLOUD_BASE = {
  property: "cloudBaseFt",
  edges: [0, ...BASE_WINDOW_FT] as const,
} as const;

/**
 * The records read out of `wrfsfc`.
 *
 * `id` is eccodes' `parameterCategory:parameterNumber:typeOfLevel`, which is
 * how messages are matched back to fields on the way out. **Not `shortName`**:
 * `RETOP` decodes as `unknown` (NCEP has no eccodes entry for it), and cloud
 * base and cloud top are both `gh` at level 0 and would collide. The GRIB2
 * parameter identity does not have either problem.
 *
 * `grib` is the `.idx` naming, which both origins agree on here — verified
 * against a 2025-05-15 archive index and a live NOMADS one. There is no
 * `CLWMR`/`CLMR`-style rename in this set.
 */
export const DIAGNOSTICS = {
  /** The selection variable Texas practice actually uses. */
  cloudBase: {
    grib: { name: "HGT", level: "cloud base" },
    id: "3:5:cloudBase",
    scale: METRES_TO_FEET,
    missing: SFC_MISSING,
    firstHour: 0,
  },
  /**
   * HRRR's own cloud top, and it is sparse where the base is dense —
   * 27.7% of CONUS against 58.6% on the sampled hour, because `PRES`/`HGT:cloud
   * top` report one deck rather than the highest (`MEASUREMENTS.md` §4). It is
   * read for the point readout and deliberately not drawn: a layer that
   * vanished over most of the cloud the base layer shows would read as "no
   * cloud". The map's answer for cloud top is the satellite's.
   */
  cloudTop: {
    grib: { name: "HGT", level: "cloud top" },
    id: "3:5:cloudTop",
    scale: METRES_TO_FEET,
    missing: SFC_MISSING,
    firstHour: 0,
  },
  /**
   * Surface-based convective available potential energy, J/kg — how much a
   * turret has to grow on.
   */
  cape: {
    grib: { name: "CAPE", level: "surface" },
    id: "7:6:surface",
    scale: 1,
    missing: null,
    firstHour: 0,
  },
  /** The mixed-layer parcel, which is the one a turret grows out of. */
  mixedCape: {
    grib: { name: "CAPE", level: "180-0 mb above ground" },
    id: "7:6:pressureFromGroundLayer",
    scale: 1,
    missing: null,
    firstHour: 0,
  },
  /**
   * Storm motion, m/s, east and north components of the 0–6 km vector — where a
   * seeded cloud would carry the plume.
   */
  stormU: {
    grib: { name: "USTM", level: "0-6000 m above ground" },
    id: "2:27:heightAboveGroundLayer",
    scale: 1,
    missing: null,
    firstHour: 0,
  },
  stormV: {
    grib: { name: "VSTM", level: "0-6000 m above ground" },
    id: "2:28:heightAboveGroundLayer",
    scale: 1,
    missing: null,
    firstHour: 0,
  },
  /**
   * Electrification: how much lightning the model is producing here.
   *
   * `firstHour: 1` for the same reason `PRATE` has it, and verified the same
   * way: at f00 this record is **188 bytes** — GRIB2's size for a constant
   * field — and decodes to zero everywhere. A flash rate is diagnosed by
   * integrating a timestep forward and the analysis has not taken one.
   *
   * eccodes reports it `dimensionless` and NCEP publishes no unit for it, so it
   * is reported as the bare number HRRR carries rather than dressed in one.
   */
  lightning: {
    grib: { name: "LTNG", level: "entire atmosphere" },
    id: "17:192:atmosphere",
    scale: 1,
    missing: null,
    firstHour: 1,
  },
  /**
   * Vertically integrated liquid, kg/m² — an independent check on the
   * supercooled-liquid integral, which is derived from a different field.
   */
  vil: {
    grib: { name: "VIL", level: "entire atmosphere" },
    id: "15:3:atmosphere",
    scale: 1,
    missing: null,
    firstHour: 0,
  },
  /** Model-diagnosed radar echo top. See `NO_ECHO` for its sentinel. */
  echoTop: {
    grib: { name: "RETOP", level: "cloud top" },
    id: "16:3:cloudTop",
    scale: METRES_TO_FEET,
    missing: NO_ECHO,
    firstHour: 0,
  },
} as const;

export type DiagnosticId = keyof typeof DIAGNOSTICS;

/** Every diagnostic field on the 12 km grid, keyed by name. */
export type Fields = Map<DiagnosticId, Float32Array>;

/**
 * What the sidebar reports for the cloud-base layer.
 *
 * The two figures that matter are how much of the domain has a cloud base at
 * all and how much of it sits in the window Texas operations select in — the
 * gap between them is mostly cirrus base over clear low levels, which is not a
 * target and covers most of the cloudy ground on a typical hour.
 */
export type CloudBaseStats = {
  run: string;
  hour: number;
  validTime: string;
  /** Percent of the HRRR domain with a cloud base at all. */
  basePct: number;
  /** Percent of the domain whose base is inside BASE_WINDOW_FT. */
  windowPct: number;
  /** Ground with a base inside the window, km^2. */
  windowKm2: number;
  /** Median base where there is one, ft MSL. Null when there is no cloud. */
  medianFt: number | null;
};

/** The `wrfsfc` diagnostics over one point. */
export type Diagnostics = {
  /** Cloud base, ft MSL. Null where the model has no cloud over the cell. */
  cloudBaseFt: number | null;
  /** The same base above the terrain, which is what a ceiling report means. */
  cloudBaseAglFt: number | null;
  /** HRRR's own cloud top, ft MSL — one deck, not necessarily the highest. */
  cloudTopFt: number | null;
  /** Top minus base. Null when either is missing, or when they invert. */
  depthFt: number | null;
  /**
   * Does the seeding band's base lie between cloud base and cloud top? Null
   * when the column has no band base, or when HRRR reports no top here — which
   * is most cloudy cells, and is why the map's cloud top comes from the
   * satellite instead.
   */
  bandInCloud: boolean | null;
  /** Surface-based CAPE, J/kg. */
  capeJKg: number;
  /** Mixed-layer (180–0 mb) CAPE, J/kg. */
  mixedCapeJKg: number;
  /** 0–6 km storm motion, knots. */
  stormMotionKt: number;
  /** Compass bearing the storm is moving **toward**, degrees. Null when still. */
  stormMotionTowardDeg: number | null;
  /** HRRR's lightning field, dimensionless. Null at f00, where it is not diagnosed. */
  lightning: number | null;
  /** Vertically integrated liquid, kg/m^2. */
  vilKgM2: number;
  /** Model radar echo top, ft MSL. Null where the model diagnoses no echo. */
  echoTopFt: number | null;
};

/**
 * Which diagnostics an hour carries.
 *
 * Only `lightning` is ever dropped, and it is dropped for a fact about HRRR
 * rather than a preference: at f00 that record is a 188-byte constant field of
 * zeros, so downloading it would cost a request to learn nothing. Everything
 * else is a state the analysis holds and is full-size at f00.
 */
export function recordsAt(hour: number): DiagnosticId[] {
  return (Object.keys(DIAGNOSTICS) as DiagnosticId[]).filter(
    (id) => hour >= DIAGNOSTICS[id].firstHour
  );
}

/** One field's value over one cell, or null where it has none. */
const at = (fields: Fields, id: DiagnosticId, cell: number): number | null => {
  const v = fields.get(id)?.[cell];
  return v === undefined || Number.isNaN(v) ? null : v;
};

/**
 * The 2D diagnostics over one cell, in the units the readout prints.
 *
 * Exported for the tests: everything here is arithmetic over arrays, and the
 * only way to reach it through the service is a 10 MB download and eccodes.
 */
export function diagnostics(
  fields: Fields,
  cell: number,
  surfaceFt: number,
  bandBaseFt: number | null
): Diagnostics {
  const round = (v: number | null) => (v === null ? null : Math.round(v));
  const round2 = (v: number | null) =>
    v === null ? null : Math.round(v * 100) / 100;

  const cloudBaseFt = round(at(fields, "cloudBase", cell));
  const cloudTopFt = round(at(fields, "cloudTop", cell));

  // A top at or below the base is not a thin cloud — `PRES`/`HGT:cloud top`
  // report one deck rather than the highest, so the two diagnostics can be
  // describing different decks. Reporting the difference would invent a depth.
  const deep =
    cloudBaseFt !== null && cloudTopFt !== null && cloudTopFt > cloudBaseFt;

  const u = at(fields, "stormU", cell) ?? 0;
  const v = at(fields, "stormV", cell) ?? 0;
  const speed = Math.round(Math.hypot(u, v) * KNOTS);

  return {
    cloudBaseFt,
    cloudBaseAglFt:
      cloudBaseFt === null ? null : Math.round(cloudBaseFt - surfaceFt),
    cloudTopFt,
    depthFt: deep ? cloudTopFt! - cloudBaseFt! : null,
    bandInCloud:
      bandBaseFt === null || cloudBaseFt === null || cloudTopFt === null
        ? null
        : cloudBaseFt <= bandBaseFt && bandBaseFt <= cloudTopFt,
    capeJKg: Math.round(at(fields, "cape", cell) ?? 0),
    mixedCapeJKg: Math.round(at(fields, "mixedCape", cell) ?? 0),
    stormMotionKt: speed,
    // A bearing off a zero vector is atan2(0, 0), which is 0 rather than
    // "nowhere". Say there is no direction instead of pointing north.
    stormMotionTowardDeg: speed === 0 ? null : bearing(u, v),
    lightning: round2(at(fields, "lightning", cell)),
    vilKgM2: Math.round((at(fields, "vil", cell) ?? 0) * 10) / 10,
    // RETOP's no-echo points are dropped by the block average like any other
    // nodata, so a cell with no echo in it has no value rather than −999 ft.
    echoTopFt: round(at(fields, "echoTop", cell)),
  };
}

/**
 * Compass bearing a vector points **toward**, degrees clockwise from north.
 *
 * Toward rather than from, and the choice is the whole reason this is a
 * function with a comment. Wind is conventionally named by where it comes from
 * and storm motion by where it is going, and a readout that guesses wrong is
 * 180 degrees wrong without looking wrong.
 */
export function bearing(u: number, v: number): number {
  return Math.round(((Math.atan2(u, v) * 180) / Math.PI + 360) % 360);
}

/**
 * The cloud-base sidebar's numbers, against the same 12 km grid the bands are
 * drawn from so the picture and the figures cannot disagree.
 */
export function baseStats(run: Date, hour: number, grid: Grid): CloudBaseStats {
  const [low, high] = BASE_WINDOW_FT;
  const bases: number[] = [];
  let inWindow = 0;

  for (const v of grid.values) {
    if (Number.isNaN(v)) continue;
    bases.push(v);
    if (v >= low && v < high) inWindow++;
  }

  const total = grid.values.length;
  bases.sort((a, b) => a - b);

  return {
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    basePct: Math.round((10000 * bases.length) / total) / 100,
    windowPct: Math.round((10000 * inWindow) / total) / 100,
    windowKm2: inWindow * CELL_KM2,
    medianFt: bases.length
      ? Math.round(bases[Math.floor((bases.length - 1) / 2)])
      : null,
  };
}
