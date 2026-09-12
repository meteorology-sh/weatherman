/**
 * A daily operations report, as data.
 *
 * Four of the five Texas programs file the same document, so one parser
 * reads them all. What differs between them arrives as a profile rather than
 * being baked in here: the county list, how many sounding sites the indices
 * table carries, the window a position has to fall inside, and the point a
 * bearing and a range are measured from.
 *
 * The part that matters is the `Flight Information` table: every flare release
 * with a UTC minute and a position. That is the record the whole
 * evaluation is scored against, and it is the one thing here that must be
 * parsed exactly rather than approximately. **How the position is written is
 * the thing that varies most**, five ways across the five programs and
 * sometimes twice within one season, so it is read by trying the spellings in
 * turn rather than by telling each region which one it uses.
 *
 * The narrative is read out too, but loosely — the pilot's reported cloud
 * bases and the TITAN cell attributes come back as timestamped sentences for
 * a human to read beside the point results, not as fields to diff. Matching a
 * sentence to a release automatically would invent a precision the prose does
 * not have.
 */

// Local
import { projectRadial } from "./geo.mjs";

/**
 * A county name is what ends a table row.
 *
 * Used to end a row rather than to validate one: the county is the last field,
 * some names are two words, and the next row's time follows immediately with
 * nothing between them. Matching against the program's own list is what tells
 * "Tom Green 1957" from "Green" followed by a stray number. The list is the
 * region's, from `data/regions.json`.
 */
const county = (counties) =>
  counties.map((name) => name.replace(" ", "\\s+")).join("|");

/**
 * How a program writes down where a flare went.
 *
 * Six spellings across the programs and seasons, and two of them can appear in
 * one season: South Texas prints degrees in March and a radial from April on, and
 * the Rolling Plains stop writing the hemisphere out halfway through June. So
 * the spellings are tried in turn rather than fixed per region, and the reader
 * takes whichever one the row is written in.
 *
 * **A radial is only placed where the region says what it is measured from.**
 * `32.43X101.12` and `270X35` are the same shape and mean entirely different
 * things — a place, and a bearing and a range to a place. The decimal point is
 * what tells them apart, so `32.43X101.12` is never read as a bearing and
 * `270X35` is never read as a latitude. A radial in a region with no origin
 * keeps its printed bearing and range and is not located: the release is real,
 * and nothing on the record says where it was measured from.
 */
const SPELLINGS = [
  // `31.1272 / -101.7577` — West Texas and Trans-Pecos, signed.
  {
    at: /^(-?\d+\.\d+)\s*\/\s*(-?\d+\.\d+)/,
    read: ([lat, lon]) => [Number(lat), Number(lon)],
  },
  // `29.51ºN 99.93ºW` and `32.69NX100.47W` — the hemisphere written out.
  {
    at: /^(\d+\.\d+)\s*[º°o]?\s*N\s*[xX]?\s*(\d+\.\d+)\s*[º°o]?\s*W/,
    read: ([lat, lon]) => [Number(lat), -Number(lon)],
  },
  // `32.43X101.12` and `32.36, 100.38` — the Rolling Plains, which stop
  // writing the hemisphere and then the X, and are west of the meridian
  // throughout.
  {
    at: /^(\d+\.\d+)\s*[xX,]\s*(\d+\.\d+)/,
    read: ([lat, lon]) => [Number(lat), -Number(lon)],
  },
  // `198° @ 56 nm` — a bearing and a range, written out.
  {
    at: /^(\d{1,3})\s*°\s*@\s*(\d{1,3})\s*nm\b/,
    radial: true,
  },
  // `270X35` — a bearing in degrees and a range in nautical miles.
  {
    at: /^(\d{1,3})\s*[xX]\s*(\d{1,3})(?!\S)/,
    radial: true,
  },
];

/**
 * The position a row opens with, how much of the row it took up, and the
 * bearing and range as printed when it is a radial — or nothing if the row
 * opens with something else.
 */
function parsePosition(cell, origin) {
  for (const spelling of SPELLINGS) {
    const found = cell.match(spelling.at);
    if (!found) continue;
    if (!spelling.radial) {
      return {
        at: spelling.read(found.slice(1)),
        printed: null,
        read: found[0].length,
      };
    }
    const printed = { bearingDeg: Number(found[1]), rangeNm: Number(found[2]) };
    return {
      at: origin
        ? projectRadial(origin, printed.bearingDeg, printed.rangeNm)
        : null,
      printed,
      read: found[0].length,
    };
  }
  return null;
}

/** `3G + 1H` — what the row says was burned, where the table has a column for it. */
const PAYLOAD = /^(?:\d+\s*[GH])(?:\s*\+\s*\d+\s*[GH])*(?!\S)/;

/**
 * Where a row of the flight table starts: a UTC minute and an aircraft.
 *
 * Everything between one of these and the next is that release's own cell, and
 * that is how the row is read — the fields inside it differ by program, and
 * anchoring on all of them at once made the pattern depend on how many
 * spellings of a position there happened to be.
 *
 * **A time cannot start inside a number.** The last four digits of
 * `-101.3835 2G` are a four-digit run followed by something shaped like an
 * aircraft, and without the guard every West Texas row is cut in half at its
 * own longitude.
 */
const ROW = /(?<![\d.])(\d{4})\s+(\w*\d+[A-Z])\s+/g;

/**
 * One row of the flight table.
 *
 * **The position is optional, and that is not tidiness.** On 21 August two
 * West Texas rows carry a time, a plane, a payload and a county with no
 * coordinates at all. Requiring the position drops them, and the flare totals
 * then disagree with the report's own summary by exactly those four flares —
 * which is how they were found. They are real releases that cannot be scored
 * as points, and `located` is what tells the two apart.
 *
 * **The payload is optional for the opposite reason.** South Texas and the
 * Rolling Plains file a row per seeding pass and print no flare count on it;
 * the counts are in the closing sentence, over the whole day and per county.
 * Those releases are real and their payload is unknown, which is not the same
 * as zero, so it comes back as nothing rather than as a number nobody wrote.
 *
 * A row with neither is not a release. `1747 41P IN AIR` and `2120 60P RTB`
 * are in the same table and are the sortie, not a flare.
 */
function parseRow(cell, counties, origin) {
  const where = parsePosition(cell, origin);
  const flares = cell
    .slice(where ? where.read : 0)
    .trimStart()
    .match(PAYLOAD);
  if (!where && !flares) return null;

  const named = cell.match(new RegExp(`\\b(${county(counties)})\\b`));

  return {
    lat: where?.at ? where.at[0] : null,
    lon: where?.at ? where.at[1] : null,
    printed: where ? where.printed : null,
    flares: flares ? parseFlares(flares[0]) : null,
    county: named ? named[1].replace(/\s+/g, " ") : null,
  };
}

/** The prose total that closes the table, e.g. `Tom Green (15G + 1H)`. */
const claimed = (counties) =>
  new RegExp(
    String.raw`(${county(counties)})\s*\(\s*((?:\d+\s*[GH])(?:\s*\+\s*\d+\s*[GH])*)\s*\)`,
    "g"
  );

/** `At 1838Z, …` — the narrative's only reliable structure. */
/**
 * `2027 26P (2G) JD` — the table Trans-Pecos filed on its first day of 2025.
 *
 * Time, aircraft, flare count in brackets, and a county the report abbreviates
 * and never expands. **It is a fallback, not an alternative**: it runs only when
 * the standard table yields nothing, because a row with no position would
 * otherwise swallow rows that have one. The releases it finds are real and
 * unlocated, and the county is left out rather than guessed from two letters.
 */
const BRACKETED =
  /(\d{4})\s+(\w*\d+[A-Z])\s+[^()\d]*(?:\d+°?\s*\d*)?\s*\((\d+\s*[GH](?:\s*\+\s*\d+\s*[GH])*)\)/g;

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

/**
 * Sounding rows are `LABEL KMAF KDRT`, two per line in the source table.
 *
 * The label is written a little differently by program — `(m)` in the north
 * and `(meters)` in the south, `LCL` with the unit and without, `J/kg` and
 * `J/Kg` — and every one of those is the same reading. A label that does not
 * match drops the reading silently, which is how South Texas came to have no
 * cloud base for a season.
 */
const Meters = String.raw`\(m(?:eters)?\)`;

const INDICES = [
  ["freezingLevelM", String.raw`Freezing\s+Level\s+${Meters}`],
  ["minus15HeightM", String.raw`-15.?C\s+Height\s+${Meters}`],
  ["lclM", String.raw`LCL(?:\s+${Meters})?`],
  ["cclM", String.raw`CCL(?:\s+${Meters})?`],
  ["cloudBaseM", String.raw`Cloud\s+Base\s+${Meters}`],
  ["cloudBaseTempC", String.raw`Cloud\s+Base\s+Temp\s+\(.?C\)`],
  ["warmCloudDepthM", String.raw`Warm\s+Cloud\s+Depth\s+${Meters}`],
  ["capeJKg", String.raw`CAPE\s+\(J/[Kk]g\)`],
  ["temp700Mb", String.raw`700\s+mb\s+Temp\s+\(.?C\)`],
];

/**
 * Instability is deliberately not read.
 *
 * The reports print CINH, LI and precipitable water beside the heights, and one
 * West Texas row reads `CINH (J/kg) 59975 125` — two columns whose first value
 * cannot be a real inhibition. Whether that is the operator's typo or two
 * numbers run together in the PDF, nothing in the product leans on those fields,
 * so reading them would add a number that has to be doubted for no reader.
 */

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
 * A report covers one local operating day and prints its times in UTC, so an
 * evening sortie runs past midnight UTC and a report can hold nothing but
 * times after 00Z — 6 May is two rows at 0030Z and 0032Z and nothing else.
 * Seeding here runs from mid-afternoon to a few hours after sunset, 15Z
 * through 06Z, so a row before midday belongs to the next calendar day.
 */
export function instant(date, hhmm) {
  const { hour, minute } = parseHhmm(hhmm);
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCHours(hour, minute, 0, 0);
  if (hour < 12) at.setUTCDate(at.getUTCDate() + 1);
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

/** Small counts are sometimes spelled out: "One hygroscopic flare was burned". */
const WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
};

const NUMBER = `(\\d+|${Object.keys(WORDS).join("|")})`;

const number = (text) => WORDS[text.toLowerCase()] ?? Number(text);

/** `43 glaciogenic`, `One hygroscopic`, `24glaciogenic` — or nothing. */
function countBefore(sentence, kind) {
  const match = sentence.match(new RegExp(`${NUMBER}\\s*${kind}`, "i"));
  return match ? number(match[1]) : null;
}

/**
 * `Seeding Report September 27, 2025`, and the ways the others punctuate it.
 *
 * South Texas and the Rolling Plains put an en dash after `Report`, and South
 * Texas puts a comma after the month on two days in March. Both are typing,
 * not meaning.
 */
const HEADED = String.raw`Seeding\s+Report\s*[-–—]?\s*([A-Za-z]+),?\s+(\d{1,2}),\s*(\d{4})`;

function dateOf(match) {
  const month = MONTHS[match[1].toLowerCase()];
  if (!month) return null;
  const pad = (n) => String(n).padStart(2, "0");
  return `${match[3]}-${pad(month)}-${pad(Number(match[2]))}`;
}

export function parseDate(text) {
  const match = text.match(new RegExp(HEADED));
  return match ? dateOf(match) : null;
}

/**
 * A document holding a run of daily reports, split into its days.
 *
 * The Rolling Plains publish one file a season and the Panhandle one a month;
 * a day is a heading and everything under it until the next heading. A file
 * holding a single day comes back as one section, so the caller does not have
 * to know which kind it has.
 */
export function splitReports(text) {
  const headings = [...text.matchAll(new RegExp(HEADED, "g"))];
  return headings.map((heading, index) => ({
    date: dateOf(heading),
    text: text.slice(heading.index, headings[index + 1]?.index ?? text.length),
  }));
}

/**
 * The indices table, one column per sounding site the region briefs on.
 *
 * **How many columns there are has to be told, not guessed.** West Texas prints
 * Midland and Del Rio side by side; Trans-Pecos prints Midland alone and packs
 * two label/value pairs onto a line, so a parser that hopefully reads a second
 * number off a one-site table picks up the next label instead — `-15` from
 * `-15°C Height` becomes a freezing level at Del Rio.
 */
export function parseSoundings(text, sites) {
  const soundings = Object.fromEntries(sites.map((site) => [site, {}]));

  for (const [field, label] of INDICES) {
    // The first column has to be there; a site that did not fly a balloon that
    // morning leaves its column blank rather than the row out.
    const columns =
      String.raw`\s+(-?[\d.]+)` +
      sites
        .slice(1)
        .map(() => String.raw`(?:\s+(-?[\d.]+))?`)
        .join("");
    const match = text.match(new RegExp(`${label}${columns}`));
    if (!match) continue;
    sites.forEach((site, index) => {
      if (match[index + 1] !== undefined) {
        soundings[site][field] = Number(match[index + 1]);
      }
    });
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
export function parseReleases(text, date, profile) {
  const table = flightTable(text);
  if (!table) return [];

  const starts = [...table.matchAll(ROW)];
  const releases = [];

  for (const [index, start] of starts.entries()) {
    const from = start.index + start[0].length;
    const to = starts[index + 1]?.index ?? table.length;
    const row = parseRow(
      table.slice(from, to),
      profile.counties,
      profile.origin
    );
    if (row) releases.push({ hhmm: start[1], plane: start[2], ...row });
  }

  if (releases.length === 0) return bracketed(table, date);

  return releases.map(({ hhmm, plane, lat, lon, printed, flares, county }) => ({
    at: instant(date, hhmm),
    timeZ: hhmm.padStart(4, "0"),
    plane,
    located: lat !== null && inside(lat, lon, profile.window),
    lat,
    lon,
    // As printed, so the projection can be redone from the source.
    ...(printed && printed),
    glaciogenic: flares ? flares.glaciogenic : null,
    hygroscopic: flares ? flares.hygroscopic : null,
    county,
  }));
}

/**
 * Whether a printed position is one the region could have flown.
 *
 * **A position outside the region's window is kept and not scored.** Trans-Pecos
 * prints `-1033.7377` for one release on 30 June, between two rows reading
 * -103.74 — a digit typed twice. Correcting it would be inventing a coordinate;
 * dropping the row would move the day's flare count away from the total the
 * report states three lines later. So the number stays exactly as printed and
 * `located` says it cannot be put on a map, the same way a row with no position
 * at all is handled.
 */
function inside(lat, lon, window) {
  if (!window) return true;
  return (
    lon >= window.west &&
    lon <= window.east &&
    lat >= window.south &&
    lat <= window.north
  );
}

/** The earlier table, read only when the current one finds nothing. */
function bracketed(table, date) {
  const rows = [...table.matchAll(BRACKETED)];
  if (rows.length === 0) return [];

  return rows.map(([, hhmm, plane, flares]) => ({
    at: instant(date, hhmm),
    timeZ: hhmm.padStart(4, "0"),
    plane,
    located: false,
    lat: null,
    lon: null,
    ...parseFlares(flares),
    county: null,
  }));
}

/**
 * The heading the flight table sits under.
 *
 * **Matched a letter at a time, because it is not always one run.** The
 * Rolling Plains reports are edited in Word, which splits a word into pieces
 * and draws them at different places on the page; across the season's seven
 * days this heading arrives whole, as `Flight Inform` and `ation`, and as `F`
 * and `light Information`. Where the break falls is not predictable, so
 * nothing is assumed about it beyond the letters being in order. Everything
 * after the heading is the table either way.
 */
const loosely = (word) => word.split("").join(String.raw`\s*`);

const HEADING = new RegExp(`${loosely("Flight")}\\s*${loosely("Information")}`);

/** The table's own column headings, `TIME (Z) Plane Flare Location County`. */
const COLUMNS = /TIME\s*\(Z\)\s*Plane/i;

/**
 * The table only, without the sentence that closes it.
 *
 * That sentence repeats every county with a flare count in the same shape a
 * row ends in, and the whole point of `parseTotals` is to compare the two —
 * so the table must not be allowed to read its own summary back as data.
 *
 * **The heading does not always come first.** A Word report can hold the
 * table's grid ahead of the heading paragraph in its body, so the table starts
 * at whichever comes first: the heading, or the table's own column headings.
 */
function flightTable(text) {
  const found = [text.search(HEADING), text.search(COLUMNS)].filter(
    (at) => at >= 0
  );
  if (!found.length) return null;
  const start = Math.min(...found);
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
export function parseTotals(text, counties) {
  const start = text.search(/Seeding\s+operations\s+were\s+conducted/);
  if (start < 0) return {};

  const totals = {};
  for (const [, name, flares] of text
    .slice(start)
    .matchAll(claimed(counties))) {
    totals[name.replace(/\s+/g, " ")] = parseFlares(flares);
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
  const end = text.search(HEADING);
  const narrative = text.slice(0, end < 0 ? undefined : end);
  const out = [];

  for (const [, hhmm, body] of narrative.matchAll(MOMENT)) {
    const said = body.replace(/\s+/g, " ").trim().slice(0, 400);
    const cell = said.match(CELL);
    const base = said.match(PILOT_BASE);
    if (!cell && !base) continue;

    out.push({
      at: instant(date, hhmm),
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

/**
 * One report, parsed. `seeded` is false for the `_NS` days.
 *
 * `profile` is the region's own reading of the layout: which counties end a
 * table row, which sounding sites the indices table has a column for, and the
 * window a position has to fall in to be one the region could have flown.
 */
export function parseReport(text, fallbackDate, profile) {
  const date = parseDate(text) ?? fallbackDate;
  if (!date) throw new Error("no date in report, and no fallback given");

  const releases = parseReleases(text, date, profile);

  return {
    date,
    seeded: releases.length > 0,
    soundings: parseSoundings(text, profile.sounding),
    releases,
    claimed: parseTotals(text, profile.counties),
    dayTotal: parseDayTotal(text),
    observations: parseObservations(text, date),
  };
}

/** The table's own flare totals for a day. */
export function sumReleases(releases) {
  return releases.reduce(
    (total, release) => ({
      glaciogenic: total.glaciogenic + (release.glaciogenic ?? 0),
      hygroscopic: total.hygroscopic + (release.hygroscopic ?? 0),
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
 *
 * **The sentence is written by hand and comes in every shape a person writes.**
 * A day with no salt flares names only the glaciogenic ones; a day with one
 * flare spells the number as a word; one report reads `24glaciogenic` with the
 * space missing. Reading only the fullest form leaves the check off on nearly
 * half the days in a season, which is where it is most wanted.
 */
export function parseDayTotal(text) {
  const sentence = text.match(/[^.]*\bburned\s+within\b[^.]*/i)?.[0];
  if (!sentence) return null;

  const glaciogenic = countBefore(sentence, "glaciogenic");
  const hygroscopic = countBefore(sentence, "hygroscopic");
  if (glaciogenic === null && hygroscopic === null) return null;

  const clouds = sentence.match(
    new RegExp(String.raw`within\s+${NUMBER}(?:\s+\w+)?\s+clouds?`, "i")
  );

  return {
    glaciogenic: glaciogenic ?? 0,
    hygroscopic: hygroscopic ?? 0,
    clouds: clouds ? number(clouds[1]) : null,
  };
}

/**
 * Where the table and the prose disagree about a county's flare count.
 *
 * Returns one line per disagreement, empty when they match. A disagreement is
 * a fact about the source document and belongs in the output; the table wins,
 * because it is the thing with a position and a minute on every row.
 */
export function countDisagreements(report) {
  const summed = {};
  for (const release of report.releases) {
    const county = (summed[release.county] ??= {
      glaciogenic: 0,
      hygroscopic: 0,
    });
    county.glaciogenic += release.glaciogenic ?? 0;
    county.hygroscopic += release.hygroscopic ?? 0;
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
