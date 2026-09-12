/**
 * Turn the Panhandle district's monthly reports into a flight record.
 *
 * `node eval/panhandle.mjs [--season=2025]` — reads the cached months in
 * `cache/<season>/panhandle/`, writes the flight record the season's
 * `regions.json` names.
 *
 * **It is a separate script because the district files a separate document.**
 * `releases.mjs` reads the daily report West Texas and Trans-Pecos both write;
 * the Panhandle publishes a month at a time, with the flare counts in one file
 * and the flight tables in another, and positions given as a bearing and a
 * range off a radar display. `lib/panhandle.mjs` says what each of those costs.
 *
 * **The month's own flare total is the check.** The mission file has no count
 * on any row, so a day read whole and a day read half look the same there. The
 * operations report states a count per day and a total per month, and a day
 * missing from one file while present in the other is what this prints.
 */

// Node
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Local
import { extractText } from "./lib/pdf.mjs";
import { parseMissions, parseMonthTotals } from "./lib/panhandle.mjs";
import { regionsOf, seasonDirs, seasonOf } from "./lib/season.mjs";

const SEASON = seasonOf();
const { data: DATA, cache: SEASON_CACHE } = seasonDirs(SEASON);
const CACHE = join(SEASON_CACHE, "panhandle");

const regions = await regionsOf(SEASON);
const region = regions.find((entry) => entry.id === "panhandle");
const manifest = JSON.parse(await readFile(join(DATA, region.reports), "utf8"));

const origin = region.origin?.at ? region.origin : null;
if (!origin) {
  console.log("no origin in regions.json — releases will carry no position\n");
}

const months = [...new Set(manifest.documents.map((d) => d.month))].sort();

const days = [];
const problems = [];

for (const month of months) {
  const [year, index] = month.split("-").map(Number);
  const missions = manifest.documents.find(
    (d) => d.month === month && d.kind === "missions"
  );
  const operations = manifest.documents.find(
    (d) => d.month === month && d.kind === "operations"
  );

  // A month posted without its mission reports has no flight table to read,
  // and one whose operations report is not a PDF has no day totals to check
  // the table against. Both are printed as problems rather than passed over.
  if (!missions) {
    problems.push(`${month}: no mission reports posted`);
    continue;
  }
  const flown = parseMissions(
    extractText(await readFile(join(CACHE, missions.file))),
    origin
  );
  const checked = Boolean(operations?.file.endsWith(".pdf"));
  if (!checked) {
    problems.push(
      `${month}: ${
        operations
          ? `operations report is .${operations.file.split(".").pop()}, not read`
          : "no operations report posted"
      } — days not checked against a total`
    );
  }
  const totals = checked
    ? parseMonthTotals(
        extractText(await readFile(join(CACHE, operations.file))),
        year,
        index
      )
    : {};

  for (const day of flown) {
    const stated = totals[day.date] ?? null;
    days.push({
      ...day,
      // What the operations report says the day burned. The mission table
      // cannot say, so this is the whole of what is known about the amount.
      dayTotal: stated
        ? { glaciogenic: stated.glaciogenic, hygroscopic: stated.hygroscopic }
        : null,
      claimedCounties: stated?.counties ?? [],
    });
  }

  // A day in one file and not the other is a document that was not read whole,
  // and it has to be visible rather than quietly absent.
  const missing = Object.keys(totals).filter(
    (date) => !flown.some((day) => day.date === date)
  );
  for (const date of missing) {
    problems.push(
      `${date}: in the operations report, not in the missions file`
    );
  }
  for (const day of checked
    ? flown.filter((entry) => !totals[entry.date])
    : []) {
    problems.push(
      `${day.date}: in the missions file, not in the operations report`
    );
  }

  console.log(
    `${month}  ${flown.length} reports, ` +
      `${flown.reduce((n, day) => n + day.releases.length, 0)} releases, ` +
      `${Object.keys(totals).length} days in the operations table`
  );
}

days.sort((a, b) => a.date.localeCompare(b.date));

await writeFile(
  join(DATA, region.releases),
  `${JSON.stringify(
    {
      source: manifest.source,
      operator: region.name,
      note:
        "Positions are a bearing and a range off " +
        (region.origin?.name ?? "an origin that has not been established") +
        ", projected here. Flare counts are per day, from the monthly " +
        "operations report; the flight table gives none.",
      origin: region.origin ?? null,
      days,
    },
    null,
    2
  )}\n`
);

const releases = days.flatMap((day) => day.releases);
const flares = days.reduce(
  (total, day) => ({
    glaciogenic: total.glaciogenic + (day.dayTotal?.glaciogenic ?? 0),
    hygroscopic: total.hygroscopic + (day.dayTotal?.hygroscopic ?? 0),
  }),
  { glaciogenic: 0, hygroscopic: 0 }
);

console.log(
  `\n${days.length} seeding days, ${releases.length} releases ` +
    `(${releases.filter((r) => !r.located).length} without a position), ` +
    `${flares.glaciogenic} glaciogenic and ${flares.hygroscopic} hygroscopic ` +
    "flares by the operations reports"
);

if (problems.length) {
  console.log(`\n${problems.length} problem(s):`);
  for (const line of problems) console.log(`  ${line}`);
}
