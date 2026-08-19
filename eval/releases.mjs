/**
 * Turn a programme's daily reports into the release list everything else scores
 * against.
 *
 * `node eval/releases.mjs [--region=wtwma]` — downloads what it does not
 * already have into `eval/cache/<region>/`, parses every report, writes the
 * flight record `data/regions.json` names for that region. The PDFs are cached
 * because they never change and the sites are slow.
 *
 * **Four of the five programmes file the same document**, so one parser in
 * `lib/reports.mjs` reads them all, told which counties end a table row, which
 * sounding sites the indices table has columns for, and where a bearing and a
 * range are measured from. The Panhandle files something different enough to
 * have its own reader in `lib/panhandle.mjs`; that is the bar for writing
 * another one, not another flag here.
 *
 * Run it again after editing the parser; it re-parses from cache without
 * touching the network.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { extractText } from "./lib/pdf.mjs";
import {
  parseReport,
  reconcile,
  splitReports,
  sumReleases,
} from "./lib/reports.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");

const REGION =
  process.argv.find((arg) => arg.startsWith("--region="))?.slice(9) ?? "wtwma";

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);
const region = regions.find((entry) => entry.id === REGION);

if (!region?.counties) {
  console.error(
    `${REGION} has no county list in regions.json — its reports are not read ` +
      "by this parser"
  );
  process.exit(1);
}

/** One directory per programme, so a second one's reports cannot collide. */
const CACHE = join(HERE, "cache", region.id);

/** The cached report, or the one download that puts it there. */
async function pdf({ file, url, date }) {
  const path = join(CACHE, file);
  try {
    return await readFile(path);
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${date}: ${res.status} fetching ${url}`);
    const body = Buffer.from(await res.arrayBuffer());
    await writeFile(path, body);
    return body;
  }
}

const manifest = JSON.parse(await readFile(join(DATA, region.reports), "utf8"));

/**
 * The documents that carry flight tables.
 *
 * `daily` is one report in one file. `days` is a file holding a run of them —
 * the Rolling Plains publish the whole season that way — and it is split on
 * the heading each report opens with. Anything else in a manifest is prose
 * about days rather than a day.
 */
const reports = manifest.documents.filter((document) =>
  ["daily", "days"].includes(document.kind)
);

/** One entry per day, whichever kind of document it came out of. */
async function sections(entry) {
  const text = extractText(await pdf(entry));
  if (entry.kind !== "days") return [{ date: entry.date, text }];
  return splitReports(text).sort((a, b) => a.date.localeCompare(b.date));
}

await mkdir(CACHE, { recursive: true });

const days = [];
const failures = [];
const discrepancies = [];

for (const entry of reports) {
  for (const day of await sections(entry).catch((error) => {
    failures.push(`${entry.file}: ${error.message}`);
    return [];
  })) {
    try {
      const report = parseReport(day.text, day.date, {
        counties: region.counties,
        sounding: region.sounding,
        window: region.window,
        origin: region.origin,
      });

      // A report that parsed to nothing is a scanned page or a changed layout,
      // not a quiet day. The `_NS` days are marked in the manifest, so a day
      // with no releases and no `flew` flag is a parser failure wearing a
      // plausible answer.
      if (!report.seeded && !entry.flew) {
        failures.push(`${day.date}: no releases found, and not marked _NS`);
      }
      if (day.date && report.date !== day.date) {
        failures.push(`${day.date}: report says ${report.date}`);
      }

      // Each report states its flare count three times: the table, a
      // per-county breakdown, and a day total. Dropping a row moves the table
      // away from *both* prose figures at once, and that is a parser failure.
      // One prose figure disagreeing on its own is the operator's arithmetic,
      // and the table — the only one of the three with a minute and a position
      // on every row — is what the evaluation scores against either way.
      //
      // **A table with no flare column cannot be checked this way**, and South
      // Texas and the Rolling Plains file one row per seeding pass without a
      // count. Their day totals are read and kept; there is simply nothing to
      // compare them against, and summing their rows as zero would report a
      // disagreement on every day.
      const counted = report.releases.some((r) => r.glaciogenic !== null);
      const summed = sumReleases(report.releases);
      const stated = report.dayTotal;
      const prose = sumClaimed(report.claimed);
      const differs = (a, b) =>
        a.glaciogenic !== b.glaciogenic || a.hygroscopic !== b.hygroscopic;

      if (counted && stated && differs(summed, stated)) {
        const line =
          `${day.date}: table ${summed.glaciogenic}G+${summed.hygroscopic}H, ` +
          `day total ${stated.glaciogenic}G+${stated.hygroscopic}H, ` +
          `county breakdown ${prose.glaciogenic}G+${prose.hygroscopic}H`;
        if (differs(summed, prose)) failures.push(line);
        else discrepancies.push(line);
      }

      const disagreements = counted ? reconcile(report) : [];
      for (const line of disagreements) {
        discrepancies.push(`${day.date}: ${line}`);
      }

      for (const release of report.releases.filter(
        (r) => r.lat !== null && !r.located
      )) {
        discrepancies.push(
          `${day.date}: ${release.timeZ}Z prints ` +
            `${release.lat} / ${release.lon}, which is outside the target ` +
            "area — kept, not scored"
        );
      }

      const unlocated = report.releases.filter((r) => !r.located).length;
      days.push({
        ...report,
        flewOnly: Boolean(entry.flew),
        ...(disagreements.length && { disagreements }),
      });

      process.stdout.write(
        `${report.date}  ${String(report.releases.length).padStart(2)} releases` +
          `${unlocated ? ` (${unlocated} unlocated)` : ""}` +
          `  ${report.releases.length ? counties(report) : "(no seeding)"}\n`
      );
    } catch (error) {
      failures.push(`${day.date ?? entry.file}: ${error.message}`);
    }
  }
}

function sumClaimed(claimed) {
  return Object.values(claimed).reduce(
    (total, county) => ({
      glaciogenic: total.glaciogenic + county.glaciogenic,
      hygroscopic: total.hygroscopic + county.hygroscopic,
    }),
    { glaciogenic: 0, hygroscopic: 0 }
  );
}

function counties(report) {
  return [...new Set(report.releases.map((r) => r.county))].sort().join(", ");
}

days.sort((a, b) => a.date.localeCompare(b.date));

const releases = days.flatMap((day) => day.releases);

await writeFile(
  join(DATA, region.releases),
  `${JSON.stringify(
    {
      source: manifest.source,
      operator: region.name,
      note: "One glaciogenic flare is 5.5 g AgI; one hygroscopic flare is 500 g NaCl.",
      days,
    },
    null,
    2
  )}\n`
);

console.log(
  `\n${days.length} reports, ${releases.length} releases ` +
    `(${releases.filter((r) => !r.located).length} without a position), ` +
    `${days.filter((d) => d.flewOnly).length} flew without seeding`
);

// Not a failure. Where a report's prose disagrees with its own table, the
// table is the record — it is the half with a minute and a position on every
// row — and the disagreement is a fact about the source worth printing.
if (discrepancies.length) {
  console.log(`\n${discrepancies.length} table/prose disagreement(s):`);
  for (const line of discrepancies) console.log(`  ${line}`);
}

if (failures.length) {
  console.error(`\n${failures.length} problem(s):`);
  for (const failure of failures) console.error(`  ${failure}`);
  process.exitCode = 1;
}
