/**
 * The evaluation itself, for one day: what did the map say about the cell each
 * flare was released into?
 *
 * `node eval/points.mjs 2025-04-19` — with the server running. Writes
 * `eval/out/points-<date>.json` and prints the verdict breakdown.
 *
 * `season.mjs` runs the same evaluation over every day at once. This one is
 * for looking at a single case closely; the arithmetic lives in
 * `lib/evaluate.mjs` so the two cannot disagree.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER, evaluateDay, summarize } from "./lib/evaluate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const date = process.argv[2];
if (!date) {
  console.error("usage: node eval/points.mjs <YYYY-MM-DD>");
  process.exit(2);
}

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);

const day = days.find((d) => d.date === date);
if (!day) {
  console.error(`no report for ${date}`);
  process.exit(2);
}

const unlocated = day.releases.filter((r) => !r.located);
const cycles = new Set(
  day.releases.filter((r) => r.located).map((r) => r.at.slice(0, 13))
);

console.log(
  `${date}: ${day.releases.length - unlocated.length} located releases across ` +
    `~${cycles.size} cycles` +
    `${unlocated.length ? `, ${unlocated.length} without a position` : ""}\n`
);

let warmed = null;

const rows = await evaluateDay(day, ({ release, answer }) => {
  if (release.cycle !== warmed) {
    console.log(`  building ${release.cycle} …`);
    warmed = release.cycle;
  }
  console.log(
    `    ${release.timeZ}Z ${String(release.county).padEnd(10)} ` +
      `${release.lat.toFixed(3)},${release.lon.toFixed(3)}  ` +
      `${release.glaciogenic}G+${release.hygroscopic}H  ` +
      `→ ${describe(answer)}`
  );
});

function describe(answer) {
  if (answer.error) return `error: ${answer.error}`;
  if (answer.outsideDomain) return "outside the model domain";
  const parts = [answer.verdict, `${answer.slwGM2} g/m²`];
  if (answer.cloudBaseFt !== null) parts.push(`base ${answer.cloudBaseFt} ft`);
  if (answer.cloudTopC !== null) parts.push(`top ${answer.cloudTopC} °C`);
  if (answer.topPhase) parts.push(answer.topPhase);
  parts.push(
    answer.dbz === null
      ? answer.radarCovered
        ? "no echo"
        : "no radar"
      : `${answer.dbz} dBZ`
  );
  return parts.join(", ");
}

const stats = summarize(rows);

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, `points-${date}.json`),
  `${JSON.stringify(
    {
      date,
      server: SERVER,
      soundings: day.soundings,
      observations: day.observations,
      unlocated,
      verdicts: stats.verdicts,
      summary: stats,
      rows,
    },
    null,
    2
  )}\n`
);

console.log("\nverdicts:");
for (const [verdict, count] of Object.entries(stats.verdicts).sort(
  (a, b) => b[1] - a[1]
)) {
  const share = Math.round((100 * count) / rows.length);
  console.log(
    `  ${String(count).padStart(3)}  ${String(share).padStart(3)}%  ${verdict}`
  );
}
console.log(`\nwritten to eval/out/points-${date}.json`);
