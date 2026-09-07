/**
 * Everything a map needs to show one flying day, in one file.
 *
 * `node eval/paint.mjs 2025-04-19 [--region=wtwma]` — with the Weatherman server
 * running. Writes the name `data/regions.json` gives that programme, e.g.
 * `eval/out/painted-2025-04-19.json` for West Texas.
 *
 * **It paints the product's own layers, not a layer invented for the page.**
 * Each fill is the same route the maps fetch, at the same hour parameter,
 * carrying the same property — so a band drawn here is the band Weatherman
 * draws. `candidate` is the quiet-liquid join at `/candidate/field`.
 * `target` is the Texas fly fill at `/candidate/target`. Cores, heading
 * ticks, and lightning are the same marks the candidate map draws under
 * radar, stored beside the fills.
 *
 * **The question is how near, not whether inside.** Asking whether a flare
 * landed in the paint gives one bit and throws away how badly it missed, and a
 * release 3 km outside a contour is a different result from one 80 km away. Only
 * the distance can separate a map that is wrong from operators who are working
 * off something we do not have. So every release gets a distance to the nearest
 * edge of every layer, in kilometres, and being inside is simply distance zero.
 *
 * **Every release also carries what a click on it would have said.** The
 * operator map answers a click with FLY or DON'T FLY and the numbers behind
 * the call, the modelled column over that point, and the storm the point sat
 * in. All three are stored on the flare — `cell`, `column` and `storm` — from
 * the same routes the panel calls, so the page can read out the release the
 * way an operator would have read out that cell.
 *
 * **Each release is measured against the analysis nearest its own minute**, by
 * the same rounding rule the server uses — 1843Z is charged to 19Z, seventeen
 * minutes away, not to 18Z which is forty-three. One frame per release, chosen
 * by the clock, so nothing has to be selected to read the answer.
 *
 * **The remaining minutes are closed with the storm motion.** Each layer is
 * fetched at the flare's own timestamp — GOES and radar already answer about
 * that minute, HRRR still rounds to the nearer hour — and the release is
 * carried along HRRR's 0–6 km storm motion over that layer's own valid-time
 * gap. The offset is signed: a release after the half hour is charged to the
 * next analysis and drifts forward, one before it drifts back.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER, stormNear } from "./lib/weatherman.mjs";
import { distanceToPolygonsKm } from "./lib/geo.mjs";
import { stormFromReading } from "./lib/storm-score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");

const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

const DATE = process.argv.find((arg) => /^\d{4}-\d{2}-\d{2}$/.test(arg));
const REGION =
  process.argv.find((arg) => arg.startsWith("--region="))?.slice(9) ?? "wtwma";

if (!DATE) {
  console.error("usage: node eval/paint.mjs <YYYY-MM-DD> [--region=wtwma]");
  process.exit(1);
}

/**
 * Native cell size of each layer, kilometres. Inside means inside the contour
 * after that layer's own drift; these numbers are the next honest step out,
 * not a second definition of inside.
 */
const CELL_KM = {
  cloudBase: 3,
  cloudTop: 2,
  liquid: 3,
  radar: 1,
  candidate: 3,
  target: 3,
  baseWindow: 3,
  echoFreeze: 3,
};

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

/** Ask the server to contour this programme's box, not all of Texas. */
function withBox(path) {
  const sep = path.includes("?") ? "&" : "?";
  return (
    `${path}${sep}west=${WINDOW.west}&east=${WINDOW.east}` +
    `&south=${WINDOW.south}&north=${WINDOW.north}`
  );
}

/* ---------- the layers, as the replay map draws them ---------- */

/**
 * The fills, as the maps draw them.
 *
 * Same routes, same properties. Each request carries the flare's own timestamp
 * as `at`. `hour=0` on the HRRR fields for the reason the candidate map pins
 * them there: a cloud base and a mixing ratio are states the analysis holds,
 * so f00 is a real answer rather than an empty one. The satellite and the
 * radar take no hour at all — they are scenes, and each carries its own
 * valid time. The join already splits those clocks: HRRR rounds to the hour,
 * GOES and radar keep the minute.
 *
 * `candidate` is fetched first. It is the quiet-liquid join, so building it
 * warms every source the Texas fly fill and the other HRRR fields read.
 */
const LAYERS = [
  {
    key: "cloudBase",
    name: "CLOUD BASE",
    path: (at) =>
      `/forecast/cloudbase?hour=0&at=${encodeURIComponent(at)}&fine=1`,
    property: "cloudBaseFt",
    unit: "ft MSL",
    shape: "disjoint",
    cellKm: CELL_KM.cloudBase,
  },
  {
    key: "cloudTop",
    name: "CLOUD TOPS",
    path: (at) => `/cloudtop/temperature?at=${encodeURIComponent(at)}&fine=1`,
    property: "topColdnessC",
    unit: "°C below zero",
    shape: "disjoint",
    cellKm: CELL_KM.cloudTop,
  },
  {
    key: "liquid",
    name: "SUPERCOOLED LIQUID WATER",
    path: (at) => `/forecast/liquid?hour=0&at=${encodeURIComponent(at)}&fine=1`,
    property: "slwPath",
    unit: "g/m²",
    shape: "nested",
    cellKm: CELL_KM.liquid,
  },
  {
    key: "radar",
    name: "RADAR REFLECTIVITY",
    path: (at) => `/radar/reflectivity?at=${encodeURIComponent(at)}&fine=1`,
    property: "reflectivity",
    unit: "dBZ",
    shape: "nested",
    cellKm: CELL_KM.radar,
  },
  {
    key: "candidate",
    name: "SEEDING OPPORTUNITY",
    path: (at) => `/candidate/field?at=${encodeURIComponent(at)}&fine=1`,
    property: "seedableSlwPath",
    unit: "g/m²",
    shape: "nested",
    cellKm: CELL_KM.candidate,
  },
  {
    key: "target",
    name: "TEXAS FLY FILL",
    path: (at) => `/candidate/target?at=${encodeURIComponent(at)}&fine=1`,
    property: "fly",
    unit: "pass",
    shape: "disjoint",
    cellKm: CELL_KM.target,
  },
  {
    key: "baseWindow",
    name: "BASE WINDOW",
    path: (at) =>
      `/forecast/cloudbase/window?hour=0&at=${encodeURIComponent(at)}&fine=1`,
    property: "inWindow",
    unit: "pass",
    shape: "disjoint",
    cellKm: CELL_KM.baseWindow,
  },
  {
    key: "echoFreeze",
    name: "ECHO PAST FREEZING",
    path: (at) =>
      `/radar/echotop/past-freezing?at=${encodeURIComponent(at)}&fine=1`,
    property: "pastFreezing",
    unit: "pass",
    shape: "disjoint",
    cellKm: CELL_KM.echoFreeze,
  },
];

/** Warms the join first; the Texas fill reads that same cached scene. */
const FETCH_ORDER = [
  "candidate",
  "target",
  "liquid",
  "cloudBase",
  "baseWindow",
  "echoFreeze",
  "cloudTop",
  "radar",
];

/* ---------- geometry ---------- */

/** Three decimals is about 100 m, finer than the 1 km radar cell. */
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

/**
 * The same request, with a click off the edge of the model answered null.
 *
 * The point and column routes both refuse a point outside the grid with a 404,
 * which the map treats as "not here" rather than as a failure. A release that
 * far out is a fact about the record, not a broken run, so it is stored as
 * nothing rather than as an error.
 */
async function askPoint(path) {
  const res = await fetch(new URL(path, SERVER), {
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return res.json();
}

const framesByPath = new Map();

async function frameAt(layer, at) {
  const path = withBox(layer.path(at));
  const cached = framesByPath.get(path);
  if (cached) return cached;

  const work = (async () => {
    const frame = await ask(path);
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
  })();

  framesByPath.set(path, work);
  return work;
}

function pointsOf(frame) {
  const points = [];
  for (const feature of frame.features ?? []) {
    const pair = feature.geometry?.coordinates;
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = round(pair[0]);
    const lat = round(pair[1]);
    if (inWindow([lon, lat])) points.push([lon, lat]);
  }
  return { validTime: frame.validTime ?? null, points };
}

function ringsOf(frame) {
  const rings = [];
  for (const feature of frame.features ?? []) {
    for (const ring of feature.geometry?.coordinates ?? []) {
      const simplified = simplify(ring);
      if (simplified) rings.push(simplified);
    }
  }
  return { validTime: frame.validTime ?? null, rings };
}

async function marksAt(at) {
  const q = (path) => withBox(`${path}?at=${encodeURIComponent(at)}&fine=1`);
  const emptyPoints = { validTime: at, points: [] };
  const emptyRings = { validTime: at, rings: [] };
  const cores = await ask(q("/radar/objects/cores")).then(
    pointsOf,
    (failure) => ({
      ...emptyPoints,
      error: failure.message,
    })
  );
  const heading = await ask(q("/radar/objects/motion")).then(
    ringsOf,
    (failure) => ({ ...emptyRings, error: failure.message })
  );
  const lightning = await ask(
    withBox(`/cloudtop/lightning?at=${encodeURIComponent(at)}`)
  ).then(pointsOf, (failure) => ({ ...emptyPoints, error: failure.message }));
  return { cores, heading, lightning };
}

/* ---------- the clock ---------- */

/**
 * The analysis a release is charged to.
 *
 * The same rule as `nearestHour` in the server's `shared/replay.ts`: round to
 * the nearer hour rather than truncate, so 1843Z is answered by 19Z at seventeen
 * minutes rather than 18Z at forty-three. Copied rather than imported because
 * this is a plain node script and that is TypeScript in another package — if the
 * server's rule changes, this has to change with it.
 */
function nearestHour(at) {
  const hour = new Date(at);
  hour.setUTCMinutes(0, 0, 0);
  if (new Date(at).getUTCMinutes() >= 30) {
    hour.setUTCHours(hour.getUTCHours() + 1);
  }
  return hour.toISOString();
}

/* ---------- the drift vector ---------- */

const KM_PER_KNOT_HOUR = 1.852;
const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LON = 111.32;

/**
 * The modelled column over a release, at the analysis the flare is charged to.
 *
 * The same answer `/map/candidate` prints after a click: the ground, the
 * freezing level, the seeding band, and the wrfsfc diagnostics under them.
 * `levels` is kept whole so the −15 °C height is read here the way the panel
 * reads it, by interpolating the profile rather than by a second rule written
 * in this file.
 *
 * The storm motion the drift is built from is two of those diagnostics, so one
 * request answers both questions.
 */
async function columnAt(release, hour) {
  const sounding = await askPoint(
    `/forecast/sounding?lat=${release.lat}&lon=${release.lon}` +
      `&hour=0&at=${encodeURIComponent(hour)}`
  );
  if (!sounding) return null;
  return {
    validTime: sounding.validTime ?? hour,
    surfaceFt: sounding.surfaceFt ?? null,
    freezingFt: sounding.freezingFt ?? null,
    bandBaseFt: sounding.bandBaseFt ?? null,
    bandTopFt: sounding.bandTopFt ?? null,
    levels: sounding.levels ?? [],
    diagnostics: sounding.diagnostics ?? null,
  };
}

/**
 * The join read over the 3 km cell the release landed in, at its own minute.
 *
 * `/candidate/point` is the route behind FLY and DON'T FLY, and it carries the
 * numbers that made the call. The radar and the satellite in it answer about
 * the release minute, so it is asked at the flare's own timestamp rather than
 * at the analysis — the same split of clocks the fills are fetched on.
 */
async function cellAt(release) {
  const point = await askPoint(
    `/candidate/point?lat=${release.lat}&lon=${release.lon}` +
      `&at=${encodeURIComponent(release.at)}`
  );
  if (!point) return null;
  return {
    validTime: point.validTime ?? null,
    radarTime: point.radarTime ?? null,
    /** "target" is the cell an operator is told to fly. */
    target: point.target ?? null,
    cloudBaseAglFt: point.cloudBaseAglFt ?? null,
    echoTopFt: point.echoTopFt ?? null,
    freezingFt: point.freezingFt ?? null,
    dbz: point.dbz ?? null,
    radarCovered: point.radarCovered ?? false,
    slwGM2: point.slwGM2 ?? null,
  };
}

/**
 * Where the air over a release point is at `when`.
 *
 * Straight-line advection by the sampled storm motion over the signed offset
 * between the release minute and that timestamp. First-order: constant speed
 * and bearing, so a system that turned inside those minutes is not described
 * by it. For GOES and radar `when` is the scan, usually a couple of minutes
 * away; for HRRR it is the analysis hour.
 */
function advect(release, motion, when) {
  const hours = (new Date(when) - new Date(release.at)) / 3_600_000;
  const kt = motion.stormMotionKt;
  const toward = motion.stormMotionTowardDeg;
  // A bearing off a still vector is not a direction. Say so instead of drawing
  // an arrow pointing north.
  if (kt === null || toward === null || kt === 0) {
    return {
      stormMotionKt: kt,
      stormMotionTowardDeg: toward,
      offsetMinutes: Math.round(hours * 60),
      to: null,
    };
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
    offsetMinutes: Math.round(hours * 60),
    km: Math.round(Math.abs(km) * 10) / 10,
    to: [round(lon), round(lat)],
  };
}

/* ---------- how near ---------- */

/**
 * Everything a layer covers at all, as one set of polygons.
 *
 * **Which levels that is depends on how the layer's bands relate**, and getting
 * it wrong quietly measures the wrong thing. Nested bands stack, so the first
 * level already contains every other — the 10 g/m² liquid contour encloses the
 * 50, 150 and 400 ones — and taking it alone is exactly "any liquid at all".
 * Disjoint bands do not: cloud base's first level is only the cloud under 6,000
 * ft, and measuring to it reports the distance to low cloud while claiming to
 * report the distance to cloud. Those have to be unioned.
 */
function coverage(frame, shape) {
  const levels = frame?.levels ?? [];
  if (!levels.length) return null;
  return shape === "nested"
    ? levels[0].polygons
    : levels.flatMap((level) => level.polygons);
}

/**
 * How far a release was from each layer, in kilometres.
 *
 * The question at this stage is whether there was any of that field there at
 * all, not how much of it. A distance to the richest band would answer a
 * different and much harsher question.
 *
 * Measured from the drifted position where there is one, and from the release
 * point where the model has the air standing still. Both are kept: the raw
 * distance is what a reader would compute by hand off the report, and the
 * difference between them is what closing the clock offset was worth.
 */
function nearness(frame, layer, lon, lat, raw) {
  const polygons = coverage(frame, layer.shape);
  if (!polygons) return null;
  const drifted = distanceToPolygonsKm(polygons, lon, lat);
  const atRelease = distanceToPolygonsKm(polygons, raw[0], raw[1]);
  return {
    /** What "any at all" meant for this layer, so the number can be read. */
    measuredTo:
      layer.shape === "nested"
        ? `the ${frame.levels[0].level} ${layer.unit} contour`
        : "any band of this layer",
    inside: drifted.inside,
    km: drifted.km,
    kmAtRelease: atRelease.km,
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

// One analysis per release, and only the distinct ones are fetched.
const byHour = new Map();
for (const release of releases) {
  const hour = nearestHour(release.at);
  if (!byHour.has(hour)) byHour.set(hour, []);
  byHour.get(hour).push(release);
}
const hours = [...byHour.keys()].sort();

console.log(
  `${region.name}\n${DATE} — ${releases.length} flares, ${hours.length} analyses, ` +
    `${LAYERS.length} layers\n`
);

const frames = {};
const marks = {};
for (const hour of hours) {
  frames[hour] = {};
  console.log(`  ${hour}  (${byHour.get(hour).length} flares)`);
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
  const started = Date.now();
  marks[hour] = await marksAt(hour);
  const failed = ["cores", "heading", "lightning"]
    .filter((key) => marks[hour][key].error)
    .map((key) => `${key}: ${marks[hour][key].error}`);
  if (failed.length) {
    console.log(`    marks      failed: ${failed.join("; ")}`);
  } else {
    console.log(
      `    cores      ${String(marks[hour].cores.points.length).padStart(2)} dots   ` +
        `heading ${marks[hour].heading.rings.length}  ` +
        `lightning ${marks[hour].lightning.points.length}  ` +
        `${((Date.now() - started) / 1000).toFixed(0)}s`
    );
  }
}

console.log("\n  drift and distance");
const analyses = [];
for (const hour of hours) {
  const flares = [];

  for (const release of byHour.get(hour)) {
    let column = null;
    try {
      column = await columnAt(release, hour);
    } catch (failure) {
      console.log(`    ${release.timeZ}Z column failed: ${failure.message}`);
    }
    const motion = {
      stormMotionKt: column?.diagnostics?.stormMotionKt ?? null,
      stormMotionTowardDeg: column?.diagnostics?.stormMotionTowardDeg ?? null,
    };

    const drift = advect(release, motion, hour);
    const raw = [release.lon, release.lat];
    const at = drift?.to ?? raw;
    const near = {};
    for (const layer of LAYERS) {
      const scored = await frameAt(layer, release.at).catch(
        () => frames[hour][layer.key]
      );
      const when = scored?.validTime ?? hour;
      const shifted = advect(release, motion, when);
      const from = shifted.to ?? raw;
      near[layer.key] = nearness(scored, layer, from[0], from[1], raw);
      if (near[layer.key]) {
        near[layer.key].validTime = scored?.validTime ?? null;
        near[layer.key].offsetMinutes = shifted.offsetMinutes;
      }
    }

    let storm = null;
    try {
      storm = stormFromReading(
        await stormNear(release.lat, release.lon, release.at)
      );
    } catch (failure) {
      console.log(`    ${release.timeZ}Z storm failed: ${failure.message}`);
    }

    let cell = null;
    try {
      cell = await cellAt(release);
    } catch (failure) {
      console.log(`    ${release.timeZ}Z cell failed: ${failure.message}`);
    }

    flares.push({
      at: release.at,
      timeZ: release.timeZ,
      lon: release.lon,
      lat: release.lat,
      county: release.county,
      plane: release.plane,
      glaciogenic: release.glaciogenic,
      hygroscopic: release.hygroscopic,
      // Null where the report says a flare was released and not how many,
      // which is every Panhandle row.
      payload:
        release.glaciogenic === null && release.hygroscopic === null
          ? null
          : release.glaciogenic && release.hygroscopic
            ? "both"
            : release.hygroscopic
              ? "hygroscopic"
              : "glaciogenic",
      offsetMinutes: drift?.offsetMinutes ?? null,
      drift,
      /** Where the release point is at the analysis time, if it could drift. */
      compared: at,
      near,
      storm,
      /** What a click on this point at this minute would have said. */
      cell,
      column,
    });

    const fly = near.target;
    console.log(
      `    ${release.timeZ}Z  ${String(drift?.offsetMinutes ?? "?").padStart(3)}m  ` +
        `${String(drift?.stormMotionKt ?? "?").padStart(2)}kt  ` +
        `${cell ? (cell.target === "target" ? "FLY      " : "DON'T FLY") : "no click "}  ` +
        `fly fill ${fly ? (fly.inside ? "inside" : `${fly.km} km`) : "no frame"}` +
        (fly && !fly.inside && fly.kmAtRelease !== fly.km
          ? `  (${fly.kmAtRelease} km undrifted)`
          : "")
    );
  }

  analyses.push({ at: hour, flares });
}

await mkdir(OUT, { recursive: true });
/**
 * The name the region entry gives this run, not one built here.
 *
 * **Every region has to name its own file or they collide.** Two programmes fly
 * the same afternoon — 17 August 2025 is a flying day in both West Texas and
 * Trans-Pecos — and a name built from the date alone means the second run
 * silently overwrites the first, leaving a file whose `region` says one thing
 * and whose name says another.
 */
const file = join(
  OUT,
  (region.runs?.painted ?? "painted-{date}.json").replace("{date}", DATE)
);
// Written compact rather than indented. Several fills at several analyses
// is most of a megabyte of coordinates, and pretty-printing them triples
// the file the page has to pull for no reader — nothing opens this by hand.
await writeFile(
  file,
  `${JSON.stringify({
    date: DATE,
    region: region.id,
    server: SERVER,
    window: WINDOW,
    cellKm: CELL_KM,
    layers: LAYERS.map(({ key, name, property, unit, cellKm }) => ({
      key,
      name,
      property,
      unit,
      cellKm,
    })),
    hours,
    soundings: day.soundings ?? null,
    observations: day.observations ?? [],
    frames,
    marks,
    analyses,
  })}\n`
);

const all = analyses.flatMap((entry) => entry.flares);
const inside = all.filter((flare) => flare.near.target?.inside).length;
const flown = all.filter((flare) => flare.cell?.target === "target").length;
const clicked = all.filter((flare) => flare.cell).length;

const bytes = (await readFile(file)).length;
console.log(
  `\n${all.length} flares over ${hours.length} analyses\n` +
    `  inside the fly fill: ${inside}\n` +
    `  a click would have said FLY: ${flown} of ${clicked} answered\n` +
    `written to ${file} (${(bytes / 1024 / 1024).toFixed(1)} MB)`
);
