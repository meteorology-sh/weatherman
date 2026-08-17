/**
 * Everything a map needs to show one flying day, in one file.
 *
 * `node eval/held.mjs 2025-04-19 [--region=wtwma]` — with the Weatherman server
 * running. Writes `eval/out/held-<date>.json`.
 *
 * **It paints the product's own layers, not a layer invented for the page.**
 * Every one of the five is the same route the replay map fetches, at the same
 * hour parameter, carrying the same property — so a band drawn here is the band
 * Weatherman draws. The eval app then reads its colours and levels straight out
 * of `app/src/lib/arcgis/bands.ts`. Nothing about the picture is a second
 * rendering of the idea.
 *
 * **Two analyses per flare, because the model publishes once an hour and the
 * aircraft do not wait for it.** A release at 1843Z sits between the 18Z and 19Z
 * analyses, so both are fetched and both are drawn. Where the two agree the
 * answer does not depend on which hour the release is charged to.
 *
 * **The gap between them is not empty, and the drift vector is what fills it.**
 * HRRR carries a 0–6 km storm motion over every cell — the vector already
 * behind the candidate readout's "where a seeded cloud would carry the plume".
 * Sampled at the release point and run forward to the end of the bracket, it
 * says where the air that was seeded had gone by the second frame. Drawn on the
 * map it connects the cloud at the first hour to the cloud at the second, which
 * is the only honest way to read two stills an hour apart.
 *
 * The flare classifications are read back out of `bracket-2025.json` rather than
 * recomputed, so the map cannot tell a different story from the table.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER } from "./lib/evaluate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");

const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

const DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
const REGION =
  process.argv.find((arg) => arg.startsWith("--region="))?.slice(9) ?? "wtwma";

if (!DATE) {
  console.error("usage: node eval/held.mjs <YYYY-MM-DD> [--region=wtwma]");
  process.exit(1);
}

/* ---------- the region ---------- */

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);
const region = regions.find((entry) => entry.id === REGION);

if (!region) {
  console.error(
    `unknown region "${REGION}" — try ${regions.map((r) => r.id).join(", ")}`
  );
  process.exit(1);
}
if (!region.releases) {
  console.error(
    `${region.name} has no parsed flight record yet — nothing to paint against`
  );
  process.exit(1);
}

/**
 * The window worth drawing, from the region.
 *
 * A frame covers CONUS and all of it is geometry we would otherwise carry into
 * the page, so everything outside the programme's working area is dropped before
 * the file is written rather than after.
 */
const WINDOW = region.window;

/* ---------- the layers, as the replay map draws them ---------- */

/**
 * The five layers, in the order Weatherman stacks them.
 *
 * Same routes, same hour parameter, same properties. `hour=0` on the two HRRR
 * fields for the reason the candidate map pins them there: a cloud base and a
 * mixing ratio are states the analysis holds, so f00 is a real answer rather
 * than an empty one. The satellite and the radar take no hour at all — they are
 * scenes, and each carries its own valid time.
 *
 * `candidate` is fetched first even though it is drawn last. It is the join, so
 * building it warms every source the other four read, and the remaining fetches
 * come back off that build instead of paying for their own.
 */
const LAYERS = [
  {
    key: "cloudBase",
    name: "CLOUD BASE",
    path: (at) => `/forecast/cloudbase?hour=0&at=${encodeURIComponent(at)}`,
    property: "cloudBaseFt",
    unit: "ft MSL",
  },
  {
    key: "cloudTop",
    name: "CLOUD TOPS",
    path: (at) => `/cloudtop/temperature?at=${encodeURIComponent(at)}`,
    property: "topColdnessC",
    unit: "°C below zero",
  },
  {
    key: "liquid",
    name: "SUPERCOOLED LIQUID WATER",
    path: (at) => `/forecast/liquid?hour=0&at=${encodeURIComponent(at)}`,
    property: "slwPath",
    unit: "g/m²",
  },
  {
    key: "radar",
    name: "RADAR REFLECTIVITY",
    path: (at) => `/radar/reflectivity?at=${encodeURIComponent(at)}`,
    property: "reflectivity",
    unit: "dBZ",
  },
  {
    key: "candidate",
    name: "SEEDING OPPORTUNITY",
    path: (at) => `/candidate/field?at=${encodeURIComponent(at)}`,
    property: "seedableSlwPath",
    unit: "g/m²",
  },
];

/** Warms the most caches first; the file still lists them in draw order. */
const FETCH_ORDER = ["candidate", "liquid", "cloudBase", "cloudTop", "radar"];

/* ---------- geometry ---------- */

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
 * have, and a false coastline through the middle of a cloud is worse than a few
 * kilobytes.
 */
function simplify(ring) {
  if (!ring.some(inWindow)) return null;
  const out = ring.map(([lon, lat]) => [round(lon), round(lat)]);
  return out.length >= 4 ? out : null;
}

async function ask(path) {
  const res = await fetch(new URL(path, SERVER), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return res.json();
}

async function frameAt(layer, at) {
  const frame = await ask(layer.path(at));

  const levels = [];
  for (const feature of frame.features ?? []) {
    const level = feature.properties?.[layer.property];
    const polygons = [];
    for (const polygon of feature.geometry?.coordinates ?? []) {
      const rings = polygon.map(simplify).filter(Boolean);
      if (rings.length) polygons.push(rings);
    }
    if (polygons.length) levels.push({ level, polygons });
  }

  return { validTime: frame.validTime ?? at, levels };
}

/* ---------- the drift vector ---------- */

const KM_PER_KNOT_HOUR = 1.852;
const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LON = 111.32;

/**
 * Where the air over a release point had gone by the end of the bracket.
 *
 * Straight-line advection by HRRR's own 0–6 km storm motion at that cell. It is
 * a first-order answer and it is worth being clear about what it is not: the
 * motion is sampled once, at the start of the gap, and carried at constant
 * speed and bearing for an hour. A turning or accelerating system is not
 * described by it. What it does do is give the two frames a direction to be read
 * in, so a cloud in the second frame can be recognised as the one from the
 * first rather than guessed at.
 */
async function driftFrom(release, from, to) {
  const hours = (new Date(to) - new Date(from)) / 3_600_000;
  const sounding = await ask(
    `/forecast/sounding?lat=${release.lat}&lon=${release.lon}` +
      `&hour=0&at=${encodeURIComponent(from)}`
  );

  const kt = sounding.diagnostics?.stormMotionKt ?? null;
  const toward = sounding.diagnostics?.stormMotionTowardDeg ?? null;
  // A bearing off a still vector is not a direction. Say so instead of drawing
  // an arrow pointing north.
  if (kt === null || toward === null || kt === 0) {
    return { stormMotionKt: kt, stormMotionTowardDeg: toward, to: null, hours };
  }

  const km = kt * KM_PER_KNOT_HOUR * hours;
  const radians = (toward * Math.PI) / 180;
  const lat = release.lat + (km * Math.cos(radians)) / KM_PER_DEGREE_LAT;
  const lon =
    release.lon +
    (km * Math.sin(radians)) /
      (KM_PER_DEGREE_LON * Math.cos((release.lat * Math.PI) / 180));

  return {
    stormMotionKt: kt,
    stormMotionTowardDeg: toward,
    hours,
    km: Math.round(km),
    to: [round(lon), round(lat)],
  };
}

/* ---------- the day ---------- */

const { days } = JSON.parse(
  await readFile(join(DATA, region.releases), "utf8")
);
const day = days.find((entry) => entry.date === DATE && entry.seeded);
if (!day) {
  console.error(`no seeded report for ${DATE} in ${region.name}`);
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
const verdicts = new Map();
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
  `${region.name}\n${DATE} — ${releases.length} flares, ${hours.length} analyses, ` +
    `${LAYERS.length} layers\n`
);

const frames = {};
for (const hour of hours) {
  frames[hour] = {};
  console.log(`  ${hour}`);
  for (const key of FETCH_ORDER) {
    const layer = LAYERS.find((entry) => entry.key === key);
    const started = Date.now();
    try {
      const frame = await frameAt(layer, hour);
      frames[hour][key] = frame;
      const rings = frame.levels.reduce(
        (n, level) => n + level.polygons.reduce((m, p) => m + p.length, 0),
        0
      );
      console.log(
        `    ${key.padEnd(10)} ${String(frame.levels.length).padStart(2)} levels  ` +
          `${String(rings).padStart(5)} rings  ` +
          `${((Date.now() - started) / 1000).toFixed(0)}s`
      );
    } catch (failure) {
      frames[hour][key] = {
        validTime: hour,
        levels: [],
        error: failure.message,
      };
      console.log(`    ${key.padEnd(10)} failed: ${failure.message}`);
    }
  }
}

// One interval per consecutive pair, carrying the flares released inside it.
console.log("\n  drift");
const intervals = [];
for (let i = 0; i < hours.length - 1; i++) {
  const from = hours[i];
  const to = hours[i + 1];
  const inside = [];

  for (const release of releases.filter((r) => r.at >= from && r.at < to)) {
    let drift = null;
    try {
      drift = await driftFrom(release, from, to);
    } catch (failure) {
      console.log(`    ${release.timeZ}Z failed: ${failure.message}`);
    }
    inside.push({
      at: release.at,
      timeZ: release.timeZ,
      lon: release.lon,
      lat: release.lat,
      county: release.county,
      plane: release.plane,
      glaciogenic: release.glaciogenic,
      hygroscopic: release.hygroscopic,
      payload:
        release.glaciogenic && release.hygroscopic
          ? "both"
          : release.hygroscopic
            ? "hygroscopic"
            : "glaciogenic",
      held: verdicts.get(release.at) ?? null,
      drift,
    });
  }

  if (inside.length) {
    const moving = inside.filter((f) => f.drift?.to);
    console.log(
      `    ${from.slice(11, 16)}→${to.slice(11, 16)}  ${inside.length} flares  ` +
        (moving.length
          ? `${Math.round(
              moving.reduce((n, f) => n + f.drift.stormMotionKt, 0) /
                moving.length
            )} kt mean`
          : "no motion")
    );
    intervals.push({ from, to, flares: inside });
  }
}

await mkdir(OUT, { recursive: true });
const file = join(OUT, `held-${DATE}.json`);
// Written compact rather than indented. Five layers at three analyses is most of
// a megabyte of coordinates, and pretty-printing them triples the file the page
// has to pull for no reader — nothing opens this by hand.
await writeFile(
  file,
  `${JSON.stringify({
    date: DATE,
    region: region.id,
    server: SERVER,
    window: WINDOW,
    layers: LAYERS.map(({ key, name, property, unit }) => ({
      key,
      name,
      property,
      unit,
    })),
    hours,
    soundings: day.soundings ?? null,
    observations: day.observations ?? [],
    frames,
    intervals,
  })}\n`
);

const bytes = (await readFile(file)).length;
console.log(
  `\n${intervals.length} intervals, ` +
    `${intervals.reduce((n, i) => n + i.flares.length, 0)} flares placed\n` +
    `written to eval/out/held-${DATE}.json (${(bytes / 1024 / 1024).toFixed(1)} MB)`
);
