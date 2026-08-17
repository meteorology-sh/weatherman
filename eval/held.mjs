/**
 * The painted region between two analyses, with the flares that fell in it.
 *
 * `node eval/held.mjs 2025-08-11 [--layer=liquid|candidate]` — with the server
 * running. Writes `eval/out/held-<date>.json`, which is everything a map needs
 * in one self-contained file.
 *
 * **This paints the integral, not a point answer.** `bracket.mjs` asks what the
 * join said about the one cell a flare was released into; this fetches the whole
 * field at both ends of that flare's bracket, so the region can be drawn and the
 * flare drawn on top of it. The two are the same question at different
 * resolutions and they have to agree — the flare classification carried here is
 * read straight out of `bracket-2025.json` rather than recomputed, so the map
 * cannot tell a different story from the table.
 *
 * The layer is the supercooled liquid water path by default: the integral
 * through the seeding band, which is the field the whole evaluation turns on and
 * the one nothing else can check. `--layer=candidate` paints the full join
 * instead.
 *
 * What "held" means here is what it means in `bracket.mjs`: painted at the hour
 * below and again at the hour above, so the region was there across the whole
 * gap and does not depend on which analysis a release is charged to. On the map
 * that is the overlap of the two outlines.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER } from "./lib/evaluate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

const DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
const LAYER =
  process.argv.find((arg) => arg.startsWith("--layer="))?.slice(8) ?? "liquid";

if (!DATE) {
  console.error(
    "usage: node eval/held.mjs <YYYY-MM-DD> [--layer=liquid|candidate]"
  );
  process.exit(1);
}

/** Where each layer comes from, and which property carries its level. */
const LAYERS = {
  liquid: {
    path: (at) => `/forecast/liquid?hour=0&at=${encodeURIComponent(at)}`,
    property: "slwPath",
    label: "supercooled liquid water path through the seeding band",
    unit: "g/m²",
  },
  candidate: {
    path: (at) => `/candidate/field?at=${encodeURIComponent(at)}`,
    property: "seedableSlwPath",
    label: "the join, every layer agreeing at once",
    unit: "g/m²",
  },
};

const SOURCE = LAYERS[LAYER];
if (!SOURCE) {
  console.error(`unknown layer "${LAYER}" — try liquid or candidate`);
  process.exit(1);
}

/**
 * The window worth drawing.
 *
 * West Texas plus a margin. A frame covers CONUS and all of it is geometry we
 * would have to carry into the page, so everything outside the programme's
 * working area is dropped before the file is written rather than after.
 */
const WINDOW = { west: -106, east: -96, south: 27.5, north: 36 };

/** Three decimals is about 100 m, which is finer than a 12 km cell can justify. */
const round = (value) => Math.round(value * 1000) / 1000;

function inWindow([lon, lat]) {
  return (
    lon >= WINDOW.west &&
    lon <= WINDOW.east &&
    lat >= WINDOW.south &&
    lat <= WINDOW.north
  );
}

/**
 * A ring, rounded and dropped if it leaves nothing to draw.
 *
 * A ring is kept whole when any of it is in the window — clipping the geometry
 * itself would invent edges along the window boundary that the field does not
 * have, and a false coastline through the middle of a cloud is worse than a
 * few kilobytes.
 */
function simplify(ring) {
  if (!ring.some(inWindow)) return null;
  const out = ring.map(([lon, lat]) => [round(lon), round(lat)]);
  return out.length >= 4 ? out : null;
}

async function frameAt(at) {
  const res = await fetch(new URL(SOURCE.path(at), SERVER), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  const frame = await res.json();

  const levels = [];
  for (const feature of frame.features ?? []) {
    const level = feature.properties?.[SOURCE.property];
    const polygons = [];
    for (const polygon of feature.geometry?.coordinates ?? []) {
      const rings = polygon.map(simplify).filter(Boolean);
      if (rings.length) polygons.push(rings);
    }
    if (polygons.length) levels.push({ level, polygons });
  }

  return { validTime: frame.validTime ?? at, levels };
}

/* ---------- the day ---------- */

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);
const day = days.find((entry) => entry.date === DATE && entry.seeded);
if (!day) {
  console.error(`no seeded report for ${DATE}`);
  process.exit(1);
}

const releases = day.releases.filter((release) => release.located);

/**
 * How each flare was classified, read back rather than recomputed.
 *
 * If the bracket sweep has not reached this day the map still draws, with the
 * flares unclassified. A missing verdict is drawn as missing; it is never
 * silently filled in with one of the three answers.
 */
let verdicts = new Map();
try {
  const bracket = JSON.parse(
    await readFile(join(OUT, "bracket-2025.json"), "utf8")
  );
  const scored = bracket.days.find((entry) => entry.date === DATE);
  for (const row of scored?.rows ?? []) verdicts.set(row.release.at, row.held);
} catch {
  console.log("no bracket sweep on disk — flares will be drawn unclassified\n");
}

// Every hour the day's flares sit between, which is one more than the number of
// gaps: a release at 1843Z needs 18Z and 19Z, and the next at 1955Z needs 19Z
// and 20Z, so 19Z is shared.
const hours = [
  ...new Set(
    releases.flatMap((release) => {
      const t = new Date(release.at);
      const h0 = new Date(t);
      h0.setUTCMinutes(0, 0, 0);
      return [
        h0.toISOString(),
        new Date(h0.getTime() + 3_600_000).toISOString(),
      ];
    })
  ),
].sort();

console.log(
  `${DATE} — ${releases.length} flares, ${hours.length} analyses, ` +
    `painting ${SOURCE.label}\n`
);

const frames = {};
for (const hour of hours) {
  const started = Date.now();
  try {
    frames[hour] = await frameAt(hour);
    const rings = frames[hour].levels.reduce(
      (n, level) => n + level.polygons.reduce((m, p) => m + p.length, 0),
      0
    );
    console.log(
      `  ${hour}  ${String(frames[hour].levels.length).padStart(2)} levels  ` +
        `${String(rings).padStart(4)} rings  ` +
        `${((Date.now() - started) / 1000).toFixed(0)}s`
    );
  } catch (failure) {
    frames[hour] = { validTime: hour, levels: [], error: failure.message };
    console.log(`  ${hour}  failed: ${failure.message}`);
  }
}

// One interval per consecutive pair, carrying the flares released inside it.
const intervals = [];
for (let i = 0; i < hours.length - 1; i++) {
  const from = hours[i];
  const to = hours[i + 1];
  const inside = releases
    .filter((release) => release.at >= from && release.at < to)
    .map((release) => ({
      at: release.at,
      timeZ: release.timeZ,
      lon: release.lon,
      lat: release.lat,
      county: release.county,
      plane: release.plane,
      payload:
        release.glaciogenic && release.hygroscopic
          ? "both"
          : release.hygroscopic
            ? "hygroscopic"
            : "glaciogenic",
      held: verdicts.get(release.at) ?? null,
    }));
  if (inside.length) intervals.push({ from, to, flares: inside });
}

await mkdir(OUT, { recursive: true });
const file = join(OUT, `held-${DATE}.json`);
await writeFile(
  file,
  `${JSON.stringify(
    {
      date: DATE,
      server: SERVER,
      layer: LAYER,
      property: SOURCE.property,
      label: SOURCE.label,
      unit: SOURCE.unit,
      window: WINDOW,
      soundings: day.soundings ?? null,
      observations: day.observations ?? [],
      frames,
      intervals,
    },
    null,
    2
  )}\n`
);

const bytes = (await readFile(file)).length;
console.log(
  `\n${intervals.length} intervals, ` +
    `${intervals.reduce((n, i) => n + i.flares.length, 0)} flares placed\n` +
    `written to eval/out/held-${DATE}.json (${(bytes / 1024 / 1024).toFixed(1)} MB)`
);
