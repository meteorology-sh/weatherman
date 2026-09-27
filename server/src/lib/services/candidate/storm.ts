/**
 * The radar storm at a click, with modeled liquid and the observed cloud-top
 * change over that storm — not over the one 3 km column the click snapped to.
 *
 * Motion comes from the previous mosaic. Liquid, the top, and the 18 dBZ
 * echo-top are readings on the object; they are not tests that hide it.
 */

// Services
import { Goes, CLEAR } from "../goes/cloudtop";
import { Glm } from "../goes/lightning";
import { Hrrr } from "../hrrr/forecast";
import { EchoTops } from "../mrms/echotop";
import { nearJson } from "../mrms/objects";
import type { StormObject } from "../mrms/objects";
import { Mrms } from "../mrms/radar";
import { cellAt } from "../shared/grid";

// Types
import type { Geo } from "../shared/contour";

const ANALYSIS_HOUR = 0;

/** One GOES-East CONUS sweep. */
const GOES_PREV_MS = 5 * 60_000;

export type StormReading = ReturnType<typeof nearJson> & {
  /** Highest modeled in-band liquid over the storm, g/m². */
  slwGM2: number | null;
  /** Coldest observed cloud top over the storm, °C. */
  goesTopC: number | null;
  /**
   * Change in that top from the previous sweep, °C. Negative is colder —
   * the top went up or the anvil spread. Null when either sweep is missing.
   */
  goesTopDeltaC: number | null;
  /**
   * Highest measured 18 dBZ echo-top over the storm, ft MSL.
   * Null when no raining cell has an 18 dBZ top, or the feed could not
   * be read.
   */
  echoTopFt: number | null;
  /** Highest modeled echo top over the storm, ft MSL. */
  modelEchoTopFt: number | null;
  /** Freezing level in the column of the echo top that is reported, ft MSL. */
  freezingFt: number | null;
  /**
   * GLM flashes over this storm in the last five minutes. Null when the
   * lightning feed could not be read. Zero means we looked and saw none.
   */
  glmFlashes: number | null;
};

export async function reading(
  lat: number,
  lon: number,
  at?: Date,
  fine = false
): Promise<StormReading | null> {
  const hit = await Mrms.atPoint(lat, lon, at, fine);
  if (!hit) return null;
  const extras = await overStorm(hit.reading.object, hit.geo, at);
  return { ...nearJson(hit.reading), ...extras };
}

/** Singleton the router calls, so tests can stub one method. */
export const Storms = { reading };

async function overStorm(
  storm: StormObject,
  stormGeo: Geo,
  at?: Date
): Promise<{
  slwGM2: number | null;
  goesTopC: number | null;
  goesTopDeltaC: number | null;
  echoTopFt: number | null;
  modelEchoTopFt: number | null;
  freezingFt: number | null;
  glmFlashes: number | null;
}> {
  let slwGM2: number | null = null;
  let goesTopC: number | null = null;
  let goesTopDeltaC: number | null = null;
  let echoTopFt: number | null = null;
  let modelEchoTopFt: number | null = null;
  let freezingFt: number | null = null;
  let glmFlashes: number | null = null;

  const liquidP = Hrrr.liquidField(ANALYSIS_HOUR, at).then((field) => {
    if (!field.values) return;
    slwGM2 = maxOver(storm, stormGeo, field.geo, field.values);
  });

  const echoP = Promise.all([
    EchoTops.tallest(storm, stormGeo, at).catch(() => null),
    Hrrr.diagnosticField("echoTop", ANALYSIS_HOUR, at),
    Hrrr.bandField(ANALYSIS_HOUR, at),
  ]).then(([measured, echo, band]) => {
    const modeled = echo.values
      ? maxCellOver(storm, stormGeo, echo.geo, echo.values)
      : null;
    if (modeled) modelEchoTopFt = Math.round(modeled.value);
    if (measured) {
      echoTopFt = measured.echoTopFt;
      const freeze = band.freezingFt[cellAt(band.geo, measured.lat, measured.lon)];
      freezingFt = Number.isFinite(freeze) ? Math.round(freeze) : null;
    } else if (modeled) {
      const freeze = band.freezingFt[modeled.cell];
      freezingFt = Number.isFinite(freeze) ? Math.round(freeze) : null;
    }
  });

  const glmP = Glm.overStorm(storm, stormGeo, at).then((n) => {
    glmFlashes = n;
  });

  const topsP = Goes.topField(at).then(async (current) => {
    goesTopC = coldestTopC(
      valuesOver(storm, stormGeo, current.geo, current.cells)
    );
    const t = Date.parse(current.validTime);
    if (Number.isNaN(t) || goesTopC === null) return;
    const previous = await Goes.topField(new Date(t - GOES_PREV_MS));
    if (previous.validTime === current.validTime) return;
    const was = coldestTopC(
      valuesOver(storm, stormGeo, previous.geo, previous.cells)
    );
    if (was === null) return;
    goesTopDeltaC = Math.round((goesTopC - was) * 10) / 10;
  });

  await Promise.all([
    liquidP.catch(() => undefined),
    echoP.catch(() => undefined),
    topsP.catch(() => undefined),
    glmP.catch(() => undefined),
  ]);

  return {
    slwGM2,
    goesTopC,
    goesTopDeltaC,
    echoTopFt,
    modelEchoTopFt,
    freezingFt,
    glmFlashes,
  };
}

/**
 * Highest finite value on the 3 km grid that covers this storm's 1 km
 * cells. Nothing is interpolated: each 1 km cell reads the 3 km cell whose
 * footprint contains it.
 */
export function maxOver(
  storm: StormObject,
  stormGeo: Geo,
  fieldGeo: Geo,
  values: Float32Array
): number | null {
  const hit = maxCellOver(storm, stormGeo, fieldGeo, values);
  return hit ? Math.round(hit.value * 10) / 10 : null;
}

/** The 3 km cell of the highest finite value covering this storm. */
export function maxCellOver(
  storm: StormObject,
  stormGeo: Geo,
  fieldGeo: Geo,
  values: Float32Array
): { value: number; cell: number } | null {
  const seen = new Set<number>();
  let seed: number | undefined;
  let best: { value: number; cell: number } | null = null;
  for (const k of storm.cells) {
    seed = cellAt(fieldGeo, stormGeo.lats[k], stormGeo.lons[k], seed);
    if (seen.has(seed)) continue;
    seen.add(seed);
    const v = values[seed];
    if (!Number.isFinite(v)) continue;
    if (!best || v > best.value) best = { value: v, cell: seed };
  }
  return best;
}

/** Coldest cloudy top in a list of coldness values, as a temperature. */
export function coldestTopC(coldness: number[]): number | null {
  let max = -Infinity;
  for (const v of coldness) {
    if (v <= CLEAR) continue;
    if (v > max) max = v;
  }
  if (!Number.isFinite(max)) return null;
  return Math.round(-max * 10) / 10;
}

export function valuesOver(
  storm: StormObject,
  stormGeo: Geo,
  fieldGeo: Geo,
  field: { values: Float32Array }
): number[] {
  const out: number[] = [];
  const seen = new Set<number>();
  let seed: number | undefined;
  for (const k of storm.cells) {
    seed = cellAt(fieldGeo, stormGeo.lats[k], stormGeo.lons[k], seed);
    if (seen.has(seed)) continue;
    seen.add(seed);
    const v = field.values[seed];
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}
