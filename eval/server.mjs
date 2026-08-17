/**
 * The findings, over HTTP, for the eval app to draw.
 *
 * `node eval/server.mjs` — port 3100. No dependencies, no build.
 *
 * It serves two things and nothing else: the committed ground truth in `data/`,
 * and whatever the harness in this directory has written to `out/`. It holds no
 * weather at all — every layer the app paints comes from the Weatherman server
 * itself, so the picture under the flares is the product's own output rather
 * than a second rendering of the same idea.
 *
 * **Separate from the Weatherman server on purpose.** What it serves is one
 * operator's flight record and our scoring of it. Neither is a measurement the
 * app makes, and `out/` is a working directory that is not committed — a
 * product route reading from it would break the moment a sweep was cleared.
 *
 * **The arithmetic behind a published number lives here, not in the app.** The
 * band overlap and the held tallies are computed once, on this side, so the
 * page and `EVALUATION.md` cannot drift apart by recomputing the same figure
 * two ways.
 */

// Node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const PORT = Number(process.env.EVAL_PORT ?? 3100);

const M_PER_FT = 0.3048;

/* ---------- committed input, read once ---------- */

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);
const seeded = days.filter((day) => day.seeded);

/**
 * The county boundaries, with an id stamped on each.
 *
 * TIGERweb sends a name and a GEOID and no object id, and a layer told which
 * field is its id will not load without one. Numbered here rather than in
 * `counties.mjs` so the committed file stays exactly what the Census served.
 */
const counties = JSON.stringify(
  await readFile(join(HERE, "data", "counties-tx.geojson"), "utf8").then(
    (text) => {
      const collection = JSON.parse(text);
      collection.features.forEach((feature, index) => {
        feature.properties = { OBJECTID: index + 1, ...feature.properties };
      });
      return collection;
    }
  )
);

/* ---------- harness output, re-read per request ---------- */

/** A run's output, or null if that run has not happened yet. */
async function run(name) {
  try {
    return JSON.parse(await readFile(join(OUT, name), "utf8"));
  } catch {
    return null;
  }
}

/* ---------- finding 1: the band against the balloons ---------- */

/** Bias, typical miss and worst case over the readings a pair accepts. */
function spread(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const absolute = sorted.map(Math.abs).sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  return {
    n: sorted.length,
    bias: Math.round(mean * 10) / 10,
    typical: absolute[Math.floor(absolute.length / 2)],
    worst: absolute[absolute.length - 1],
    low: sorted[0],
    high: sorted[sorted.length - 1],
  };
}

/**
 * How much of the band we drew is the band that was measured.
 *
 * Overlap over union, so drawing a band far too deep is penalised rather than
 * rewarded for covering everything. A crew does not fly an edge, it flies the
 * layer between them, which is why this and not the two edge errors is the
 * figure the finding is stated in.
 */
function bandOverlap(row) {
  const base = row.compared?.freezingLevel;
  const top = row.compared?.minus15Height;
  if (!base || !top || base.error === null || top.error === null) return null;
  // A freezing level at or below sea level is a bad lift out of the report PDF,
  // not a reading. Dropped here for the same reason reconcile.mjs drops it.
  if (!(base.reported > 0)) return null;

  const shared =
    Math.min(top.reported, top.ours) - Math.max(base.reported, base.ours);
  const union =
    Math.max(top.reported, top.ours) - Math.min(base.reported, base.ours);
  return {
    date: row.date,
    site: row.site,
    measured: [base.reported, top.reported],
    ours: [base.ours, top.ours],
    depth: top.reported - base.reported,
    fraction: Math.max(0, shared) / union,
  };
}

const READINGS = [
  { key: "freezingLevel", label: "Freezing level", unit: "m" },
  { key: "minus15Height", label: "−15 °C height", unit: "m" },
  { key: "temp700Mb", label: "Temperature at 700 mb", unit: "°C" },
  { key: "cape", label: "Surface instability", unit: "J/kg" },
];

async function band() {
  const data = await run("reconcile-2025.json");
  if (!data) return null;

  const rows = data.rows;
  const readings = READINGS.map((reading) => {
    const values = rows
      .map((row) => row.compared?.[reading.key])
      .filter((cell) => cell && cell.error !== null && cell.error !== undefined)
      .filter((cell) => reading.key !== "freezingLevel" || cell.reported > 0)
      .map((cell) => cell.error);
    return { ...reading, ...spread(values) };
  });

  const overlaps = rows.map(bandOverlap).filter(Boolean);
  const fractions = overlaps.map((o) => o.fraction).sort((a, b) => a - b);
  const depths = overlaps.map((o) => o.depth).sort((a, b) => a - b);

  return {
    sites: data.sites,
    attempted: rows.length,
    failed: rows.filter((row) => row.error).length,
    readings,
    overlap: fractions.length
      ? {
          n: fractions.length,
          median: fractions[Math.floor(fractions.length / 2)],
          mean: fractions.reduce((s, v) => s + v, 0) / fractions.length,
          worst: fractions[0],
          over90: fractions.filter((v) => v >= 0.9).length,
          over80: fractions.filter((v) => v >= 0.8).length,
          medianDepth: depths[Math.floor(depths.length / 2)],
        }
      : null,
    ascents: overlaps.sort((a, b) => a.date.localeCompare(b.date)),
    rows,
  };
}

/* ---------- finding 2: the flares against what we painted ---------- */

const OUTCOMES = ["held", "flipped", "absent"];

function tally(rows, key) {
  const counts = { held: 0, flipped: 0, absent: 0, unusable: 0 };
  for (const row of rows) {
    const value = row.held?.[key];
    counts[OUTCOMES.includes(value) ? value : "unusable"] += 1;
  }
  return counts;
}

async function overlap() {
  const data = await run("bracket-2025.json");
  if (!data) return null;

  const rows = data.days.flatMap((day) => day.rows);
  const usable = rows.filter((row) => OUTCOMES.includes(row.held?.liquid));

  // Where liquid survived both readings, what actually rejected it. The
  // rejection order puts rain last, so a cell charged to `raining` passed every
  // test before it and this is exact rather than an inference.
  const surviving = usable.filter((row) => row.held.liquid === "held");
  const reflectivity = surviving
    .flatMap((row) => [row.lo?.dbz, row.hi?.dbz])
    .filter((v) => v !== null && v !== undefined)
    .sort((a, b) => a - b);

  return {
    tests: data.tests,
    releases: rows.length,
    usable: usable.length,
    tallies: Object.fromEntries(
      data.tests.map((test) => [test.key, tally(usable, test.key)])
    ),
    rain: {
      surviving: surviving.length,
      vetoed: surviving.filter(
        (row) => row.lo?.verdict === "raining" || row.hi?.verdict === "raining"
      ).length,
      readings: reflectivity.length,
      low: reflectivity[0] ?? null,
      median: reflectivity[Math.floor(reflectivity.length / 2)] ?? null,
      high: reflectivity[reflectivity.length - 1] ?? null,
      atOrOver: reflectivity.filter((v) => v >= 20).length,
    },
    days: data.days.map((day) => ({
      date: day.date,
      flares: day.rows.length,
      hours: day.hours,
      tallies: Object.fromEntries(
        data.tests.map((test) => [test.key, tally(day.rows, test.key)])
      ),
    })),
  };
}

/* ---------- one day ---------- */

async function day(date) {
  const record = seeded.find((entry) => entry.date === date);
  if (!record) return null;

  const bracket = await run("bracket-2025.json");
  const scored = bracket?.days.find((entry) => entry.date === date);
  const byTime = new Map(
    (scored?.rows ?? []).map((row) => [row.release.at, row])
  );

  return {
    date,
    dayTotal: record.dayTotal ?? null,
    soundings: record.soundings ?? null,
    observations: record.observations ?? [],
    unlocated: record.releases.filter((release) => !release.located),
    // Whether the painted frames for this day have been built. The app offers
    // the map only when they have, rather than opening an empty one.
    painted: Boolean(await run(`held-${date}.json`)),
    releases: record.releases
      .filter((release) => release.located)
      .map((release) => {
        const row = byTime.get(release.at);
        return {
          ...release,
          payload:
            release.glaciogenic && release.hygroscopic
              ? "both"
              : release.hygroscopic
                ? "hygroscopic"
                : "glaciogenic",
          bracket: row
            ? { from: row.h0, to: row.h1, into: row.intoGapMinutes }
            : null,
          held: row?.held ?? null,
          lo: row?.lo ?? null,
          hi: row?.hi ?? null,
        };
      }),
  };
}

/**
 * The seeding-band heights the operator briefed on, in feet.
 *
 * The reports print metres and the app talks in feet everywhere else, so the
 * conversion happens once, here, rather than at each place that draws it.
 */
function briefing(record) {
  const site = record.soundings?.KMAF ?? record.soundings?.KDRT;
  if (!site) return null;
  const ft = (m) => (m == null ? null : Math.round(m / M_PER_FT));
  return {
    freezingLevelFt: ft(site.freezingLevelM),
    minus15HeightFt: ft(site.minus15HeightM),
    temp700Mb: site.temp700Mb ?? null,
  };
}

/* ---------- routes ---------- */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  try {
    const path = url.pathname;

    if (path === "/healthcheck") return send(200, { ok: true });
    if (path === "/counties.geojson") return send(200, counties);

    if (path === "/band") {
      const found = await band();
      return found
        ? send(200, found)
        : send(404, {
            error: "no reconcile run yet — node eval/reconcile.mjs",
          });
    }

    if (path === "/overlap") {
      const found = await overlap();
      return found
        ? send(200, found)
        : send(404, { error: "no bracket run yet — node eval/bracket.mjs" });
    }

    if (path === "/days") {
      const bracket = await run("bracket-2025.json");
      return send(
        200,
        await Promise.all(
          seeded.map(async (record) => {
            const scored = bracket?.days.find(
              (entry) => entry.date === record.date
            );
            return {
              date: record.date,
              flares: record.releases.filter((r) => r.located).length,
              unlocated: record.releases.filter((r) => !r.located).length,
              observations: record.observations?.length ?? 0,
              scored: Boolean(scored),
              painted: Boolean(await run(`held-${record.date}.json`)),
              held: scored ? tally(scored.rows, "liquid").held : null,
              briefing: briefing(record),
            };
          })
        )
      );
    }

    const painted = path.match(/^\/day\/(\d{4}-\d{2}-\d{2})\/painted$/);
    if (painted) {
      const found = await run(`held-${painted[1]}.json`);
      return found
        ? send(200, found)
        : send(404, {
            error: `not painted yet — node eval/held.mjs ${painted[1]}`,
          });
    }

    const one = path.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (one) {
      const found = await day(one[1]);
      return found
        ? send(200, found)
        : send(404, { error: `no report for ${one[1]}` });
    }

    send(404, { error: `no route for ${path}` });
  } catch (error) {
    send(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `eval data on http://localhost:${PORT} — ` +
      `${seeded.length} flying days, ` +
      `${seeded.reduce((n, d) => n + d.releases.length, 0)} flares`
  );
});
