/**
 * A Panhandle Groundwater Conservation District month, as days.
 *
 * **The district publishes by month, and its report is a different document
 * from West Texas's**, which is why this is its own reader rather than another
 * profile in `reports.mjs`. Three things differ and each one changes what can
 * be said about a release:
 *
 * - **Position is a bearing and a range, not a latitude and a longitude.** The
 *   table reads `109° @ 13 nm`, which is where the cell sat on the radar
 *   display. `project()` turns that into a point; the origin it is measured
 *   from is the caller's to supply, and `data/regions.json` carries it.
 * - **Flare counts are in the prose, not the table.** A row says a flare was
 *   released and not how many, so a release here carries no count and the day's
 *   total comes from the monthly operations report instead.
 * - **The indices are a model forecast**, the 12Z NAM valid at 21Z over
 *   Amarillo, rather than a balloon ascent. They say what the meteorologist
 *   planned against. They are not an observation and nothing may be checked
 *   against them the way the West Texas soundings are.
 */

// Local
import { project } from "./geo.mjs";

/** `SEEDING REPORT June 02, 2025` opens each day inside a monthly file. */
const DAY = /SEEDING\s+REPORT\s+([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/g;

/** `2056 N5359P 109° @ 13 nm Armstrong` */
const RELEASE =
  /(\d{4})\s+(N\d+[A-Z]?)\s+(\d{1,3})°\s*@\s*(\d{1,3})\s*nm\s+([A-Z][a-z]+)/g;

/** `1804 N5359P IN AIR` — a sortie starting, which is not a release. */
const AIRBORNE = /(\d{4})\s+(N\d+[A-Z]?)\s+IN\s+AIR/g;

/** `2 27 + 4H Armstrong, Carson, Donley` in the monthly operations report. */
const DAY_TOTAL =
  /(\d{1,2})\s+(\d+)(?:\s*\+\s*(\d+)\s*H)?\s+([A-Z][a-z]+(?:,\s*[A-Z][a-z]+)*)/g;

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

/** The forecast rows worth carrying. Heights are metres above sea level. */
const INDICES = [
  ["freezingLevelM", String.raw`Freezing\s+Level\s+\(m,MSL\)`],
  ["minus5HeightM", String.raw`-5.?C\s+Height\s+\(m,MSL\)`],
  ["minus10HeightM", String.raw`-10.?C\s+Height\s+\(m,MSL\)`],
  ["cloudBaseM", String.raw`Cloud\s+Base\s+\(m,MSL\)`],
  ["warmCloudDepthM", String.raw`Warm\s+Cloud\s+Depth\s+\(m\)`],
  ["cloudBaseTempC", String.raw`Cloud\s+Base\s+Temp\s+\(.?C\)`],
  ["lclM", String.raw`LCL\s+\(m,MSL\)`],
  ["cclM", String.raw`CCL\s+\(m,MSL\)`],
  ["mlCapeJKg", String.raw`ML\s+CAPE\s+\(J/kg\)`],
  ["sbCapeJKg", String.raw`SB\s+CAPE\s+\(J/kg\)`],
];

const pad = (n) => String(n).padStart(2, "0");

/**
 * The UTC instant of a row.
 *
 * A report is a local operating day and its times are UTC, so an evening sortie
 * runs past midnight UTC and a report dated the 22nd can hold nothing but times
 * after 00Z. Seeding here runs from mid-afternoon to a few hours after sunset —
 * 18Z through 06Z — so a row before midday belongs to the next calendar day.
 */
function instant(date, hhmm) {
  const hour = Number(hhmm.slice(0, 2));
  const at = new Date(`${date}T00:00:00Z`);
  at.setUTCHours(hour, Number(hhmm.slice(2)), 0, 0);
  if (hour < 12) at.setUTCDate(at.getUTCDate() + 1);
  return at.toISOString();
}

function parseIndices(text) {
  const indices = {};
  for (const [field, label] of INDICES) {
    const match = text.match(new RegExp(`${label}\\s+(-?[\\d.]+)`));
    if (match) indices[field] = Number(match[1]);
  }
  return indices;
}

/**
 * Every daily report in one monthly mission file.
 *
 * `origin` is the point the table's bearings and ranges are measured from. A
 * release is `located` only when there is one, so a month read without it still
 * carries its times, counties and flight structure.
 */
export function parseMissions(text, origin) {
  const starts = [...text.matchAll(DAY)];
  const days = [];

  for (const [index, start] of starts.entries()) {
    const body = text.slice(
      start.index,
      starts[index + 1]?.index ?? text.length
    );
    const month = MONTHS[start[1].toLowerCase()];
    if (!month) continue;
    const date = `${start[3]}-${pad(month)}-${pad(Number(start[2]))}`;

    const table = body.slice(body.search(/FLIGHT\s+INFORMATION/i));
    const releases = [...table.matchAll(RELEASE)].map(
      ([, hhmm, plane, bearing, range, county]) => {
        const at = origin
          ? project(origin, Number(bearing), Number(range))
          : null;
        return {
          at: instant(date, hhmm),
          timeZ: hhmm,
          plane,
          located: Boolean(at),
          lat: at?.[0] ?? null,
          lon: at?.[1] ?? null,
          /** As printed, so the projection can be redone from the source. */
          bearingDeg: Number(bearing),
          rangeNm: Number(range),
          /** The report says a flare was released, never how many. */
          glaciogenic: null,
          hygroscopic: null,
          county,
        };
      }
    );

    days.push({
      date,
      seeded: releases.length > 0,
      soundings: { NAM: parseIndices(body) },
      releases,
      sorties: [...table.matchAll(AIRBORNE)].length,
      observations: [],
    });
  }

  return days;
}

/**
 * The monthly operations report's table of days.
 *
 * `{ "2025-06-02": { glaciogenic: 27, hygroscopic: 4, counties: [...] } }` —
 * the only place a Panhandle flare count appears as a number, and so the only
 * check on a day's mission report being read whole.
 */
export function parseMonthTotals(text, year, month) {
  const start = text.search(/Date\s+Flares\s+Counties\s+seeded/i);
  if (start < 0) return {};
  const table = text.slice(start, text.search(/TOTAL\s+\d/i) + 1 || undefined);

  const totals = {};
  for (const [, day, glaciogenic, hygroscopic, counties] of table.matchAll(
    DAY_TOTAL
  )) {
    totals[`${year}-${pad(month)}-${pad(Number(day))}`] = {
      glaciogenic: Number(glaciogenic),
      hygroscopic: hygroscopic ? Number(hygroscopic) : 0,
      counties: counties.split(/,\s*/),
    };
  }
  return totals;
}
