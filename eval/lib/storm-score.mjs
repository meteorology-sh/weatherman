/**
 * How a release scored against the radar storm at that minute.
 *
 * One function, two readers: the eval server publishes the season counts,
 * and the tests pin the yes/no rule so a column cannot drift from a bar.
 * The evaluation map still prints the raw reading on each flare; this file
 * is only the arithmetic.
 *
 * A flare whose painted record has no `storm` key was built before those
 * readings were stored. `attachStorms` copies the hour-pair score onto it
 * when that run exists, so the day's table is not empty. `storm: null` is
 * scored either way: we looked and there was no 20 dBZ echo within about
 * 40 km.
 */

/** Same 10 g/m² contour the liquid layer draws. */
const LIQUID_G_M2 = 10;
const GREW_KM2 = 0.5;
const COLDER_C = -0.5;

export const STORM_TESTS = [
  { key: "inRain", label: "In the rain" },
  { key: "upwind", label: "Upwind of the heaviest rain" },
  { key: "nearerEdge", label: "Nearer the edge than the core" },
  { key: "echoPastFreezing", label: "Echo top past freezing" },
  { key: "grew", label: "Raining area grew" },
  { key: "lightning", label: "Lightning in five minutes" },
  { key: "colderTop", label: "Cloud top colder" },
  { key: "liquidOverStorm", label: "Supercooled liquid over the storm" },
];

/** Same test as the candidate map: within 90° of the opposite of the heading. */
export function upwindOf(coreLat, coreLon, lat, lon, towardDeg) {
  const upwind = (towardDeg + 180) % 360;
  const mid = ((coreLat + lat) / 2) * (Math.PI / 180);
  const dlat = lat - coreLat;
  const dlon = (lon - coreLon) * Math.cos(mid);
  let deg = (Math.atan2(dlon, dlat) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  let delta = Math.abs(deg - upwind);
  if (delta > 180) delta = 360 - delta;
  return delta <= 90;
}

/**
 * Yes / no / cannot-say for each test, or null when the flare was never asked.
 *
 * `true` and `false` are answers. `null` on a key means that test had nothing
 * to read — no heading, no echo top, no previous scan — and it is dropped from
 * the denominator rather than counted as a no.
 */
export function flagsOf(flare) {
  if (!Object.prototype.hasOwnProperty.call(flare, "storm")) return null;
  const storm = flare.storm;
  const empty = {
    inRain: false,
    upwind: null,
    nearerEdge: null,
    echoPastFreezing: null,
    grew: null,
    lightning: null,
    colderTop: null,
    liquidOverStorm: null,
  };
  if (!storm || !storm.object) return empty;

  const toward = storm.object.motionTowardDeg;
  const coreLat = storm.object.coreLat;
  const coreLon = storm.object.coreLon;
  const upwind =
    toward == null || coreLat == null || coreLon == null
      ? null
      : upwindOf(coreLat, coreLon, flare.lat, flare.lon, toward);

  const nearerEdge =
    storm.edgeKm == null || storm.coreKm == null
      ? null
      : storm.edgeKm < storm.coreKm;

  const echoPastFreezing =
    storm.echoTopFt == null || storm.freezingFt == null
      ? null
      : storm.echoTopFt >= storm.freezingFt;

  const delta = storm.object.areaDeltaKm2;
  const grew =
    delta == null
      ? null
      : delta > GREW_KM2
        ? true
        : delta < -GREW_KM2
          ? false
          : null;

  const lightning =
    storm.glmFlashes == null ? null : storm.glmFlashes > 0;

  const colderTop =
    storm.goesTopDeltaC == null
      ? null
      : storm.goesTopDeltaC < COLDER_C
        ? true
        : storm.goesTopDeltaC > -COLDER_C
          ? false
          : null;

  const liquidOverStorm =
    storm.slwGM2 == null ? null : storm.slwGM2 >= LIQUID_G_M2;

  return {
    inRain: Boolean(storm.inside),
    upwind,
    nearerEdge,
    echoPastFreezing,
    grew,
    lightning,
    colderTop,
    liquidOverStorm,
  };
}

/** How many of a set of flares said yes, of those that could say. */
export function tallyFlags(flares) {
  const scored = flares.map(flagsOf).filter(Boolean);
  return STORM_TESTS.map((test) => {
    const answers = scored
      .map((flags) => flags[test.key])
      .filter((value) => value !== null);
    return {
      key: test.key,
      label: test.label,
      n: answers.length,
      yes: answers.filter(Boolean).length,
    };
  });
}

export function summariseDay(date, flares) {
  const scored = flares.filter((flare) => flagsOf(flare) !== null);
  const tests = tallyFlags(flares);
  return {
    date,
    flares: flares.length,
    scored: scored.length,
    tests: Object.fromEntries(tests.map((test) => [test.key, test])),
  };
}

/**
 * The storm reading at the analysis this flare is charged to.
 *
 * `storms.mjs` stores the hour below and the hour above. Paint charges a
 * release to the nearer hour, which is always one of those two.
 */
export function readingAt(row, hour) {
  if (!row) return null;
  if (row.h0 === hour) return row.lo ?? null;
  if (row.h1 === hour) return row.hi ?? null;
  const t = Date.parse(hour);
  const d0 = Math.abs(Date.parse(row.h0) - t);
  const d1 = Math.abs(Date.parse(row.h1) - t);
  return (d0 <= d1 ? row.lo : row.hi) ?? null;
}

/** The shape the map table reads, from one `/candidate/storm` answer. */
export function stormFromReading(reading) {
  if (!reading || reading.error) return null;
  return {
    inside: reading.inside ?? false,
    inWorking: reading.inWorking ?? false,
    coreKm: reading.coreKm ?? null,
    edgeKm: reading.edgeKm ?? null,
    upwindEdgeKm: reading.upwindEdgeKm ?? null,
    object: reading.object
      ? {
          id: reading.object.id,
          maxDbz: reading.object.maxDbz,
          areaKm2: reading.object.areaKm2,
          ageMin: reading.object.ageMin ?? null,
          ageFloor: reading.object.ageFloor ?? false,
          motionTowardDeg: reading.object.motionTowardDeg ?? null,
          motionKmh: reading.object.motionKmh ?? null,
          areaDeltaKm2: reading.object.areaDeltaKm2 ?? null,
          coreLat: reading.object.coreLat,
          coreLon: reading.object.coreLon,
        }
      : null,
    slwGM2: reading.slwGM2 ?? null,
    goesTopC: reading.goesTopC ?? null,
    goesTopDeltaC: reading.goesTopDeltaC ?? null,
    glmFlashes: reading.glmFlashes ?? null,
    echoTopFt: reading.echoTopFt ?? null,
    modelEchoTopFt: reading.modelEchoTopFt ?? null,
    freezingFt: reading.freezingFt ?? null,
  };
}

/**
 * Copy the hour-pair storm onto flares painted before that field existed.
 *
 * Does not overwrite a storm already on the flare, including an explicit
 * null — that is a look that saw no echo, not a missing look.
 */
export function attachStorms(painted, catalog, regionId) {
  if (!painted) return painted;
  const region = catalog?.regions?.find((entry) => entry.id === regionId);
  const day = region?.days?.find((entry) => entry.date === painted.date);
  if (!day?.rows?.length) return painted;
  const byAt = new Map(day.rows.map((row) => [row.at, row]));
  for (const analysis of painted.analyses ?? []) {
    for (const flare of analysis.flares ?? []) {
      if (Object.prototype.hasOwnProperty.call(flare, "storm")) continue;
      const row = byAt.get(flare.at);
      if (!row) continue;
      const reading = readingAt(row, analysis.at);
      if (!reading || reading.error) continue;
      flare.storm = stormFromReading(reading);
    }
  }
  return painted;
}
