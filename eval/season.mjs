/**
 * Every seeded day of the season, pooled.
 *
 * `node eval/season.mjs` — with the server running. Asks the join about all
 * 499 flare releases and writes `eval/out/season-2025.json`.
 *
 * **This is the case count the two-day result could not carry.** Two days
 * cannot separate a structural disagreement from two unlucky airmasses, and
 * the county-scale discrimination came out positive on one and inverted on the
 * other. Pooling the season is what decides which.
 *
 * It takes hours. Every cycle is a cold build of five sources behind an
 * archive that answers one byte range per request, and the season holds a few
 * hundred distinct cycles. Progress is written to the output file after each
 * day, so an interrupted run keeps what it has and `--resume` skips it.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER, evaluateDay, summarize, tally } from "./lib/evaluate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const RESULT = join(OUT, "season-2025.json");

const resume = process.argv.includes("--resume");

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);

const seeded = days.filter((day) => day.seeded);

await mkdir(OUT, { recursive: true });

/** What a previous run already finished, so a restart does not repeat it. */
let done = [];
if (resume) {
  try {
    done = JSON.parse(await readFile(RESULT, "utf8")).days;
    console.log(`resuming — ${done.length} days already scored\n`);
  } catch {
    console.log("nothing to resume from\n");
  }
}

const scored = [...done];

console.log(
  `${seeded.length} seeded days, ` +
    `${seeded.reduce((n, d) => n + d.releases.length, 0)} releases\n`
);

for (const day of seeded) {
  if (scored.some((entry) => entry.date === day.date)) continue;

  const started = Date.now();
  const rows = await evaluateDay(day);
  const stats = summarize(rows);

  scored.push({ date: day.date, ...stats, rows });

  const minutes = ((Date.now() - started) / 60000).toFixed(1);
  console.log(
    `${day.date}  ${String(stats.releases).padStart(2)} releases  ` +
      `${String(stats.verdicts.candidate ?? 0).padStart(2)} candidate  ` +
      `${String(stats.rejectedOnlyByRadar).padStart(2)} radar-only  ` +
      `${String(stats.topWarmerThanBand).padStart(2)} warm-top  ` +
      `peak ${String(stats.peakSlwGM2).padStart(4)} g/m²  [${minutes}m]`
  );

  // Written after every day, not at the end. A run this long will be
  // interrupted, and losing two hours of archive fetches to a restart is the
  // one failure that would stop this being repeatable.
  await writeFile(RESULT, `${JSON.stringify(pool(scored), null, 2)}\n`);
}

/** The season's totals, and every day that made them. */
function pool(entries) {
  const rows = entries.flatMap((entry) => entry.rows);
  const stats = summarize(rows);

  return {
    server: SERVER,
    days: entries,
    season: {
      days: entries.length,
      ...stats,
      // Dropped from the pooled view: a list of several hundred sorted values
      // says nothing a range does not.
      radarRejectedSlwGM2: undefined,
      radarRejectedSlwRange: range(stats.radarRejectedSlwGM2),
      verdictShares: shares(tally(rows), rows.length),
    },
  };
}

function range(values) {
  return values.length ? [values[0], values[values.length - 1]] : null;
}

function shares(counts, total) {
  const out = {};
  for (const [key, count] of Object.entries(counts)) {
    out[key] = Math.round((1000 * count) / total) / 10;
  }
  return out;
}

const final = pool(scored);
const { season } = final;

console.log(`\n${"=".repeat(60)}`);
console.log(`${season.days} days, ${season.releases} releases`);
console.log("\nverdicts:");
for (const [verdict, count] of Object.entries(season.verdicts).sort(
  (a, b) => b[1] - a[1]
)) {
  console.log(
    `  ${String(count).padStart(4)}  ${String(season.verdictShares[verdict]).padStart(5)}%  ${verdict}`
  );
}
console.log(
  `\nrejected by the radar veto alone: ${season.rejectedOnlyByRadar}` +
    ` (${season.radarRejectedSlwRange?.join("–") ?? "—"} g/m² of in-band liquid)`
);
console.log(`releases with any in-band liquid: ${season.withBandLiquid}`);
console.log(
  `releases whose observed top was warmer than −5 °C: ${season.topWarmerThanBand}`
);
console.log(
  `releases with no modelled cloud base: ${season.noModelledCloudBase}`
);
console.log(`observed cloud-top phase: ${JSON.stringify(season.topPhases)}`);
console.log(`\nwritten to eval/out/season-2025.json`);
