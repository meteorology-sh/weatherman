/**
 * The radar veto, asked again at the minute each flare actually left.
 *
 * `node eval/veto.mjs` — with the server running.
 *
 * **This is the one result the hourly sweep cannot be trusted on.** A cell is
 * charged to `raining` by a reflectivity reading, the mosaic arrives every two
 * minutes, and the sweep asked for the one nearest the top of the hour — up to
 * half an hour from the release. An echo moves 10 to 17 km in that time, which
 * is about one 12 km cell, so some share of these vetoes is a storm that was
 * next door when the flare was burned.
 *
 * Every release here is its own build, because the scene is cached under the
 * timestamp asked for. That is the price of the answer.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER, cycleFor, gapsFor, point } from "./lib/evaluate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const season = JSON.parse(
  await readFile(join(OUT, "season-2025.json"), "utf8")
);

/**
 * Which releases have to be asked again.
 *
 * **Not all of them.** The join charges a cell to the first test it fails, and
 * the first test is the model's own: a cell with no supercooled liquid in the
 * band never reaches the satellite or the radar, and the model half does not
 * move when the timestamp gets finer — it rounds to the same analysis hour
 * either way. Those verdicts stand.
 *
 * Everything else was decided by an observation, and the observations were
 * being read up to half an hour from the flare. That is the radar vetoes and
 * the candidates alike — a candidate passed the radar test against a mosaic
 * from the wrong minute just as surely as a vetoed cell failed one.
 */
const vetoed = season.days
  .flatMap((day) =>
    day.rows
      .filter(
        (row) =>
          !row.answer.error &&
          !row.answer.outsideDomain &&
          row.answer.verdict !== "noLiquid"
      )
      .map((row) => ({ date: day.date, ...row }))
  )
  .sort((a, b) => a.release.at.localeCompare(b.release.at));

const byVerdict = {};
for (const entry of vetoed) {
  byVerdict[entry.answer.verdict] = (byVerdict[entry.answer.verdict] ?? 0) + 1;
}

console.log(
  `${vetoed.length} verdicts rested on an observation ` +
    `(${Object.entries(byVerdict)
      .map(([verdict, n]) => `${n} ${verdict}`)
      .join(", ")}).\n` +
    `Re-asking each at its own timestamp — one build apiece.\n`
);

const rechecked = [];

for (const [index, entry] of vetoed.entries()) {
  const { release, answer: before } = entry;
  const started = Date.now();

  let after;
  try {
    after = await point(release.lat, release.lon, release.at);
  } catch (error) {
    after = { error: error.message };
  }

  const gaps = gapsFor(release.at, after);
  const seconds = ((Date.now() - started) / 1000).toFixed(0);

  rechecked.push({
    date: entry.date,
    release,
    askedHourly: cycleFor(release.at).cycle,
    before: {
      verdict: before.verdict,
      dbz: before.dbz,
      slwGM2: before.slwGM2,
      cloudTopC: before.cloudTopC,
      topPhase: before.topPhase,
      sceneTime: before.sceneTime,
      radarTime: before.radarTime,
    },
    after,
    gaps,
  });

  const moved = after.error
    ? `error: ${after.error}`
    : after.verdict === before.verdict
      ? `still ${after.verdict}`
      : `${before.verdict} → ${after.verdict}`;

  console.log(
    `  ${String(index + 1).padStart(3)}/${vetoed.length} ` +
      `${entry.date} ${release.timeZ}Z ${String(release.county).padEnd(10)} ` +
      `${String(before.dbz).padStart(3)}→${String(after.dbz ?? "—").padStart(3)} dBZ  ` +
      `radar ${String(gaps?.radar ?? "—").padStart(3)} min  ${moved}  [${seconds}s]`
  );

  await mkdir(OUT, { recursive: true });
  await writeFile(
    join(OUT, "veto-recheck.json"),
    `${JSON.stringify({ server: SERVER, rechecked }, null, 2)}\n`
  );
}

const answered = rechecked.filter((entry) => !entry.after.error);

console.log(`\n${"=".repeat(60)}`);
console.log(`${answered.length} of ${vetoed.length} re-scored\n`);

// Where each verdict went. The diagonal is what the hourly sweep got right.
const moves = {};
for (const entry of answered) {
  const key = `${entry.before.verdict} → ${entry.after.verdict}`;
  moves[key] = (moves[key] ?? 0) + 1;
}
console.log("verdicts:");
for (const [move, n] of Object.entries(moves).sort((a, b) => b[1] - a[1])) {
  const [from, to] = move.split(" → ");
  console.log(
    `  ${String(n).padStart(3)}  ${move}${from === to ? "  (unchanged)" : ""}`
  );
}

// The cloud-top reading is the other thing the wrong minute moved, and it is
// what the "band above the cloud" count is built from.
const tops = answered.filter(
  (entry) => entry.before.cloudTopC !== null && entry.after.cloudTopC !== null
);
const warmBefore = tops.filter((entry) => entry.before.cloudTopC > -5).length;
const warmAfter = tops.filter((entry) => entry.after.cloudTopC > -5).length;
const shifted = tops.filter(
  (entry) => Math.abs(entry.after.cloudTopC - entry.before.cloudTopC) >= 5
).length;

console.log(
  `\nobserved cloud top, over ${tops.length} with a reading both times:`
);
console.log(`  warmer than −5 °C before: ${warmBefore}`);
console.log(`  warmer than −5 °C after:  ${warmAfter}`);
console.log(`  moved by 5 °C or more:    ${shifted}`);

const radarGaps = answered
  .map((entry) => Math.abs(entry.gaps?.radar ?? 0))
  .sort((a, b) => a - b);
if (radarGaps.length) {
  console.log(
    `\nradar now ${radarGaps[0]}–${radarGaps[radarGaps.length - 1]} min from the release ` +
      `(median ${radarGaps[Math.floor(radarGaps.length / 2)]})`
  );
}
console.log(`\nwritten to eval/out/veto-recheck.json`);
