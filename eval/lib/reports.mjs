/**
 * A WTWMA daily operations report, as data.
 *
 * The part that matters is the `Flight Information` table: every flare
 * release with a UTC minute and a position to four decimal places. That is
 * the ground truth the whole evaluation is scored against, and it is the one
 * thing here that must be parsed exactly rather than approximately.
 *
 * The narrative is read out too, but loosely — the pilot's reported cloud
 * bases and the TITAN cell attributes come back as timestamped sentences for
 * a human to read beside the point results, not as fields to diff. Matching a
 * sentence to a release automatically would invent a precision the prose does
 * not have.
 */

/**
 * The counties WTWMA and the Rolling Plains project fly over.
 *
 * Used to end a table row rather than to validate one: a county name is the
 * last field, some are two words, and the next row's time follows immediately
 * with nothing between them. Matching against the list is what tells "Tom
 * Green 1957" from "Green" followed by a stray number.
 */
const COUNTIES = [
  "Tom Green",
  "Baylor",
  "Coke",
  "Concho",
  "Crane",
  "Crockett",
  "Fisher",
  "Glasscock",
  "Haskell",
  "Howard",
  "Irion",
  "Jones",
  "Knox",
  "Menard",
  "Midland",
  "Mitchell",
  "Nolan",
  "Pecos",
  "Reagan",
  "Runnels",
  "Schleicher",
  "Scurry",
  "Sterling",
  "Sutton",
  "Terrell",
  "Upton",
];

const COUNTY = COUNTIES.map((name) => name.replace(" ", "\\s+")).join("|");

/**
 * `1919 49P 31.1272 / -101.7577 3G + 1H Reagan`
 *
 * **The position is optional, and that is not tidiness.** On 21 August two
 * rows carry a time, a plane, a payload and a county with no coordinates at
 * all. Requiring the position drops them, and the flare totals then disagree
 * with the report's own summary by exactly those four flares — which is how
 * they were found. They are real releases that cannot be scored as points,
 * and `located` is what tells the two apart.
 */
const RELEASE = new RegExp(
  String.raw`(\d{4})\s+(\w*\d+[A-Z])\s+(?:(-?\d+\.\d+)\s*/\s*(-?\d+\.\d+)\s+)?` +
    String.raw`((?:\d+\s*[GH])(?:\s*\+\s*\d+\s*[GH])*)\s+(${COUNTY})`,
  "g"
);

/** The prose total that closes the table, e.g. `Tom Green (15G + 1H)`. */
const CLAIMED = new RegExp(
  String.raw`(${COUNTY})\s*\(\s*((?:\d+\s*[GH])(?:\s*\+\s*\d+\s*[GH])*)\s*\)`,
  "g"
);

/** `At 1838Z, …` — the narrative's only reliable structure. */
const MOMENT = /At\s+(\d{3,4})Z?,\s*([^]*?)(?=\s+At\s+\d{3,4}Z?,|$)/g;

const MONTHS = {
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
};

/** Sounding rows are `LABEL KMAF KDRT`, two per line in the source table. */
const INDICES = [
  ["freezingLevelM", String.raw`Freezing\s+Level\s+\(m\)`],
  ["minus15HeightM", String.raw`-15.?C\s+Height\s+\(m\)`],
  ["lclM", String.raw`LCL\s+\(m\)`],
  ["cclM", String.raw`CCL\s+\(m\)`],
  ["cloudBaseM", String.raw`Cloud\s+Base\s+\(m\)`],
  ["cloudBaseTempC", String.raw`Cloud\s+Base\s+Temp\s+\(.?C\)`],
  ["warmCloudDepthM", String.raw`Warm\s+Cloud\s+Depth\s+\(m\)`],
  ["capeJKg", String.raw`CAPE\s+\(J/kg\)`],
  ["temp700Mb", String.raw`700\s+mb\s+Temp\s+\(.?C\)`],
];

/** `16.5-17.5 km, 93-287 kg/m2, 63-72 dBZ` — TITAN, as the report prints it. */
const CELL = new RegExp(
  String.raw`([\d.]+)\s*(?:-\s*([\d.]+))?\s*(km|kft)\s*,\s*` +
    String.raw`([\d.]+)\s*(?:-\s*([\d.]+))?\s*kg/m2\s*,\s*` +
    String.raw`(\d+)\s*(?:-\s*(\d+))?\s*dBZ`
);

/** `bases 4000 ft` / `bases are 6000 ft (1830 m)` */
const PILOT_BASE = /bases?\s+(?:are\s+)?([\d,]+)\s*ft/i;

function range(low, high) {
  const from = Number(low);
  return high === undefined ? [from, from] : [from, Number(high)];
}

/** `1843` → minutes past midnight UTC, so a sortie past 0000Z still sorts. */
function parseHhmm(text) {
  const padded = text.padStart(4, "0");
  return { hour: Number(padded.slice(0, 2)), minute: Number(padded.slice(2)) };
}

/**
 * The UTC instant of a release.
 *
 * A report covers one operational day and its sorties can run past midnight —
 * 11 August's second sortie lands at 0005Z. A time earlier than the day's
 * first release belongs to the next calendar day.
 */
function instant(date, hhmm, firstHour) {
  const { hour, minute } = parseHhmm(hhmm);
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCHours(hour, minute, 0, 0);
  if (hour < firstHour - 12) at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString();
}

function parseFlares(text) {
  let glaciogenic = 0;
  let hygroscopic = 0;
  for (const [, count, kind] of text.matchAll(/(\d+)\s*([GH])/g)) {
    if (kind === "G") glaciogenic += Number(count);
    else hygroscopic += Number(count);
  }
  return { glaciogenic, hygroscopic };
}

export function parseDate(text) {
  const match = text.match(
    /Seeding\s+Report\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/
  );
  if (!match) return null;
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${match[3]}-${pad(month)}-${pad(Number(match[2]))}`;
}

export function parseSoundings(text) {
  const soundings = { KMAF: {}, KDRT: {} };
  for (const [field, label] of INDICES) {
    const match = text.match(
      new RegExp(`${label}\\s+(-?[\\d.]+)(?:\\s+(-?[\\d.]+))?`)
    );
    if (!match) continue;
    soundings.KMAF[field] = Number(match[1]);
    if (match[2] !== undefined) soundings.KDRT[field] = Number(match[2]);
  }
  return soundings;
}

/**
 * Every flare release, in order.
 *
 * Read from the `Flight Information` heading onward. The narrative above it
 * quotes times and counties in the same breath and would otherwise offer up
 * near-misses; the table is the only place a position appears.
 */
export function parseReleases(text, date) {
  const table = flightTable(text);
  if (!table) return [];

  const rows = [...table.matchAll(RELEASE)];
  if (rows.length === 0) return [];

  const firstHour = parseHhmm(rows[0][1]).hour;

  return rows.map(([, hhmm, plane, lat, lon, flares, county]) => ({
    at: instant(date, hhmm, firstHour),
    timeZ: hhmm.padStart(4, "0"),
    plane,
    located: lat !== undefined,
    lat: lat === undefined ? null : Number(lat),
    lon: lon === undefined ? null : Number(lon),
    ...parseFlares(flares),
    county: county.replace(/\s+/g, " "),
  }));
}

/**
 * The table only, without the sentence that closes it.
 *
 * That sentence repeats every county with a flare count in the same shape a
 * row ends in, and the whole point of `parseTotals` is to compare the two —
 * so the table must not be allowed to read its own summary back as data.
 */
function flightTable(text) {
  const start = text.indexOf("Flight Information");
  if (start < 0) return null;
  const body = text.slice(start);
  const end = body.search(/Seeding\s+operations\s+were\s+conducted/);
  return end < 0 ? body : body.slice(0, end);
}

/**
 * The per-county flare counts the report claims in prose, for cross-checking
 * against the table.
 *
 * They do not always agree. On 26 May the prose says Irion took 53 glaciogenic
 * flares, and its own stated day total of 95 only works if Irion took 51 —
 * which is what the table sums to. The table is the record; this is here to
 * make the disagreement visible rather than to correct anything.
 */
export function parseTotals(text) {
  const start = text.search(/Seeding\s+operations\s+were\s+conducted/);
  if (start < 0) return {};

  const totals = {};
  for (const [, county, flares] of text.slice(start).matchAll(CLAIMED)) {
    totals[county.replace(/\s+/g, " ")] = parseFlares(flares);
  }
  return totals;
}

/**
 * What the narrative said, and when.
 *
 * Only the moments carrying something comparable to a field the app reads are
 * kept: a TITAN cell triple, or a pilot's cloud base. The sentence rides along
 * because the numbers alone lose which cell was being described.
 */
export function parseObservations(text, date) {
  const narrative = text.slice(
    0,
    text.indexOf("Flight Information") + 1 || undefined
  );
  const out = [];

  for (const [, hhmm, body] of narrative.matchAll(MOMENT)) {
    const said = body.replace(/\s+/g, " ").trim().slice(0, 400);
    const cell = said.match(CELL);
    const base = said.match(PILOT_BASE);
    if (!cell && !base) continue;

    out.push({
      at: instant(date, hhmm, 0),
      timeZ: hhmm.padStart(4, "0"),
      said,
      ...(cell && {
        echoTop: { range: range(cell[1], cell[2]), unit: cell[3] },
        vilKgM2: range(cell[4], cell[5]),
        dbz: range(cell[6], cell[7]),
      }),
      ...(base && { pilotCloudBaseFt: Number(base[1].replace(/,/g, "")) }),
    });
  }

  return out;
}

/** One report, parsed. `seeded` is false for the `_NS` days. */
export function parseReport(text, fallbackDate) {
  const date = parseDate(text) ?? fallbackDate;
  if (!date) throw new Error("no date in report, and no fallback given");

  const releases = parseReleases(text, date);

  return {
    date,
    seeded: releases.length > 0,
    soundings: parseSoundings(text),
    releases,
    claimed: parseTotals(text),
    dayTotal: parseDayTotal(text),
    observations: parseObservations(text, date),
  };
}

/** The table's own flare totals for a day. */
export function sumReleases(releases) {
  return releases.reduce(
    (total, release) => ({
      glaciogenic: total.glaciogenic + release.glaciogenic,
      hygroscopic: total.hygroscopic + release.hygroscopic,
    }),
    { glaciogenic: 0, hygroscopic: 0 }
  );
}

/**
 * The day total the report states, e.g. "43 glaciogenic flares and 2
 * hygroscopic flares were burned within 8 clouds".
 *
 * This is the figure to check the table against, and it is a stronger check
 * than the per-county one: the county breakdown is hand-tallied and drifts by
 * a flare or two, but the day total is the number the operator reports to
 * TDLR.
 */
export function parseDayTotal(text) {
  const match = text.match(
    /(\d+)\s+glaciogenic\s+flares?\s+and\s+(\d+)\s+hygroscopic\s+flares?\s+were\s+burned\s+within\s+(\d+)/i
  );
  if (!match) return null;
  return {
    glaciogenic: Number(match[1]),
    hygroscopic: Number(match[2]),
    clouds: Number(match[3]),
  };
}

/**
 * Where the table and the prose disagree about a county's flare count.
 *
 * Returns one line per disagreement, empty when they match. A disagreement is
 * a fact about the source document and belongs in the output; the table wins,
 * because it is the thing with a position and a minute on every row.
 */
export function reconcile(report) {
  const summed = {};
  for (const release of report.releases) {
    const county = (summed[release.county] ??= {
      glaciogenic: 0,
      hygroscopic: 0,
    });
    county.glaciogenic += release.glaciogenic;
    county.hygroscopic += release.hygroscopic;
  }

  const out = [];
  for (const [county, claimed] of Object.entries(report.claimed)) {
    const table = summed[county] ?? { glaciogenic: 0, hygroscopic: 0 };
    if (
      table.glaciogenic === claimed.glaciogenic &&
      table.hygroscopic === claimed.hygroscopic
    ) {
      continue;
    }
    out.push(
      `${county}: table ${table.glaciogenic}G+${table.hygroscopic}H, ` +
        `prose ${claimed.glaciogenic}G+${claimed.hygroscopic}H`
    );
  }
  return out;
}
