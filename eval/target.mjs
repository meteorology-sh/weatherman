/**
 * Whether a 2025 flare landed in a Texas-shaped target, asked at both hours.
 *
 * `node eval/target.mjs [--resume] [--day=2025-08-04] [--region=wtwma]` —
 * with the Weatherman server running. Writes `eval/out/target-2025.json`.
 *
 * Same clock protocol as `between.mjs`: the model analyses on the hour and
 * flares do not, so each release is asked at the hour below and the hour
 * above. A target present at both is the part we can defend without a clock
 * argument.
 *
 * The tests are the Texas join, nested loose to strict, plus the liquid
 * check the existing opportunity field already reports. Selectivity is the
 * boxed target area against the programme window — hit-rate without that
 * number is how a join that paints Texas cheats.
 *
 * Do not paint geometry from this script. Point queries and boxed stats are
 * the score; `paint.mjs` waits until the strategy holds.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { point, SERVER, targetStats } from "./lib/weatherman.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");
const FILE = join(OUT, "target-2025.json");

const RESUME = process.argv.includes("--resume");
const ONLY = process.argv.find((arg) => arg.startsWith("--day="))?.slice(6);
const REGION =
  process.argv.find((arg) => arg.startsWith("--region="))?.slice(9) ?? null;

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
 * Nested loose → strict. `target` is the join; the others name which test
 * would have been enough. `liquid` is the existing opportunity field's
 * first test, reported as a reading, not a gate.
 */
const TESTS = [
  {
    key: "baseInWindow",
    label: "cloud base in the 4,000–12,000 ft AGL window",
    of: (a) =>
      a.target === "target" ||
      a.target === "noFreezingLevel" ||
      a.target === "topBelowFreezing" ||
      a.target === "noStorm",
  },
  {
    key: "pastFreezing",
    label: "echo top at or above freezing, in the neighbourhood",
    of: (a) => a.target === "target" || a.target === "noStorm",
  },
  {
    key: "target",
    label: "Texas target — storm in the neighbourhood too",
    of: (a) => a.target === "target",
  },
  {
    key: "liquid",
    label: "supercooled liquid in the band",
    of: (a) => a.verdict !== "noLiquid",
  },
];

function usable(a, b) {
  if (!a || !b || a.error || b.error) return "unknown";
  if (a.outsideDomain || b.outsideDomain) return "outside";
  if (a.target === undefined || b.target === undefined) return "unknown";
  return null;
}

function presentAt(test, a, b) {
  const bad = usable(a, b);
  if (bad) return bad;
  const lo = test.of(a);
  const hi = test.of(b);
  return lo && hi ? "both" : lo || hi ? "one" : "neither";
}

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);
const chosen = regions.filter((entry) => entry.releases);
const wanted = REGION
  ? chosen.filter((entry) => entry.id === REGION)
  : chosen;

if (REGION && wanted.length === 0) {
  console.error(
    `unknown region "${REGION}" — try ${chosen.map((r) => r.id).join(", ")}`
  );
  process.exit(1);
}

/** Days already written, so a lost server does not cost the whole run. */
let done = [];
if (RESUME) {
  try {
    done = JSON.parse(await readFile(FILE, "utf8")).regions ?? [];
    console.log(
      `resuming — ${done.reduce((n, r) => n + r.days.length, 0)} days already scored\n`
    );
  } catch {
    console.log("resuming — nothing to resume from\n");
  }
}

console.log(`against ${SERVER}\n`);

for (const region of wanted) {
  const { days } = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );
  const seeded = days.filter((day) => day.seeded);
  let entry = done.find((row) => row.id === region.id);
  if (!entry) {
    entry = { id: region.id, name: region.short, days: [] };
    done.push(entry);
  }
  const already = new Set(entry.days.map((day) => day.date));
  const todo = seeded
    .filter((day) => !already.has(day.date))
    .filter((day) => !ONLY || day.date === ONLY);

  console.log(
    `${region.short}: ${todo.length} days to score, ` +
      `${todo.reduce((n, d) => n + d.releases.filter((r) => r.located).length, 0)} ` +
      `located releases`
  );

  for (const day of todo) {
    const releases = day.releases.filter((release) => release.located);
    if (!releases.length) continue;

    const byHour = new Map();
    for (const release of releases) {
      const { h0, h1 } = hoursAround(release.at);
      for (const hour of [h0, h1]) {
        if (!byHour.has(hour)) byHour.set(hour, []);
        byHour.get(hour).push(release);
      }
    }

    const answers = new Map();
    const coverage = new Map();
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
      if (wedged.has(hour) || coverage.has(hour)) continue;
      try {
        coverage.set(hour, await targetStats(hour, region.window));
      } catch (failure) {
        coverage.set(hour, { error: failure.message });
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
        counts[row.present[test.key]] =
          (counts[row.present[test.key]] ?? 0) + 1;
        return counts;
      }, {});
    }

    entry.days.push({
      date: day.date,
      hours: byHour.size,
      rows,
      tally,
      coverage: Object.fromEntries(coverage),
    });

    await mkdir(OUT, { recursive: true });
    await writeFile(
      FILE,
      `${JSON.stringify(
        {
          server: SERVER,
          tests: TESTS.map((t) => ({ key: t.key, label: t.label })),
          regions: done,
        },
        null,
        2
      )}\n`
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
}

/* ---------- the pooled answer ---------- */

function printTally(label, rows) {
  const scored = rows.filter(
    (row) => !["unknown", "outside"].includes(row.present.target)
  );
  console.log(`\n${label}`);
  console.log(
    `${rows.length} releases, ${scored.length} with an answer at both hours`
  );
  console.log(
    "test".padEnd(52) +
      "both".padStart(12) +
      "one".padStart(11) +
      "neither".padStart(10)
  );
  const pct = (n) =>
    scored.length === 0 ? "—" : `${((n / scored.length) * 100).toFixed(1)}%`;
  for (const test of TESTS) {
    const counts = scored.reduce((c, row) => {
      c[row.present[test.key]] = (c[row.present[test.key]] ?? 0) + 1;
      return c;
    }, {});
    console.log(
      test.label.padEnd(52) +
        `${counts.both ?? 0} (${pct(counts.both ?? 0)})`.padStart(12) +
        `${counts.one ?? 0}`.padStart(11) +
        `${counts.neither ?? 0}`.padStart(10)
    );
  }
}

console.log(`\n${"=".repeat(78)}`);
const scored = wanted
  .map((region) => done.find((entry) => entry.id === region.id))
  .filter(Boolean);
for (const region of scored) {
  printTally(
    region.name,
    region.days.flatMap((day) => day.rows)
  );
}
printTally(
  "all programmes",
  scored.flatMap((region) => region.days.flatMap((day) => day.rows))
);

const areas = scored.flatMap((region) =>
  region.days.flatMap((day) =>
    Object.values(day.coverage ?? {}).filter((c) => c && !c.error)
  )
);
if (areas.length) {
  const targetKm2 = areas.reduce((n, c) => n + (c.targetKm2 ?? 0), 0);
  const boxKm2 = areas.reduce((n, c) => n + (c.boxKm2 ?? 0), 0);
  const share = boxKm2 === 0 ? 0 : (100 * targetKm2) / boxKm2;
  console.log(
    `\nselectivity  ${targetKm2.toFixed(0)} km² target / ${boxKm2.toFixed(0)} km² asked  (${share.toFixed(1)}% of the boxes, pooled over hours)`
  );
}

console.log(`\nwritten to ${FILE.replace(HERE, "eval")}`);
