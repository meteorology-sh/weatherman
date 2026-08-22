/**
 * Whether a flare was released inside a region we had already painted.
 *
 * `node eval/between.mjs [--resume]` — with the server running. Writes
 * `eval/out/between-2025.json`.
 *
 * **The model analyses on the hour and flares do not.** Asking the join for a
 * single hour near a 1843Z release forces a choice between two analyses and
 * then reports the answer as though the choice were free. This asks both hours
 * instead — 18Z and 19Z — and reports what the pair agree on.
 *
 * That turns an unanswerable question into a three-way one. For each release,
 * the condition was there at:
 *
 * - **both** hours, so it was there for the whole gap between them and whatever
 *   happened in between cannot change the answer.
 * - **one** hour and not the other. The condition was moving, and nothing about
 *   a single-hour reading was ever going to settle it.
 * - **neither** hour.
 *
 * A region present at both hours is the part of the map we can defend without a
 * clock argument, because it does not depend on which analysis the release is
 * charged to.
 *
 * Three tests are run over the same pair of answers, nested from loose to
 * strict. They are separated because rain already falling is a different kind
 * of judgement from the rest: a crew may fly deliberately close to an echo, so
 * a cell ruled out only by the radar is not a cell we got wrong about the
 * cloud.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { point, SERVER } from "./lib/weatherman.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const FILE = join(OUT, "between-2025.json");

const RESUME = process.argv.includes("--resume");

/** `--day=2025-08-11` scores one day. The whole season is 125 builds; one day is a handful. */
const ONLY = process.argv.find((arg) => arg.startsWith("--day="))?.slice(6);

/**
 * The two analyses a release sits between, and how far into the gap it fell.
 *
 * Always the hour below and the hour above, never the nearer one. Rounding is
 * what this is built to avoid.
 */
function hoursAround(at) {
  const t = new Date(at);
  const h0 = new Date(t);
  h0.setUTCMinutes(0, 0, 0);
  const h1 = new Date(h0.getTime() + 3_600_000);
  return {
    h0: h0.toISOString(),
    h1: h1.toISOString(),
    intoGapMinutes: Math.round((t - h0) / 60000),
  };
}

/**
 * What each test asks of one answer.
 *
 * The rejection order runs liquid, cloud base, base against band, cloud seen,
 * top temperature, then rain, so a cell charged to `raining` passed everything
 * before it. That is what makes the middle test exact rather than a guess.
 */
const TESTS = [
  {
    key: "liquid",
    label: "supercooled liquid in the band",
    of: (a) => a.verdict !== "noLiquid",
  },
  {
    key: "cloudReady",
    label: "seedable cloud, before the rain test",
    of: (a) => a.verdict === "candidate" || a.verdict === "raining",
  },
  {
    key: "candidate",
    label: "seedable, rain included",
    of: (a) => a.verdict === "candidate",
  },
];

/** Whether a pair of answers is usable at all. */
function usable(a, b) {
  if (!a || !b || a.error || b.error) return "unknown";
  if (a.outsideDomain || b.outsideDomain) return "outside";
  return null;
}

/** Which of the two hours the condition was there at. */
function presentAt(test, a, b) {
  const bad = usable(a, b);
  if (bad) return bad;
  const lo = test.of(a);
  const hi = test.of(b);
  return lo && hi ? "both" : lo || hi ? "one" : "neither";
}

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);
const seeded = days.filter((day) => day.seeded);

/** Days already written, so a lost server does not cost the whole run. */
let done = [];
if (RESUME) {
  try {
    done = JSON.parse(await readFile(FILE, "utf8")).days;
    console.log(`resuming — ${done.length} days already scored\n`);
  } catch {
    console.log("resuming — nothing to resume from\n");
  }
}
const already = new Set(done.map((day) => day.date));

const todo = seeded
  .filter((day) => !already.has(day.date))
  .filter((day) => !ONLY || day.date === ONLY);
console.log(
  `${todo.length} days to score, ${todo.reduce(
    (n, d) => n + d.releases.filter((r) => r.located).length,
    0
  )} located releases, against ${SERVER}\n`
);

for (const day of todo) {
  const releases = day.releases.filter((release) => release.located);
  if (!releases.length) continue;

  // Grouped by hour and asked hour by hour. Every point at one hour comes off
  // one cached build, so the order decides whether this costs one download per
  // hour or one per flare.
  const byHour = new Map();
  for (const release of releases) {
    const { h0, h1 } = hoursAround(release.at);
    for (const hour of [h0, h1]) {
      if (!byHour.has(hour)) byHour.set(hour, []);
      byHour.get(hour).push(release);
    }
  }

  const answers = new Map();
  // An hour whose build wedges stays wedged: every later request for it waits
  // on the same dead promise, so it is asked once and then written off.
  const wedged = new Set();
  const started = Date.now();

  for (const hour of [...byHour.keys()].sort()) {
    for (const release of byHour.get(hour)) {
      const slot = `${hour}|${release.at}`;
      if (wedged.has(hour)) {
        answers.set(slot, { error: "hour timed out earlier" });
        continue;
      }
      try {
        answers.set(slot, await point(release.lat, release.lon, hour));
      } catch (failure) {
        answers.set(slot, { error: failure.message });
        if (/timeout|abort/i.test(failure.message)) wedged.add(hour);
      }
    }
  }

  const rows = releases.map((release) => {
    const { h0, h1, intoGapMinutes } = hoursAround(release.at);
    const lo = answers.get(`${h0}|${release.at}`);
    const hi = answers.get(`${h1}|${release.at}`);
    const present = {};
    for (const test of TESTS) present[test.key] = presentAt(test, lo, hi);
    return { release, h0, h1, intoGapMinutes, lo, hi, present };
  });

  const tally = {};
  for (const test of TESTS) {
    tally[test.key] = rows.reduce((counts, row) => {
      counts[row.present[test.key]] = (counts[row.present[test.key]] ?? 0) + 1;
      return counts;
    }, {});
  }

  done.push({ date: day.date, hours: byHour.size, rows, tally });

  await mkdir(OUT, { recursive: true });
  await writeFile(
    FILE,
    `${JSON.stringify({ server: SERVER, tests: TESTS.map((t) => ({ key: t.key, label: t.label })), days: done }, null, 2)}\n`
  );

  const mins = ((Date.now() - started) / 60000).toFixed(1);
  const say = (key) =>
    `${key} ${tally[key].both ?? 0}/${rows.length}`.padEnd(22);
  console.log(
    `  ${day.date}  ${String(rows.length).padStart(3)} flares  ` +
      `${String(byHour.size).padStart(2)} hours  ${mins.padStart(5)} min   ` +
      TESTS.map((t) => say(t.key)).join("")
  );
}

/* ---------- the pooled answer ---------- */

const rows = done.flatMap((day) => day.rows);
const scored = rows.filter(
  (row) => !["unknown", "outside"].includes(row.present.liquid)
);

console.log(`\n${"=".repeat(78)}`);
console.log(
  `${rows.length} releases scored, ${scored.length} with an answer at both hours\n`
);
console.log(
  "test".padEnd(38) +
    "both".padStart(12) +
    "one".padStart(11) +
    "neither".padStart(10)
);

const pct = (n) => `${((n / scored.length) * 100).toFixed(1)}%`;

for (const test of TESTS) {
  const counts = scored.reduce((c, row) => {
    c[row.present[test.key]] = (c[row.present[test.key]] ?? 0) + 1;
    return c;
  }, {});
  console.log(
    test.label.padEnd(38) +
      `${counts.both ?? 0} (${pct(counts.both ?? 0)})`.padStart(12) +
      `${counts.one ?? 0}`.padStart(11) +
      `${counts.neither ?? 0}`.padStart(10)
  );
}

const bad = rows.length - scored.length;
if (bad)
  console.log(`\n${bad} releases had no usable pair (error or off-grid)`);
console.log(`\nwritten to ${FILE.replace(HERE, "eval")}`);
