/**
 * The evaluation itself: what did the map say about the cell each flare was
 * released into?
 *
 * `node eval/points.mjs 2025-04-19` — with the server running. Reads that
 * day's releases, asks `/candidate/point` about each one at the matching HRRR
 * cycle, writes `eval/out/points-<date>.json` and prints the verdict
 * breakdown.
 *
 * **Releases are worked cycle by cycle, in order.** Every cycle is a cold
 * build of five sources behind an archive that answers one byte range per
 * request, so the first release of an hour pays 30–60 s and the rest are
 * answered from the same cached join in milliseconds. Sorting by cycle is the
 * difference between one build per hour and one per release.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const SERVER = process.env.WEATHERMAN_SERVER ?? "http://localhost:3000";

/**
 * The HRRR cycle a release is scored against.
 *
 * `at` names the cycle and the join runs at the analysis hour only, so a
 * release is compared against whichever analysis it sits closest to — 1843Z is
 * 17 minutes from the 19z analysis and 43 from the 18z, so it belongs to 19z.
 * The gap is carried on every row because it is the largest source of slop in
 * the whole test.
 */
export function cycleFor(at) {
  const time = new Date(at);
  const cycle = new Date(time);
  cycle.setUTCMinutes(0, 0, 0);
  if (time.getUTCMinutes() >= 30) cycle.setUTCHours(cycle.getUTCHours() + 1);
  return {
    cycle: cycle.toISOString(),
    gapMinutes: Math.round(Math.abs(time - cycle) / 60000),
  };
}

async function point(lat, lon, at) {
  const url = new URL("/candidate/point", SERVER);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("at", at);

  const res = await fetch(url);
  if (res.status === 404) return { outsideDomain: true };
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

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

// A release with no position cannot be asked about. It stays in the flare
// totals and out of the point results, counted rather than dropped.
const unlocated = day.releases.filter((r) => !r.located);
const located = day.releases
  .filter((r) => r.located)
  .map((release) => ({ ...release, ...cycleFor(release.at) }))
  .sort((a, b) => a.cycle.localeCompare(b.cycle) || a.at.localeCompare(b.at));

console.log(
  `${date}: ${located.length} located releases across ` +
    `${new Set(located.map((r) => r.cycle)).size} cycles` +
    `${unlocated.length ? `, ${unlocated.length} without a position` : ""}\n`
);

const rows = [];
let warmed = null;

for (const release of located) {
  if (release.cycle !== warmed) {
    process.stdout.write(`  building ${release.cycle} … `);
    warmed = release.cycle;
  }

  const started = Date.now();
  let answer;
  try {
    answer = await point(release.lat, release.lon, release.cycle);
  } catch (error) {
    answer = { error: error.message };
  }
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  if (seconds > 5) process.stdout.write(`${seconds}s\n`);

  rows.push({ release, answer });

  console.log(
    `    ${release.timeZ}Z ${String(release.county).padEnd(10)} ` +
      `${release.lat.toFixed(3)},${release.lon.toFixed(3)}  ` +
      `${release.glaciogenic}G+${release.hygroscopic}H  ` +
      `→ ${describe(answer)}`
  );
}

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

const verdicts = {};
for (const { answer } of rows) {
  const key = answer.error
    ? "error"
    : answer.outsideDomain
      ? "outsideDomain"
      : answer.verdict;
  verdicts[key] = (verdicts[key] ?? 0) + 1;
}

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
      verdicts,
      rows,
    },
    null,
    2
  )}\n`
);

console.log("\nverdicts:");
for (const [verdict, count] of Object.entries(verdicts).sort(
  (a, b) => b[1] - a[1]
)) {
  const share = Math.round((100 * count) / rows.length);
  console.log(
    `  ${String(count).padStart(3)}  ${String(share).padStart(3)}%  ${verdict}`
  );
}
console.log(`\nwritten to eval/out/points-${date}.json`);
