/**
 * Fill storm readings (and radar marks, if missing) on a painted day.
 *
 * `node eval/fill-storms.mjs eval/out/painted-2025-05-22.json`
 *
 * Paint writes the file only at the end, so a wedged hour leaves storms
 * null. This walks the flares one at a time, retries a failed reading,
 * and writes after each so a second wedge keeps what already landed.
 */

// Node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const exec = promisify(execFile);

// Local
import { SERVER, stormNear } from "./lib/weatherman.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = process.argv[2];
const HEARTBEAT = process.env.TEXAS_EVAL_HEARTBEAT
  ? join(process.cwd(), process.env.TEXAS_EVAL_HEARTBEAT)
  : join(HERE, "out", "texas-eval-heartbeat.json");

if (!FILE) {
  console.error("usage: node eval/fill-storms.mjs <painted.json>");
  process.exit(1);
}

const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function stormOf(reading) {
  if (!reading || reading.error) return null;
  return {
    inside: reading.inside ?? false,
    inWorking: reading.inWorking ?? false,
    coreKm: reading.coreKm ?? null,
    edgeKm: reading.edgeKm ?? null,
    upwindEdgeKm: reading.upwindEdgeKm ?? null,
    object: reading.object
      ? {
          id: reading.object.id,
          maxDbz: reading.object.maxDbz,
          areaKm2: reading.object.areaKm2,
          ageMin: reading.object.ageMin ?? null,
          ageFloor: reading.object.ageFloor ?? false,
          motionTowardDeg: reading.object.motionTowardDeg ?? null,
          motionKmh: reading.object.motionKmh ?? null,
          areaDeltaKm2: reading.object.areaDeltaKm2 ?? null,
          coreLat: reading.object.coreLat,
          coreLon: reading.object.coreLon,
        }
      : null,
    slwGM2: reading.slwGM2 ?? null,
    goesTopC: reading.goesTopC ?? null,
    goesTopDeltaC: reading.goesTopDeltaC ?? null,
    glmFlashes: reading.glmFlashes ?? null,
    echoTopFt: reading.echoTopFt ?? null,
    modelEchoTopFt: reading.modelEchoTopFt ?? null,
    freezingFt: reading.freezingFt ?? null,
  };
}

function stormNeedsFill(storm) {
  if (!storm) return true;
  if (!("echoTopFt" in storm)) return true;
  if (
    storm.object &&
    storm.object.coreLat == null &&
    storm.object.motionTowardDeg != null
  ) {
    return true;
  }
  return false;
}

async function beat(phase, extra) {
  const body = {
    t: new Date().toISOString(),
    phase,
    file: FILE,
    ...extra,
  };
  try {
    await writeFile(HEARTBEAT, `${JSON.stringify(body)}\n`);
  } catch {
    /* a missed beat is not the work */
  }
}

async function apiUp() {
  try {
    const res = await fetch(new URL("/healthcheck", SERVER), {
      signal: AbortSignal.timeout(5000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

const INDEX = join(HERE, "..", "server", "src", "index.ts");
const LOW_MEM = 1.5 * 1024 * 1024 * 1024;

/** Drop the mosaic cache before it fills the box. */
async function recycleApi(why) {
  const free = os.freemem();
  console.log(
    `  recycle API (${why}); free ${(free / 1e9).toFixed(1)} GiB`
  );
  await beat("recycle", { why, free });
  await exec("touch", [INDEX]);
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    if (await apiUp()) return true;
  }
  console.log("  API did not come back after recycle");
  return false;
}

async function once(fn) {
  let last = null;
  for (let i = 0; i < 8; i++) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      console.log(`  retry ${i + 1}: ${error.message}`);
      if (!(await apiUp())) {
        console.log("  API down — waiting for it to come back");
        for (let w = 0; w < 24 && !(await apiUp()); w++) {
          await beat("wait-api", { attempt: i, wait: w });
          await sleep(5000);
        }
      } else {
        await sleep(4000 * Math.min(i + 1, 4));
      }
    }
  }
  throw last;
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

const round = (value) => Math.round(value * 1000) / 1000;

const painted = JSON.parse(await readFile(FILE, "utf8"));
const window = painted.window;

function inWindow([lon, lat]) {
  if (!window) return true;
  return (
    lon >= window.west &&
    lon <= window.east &&
    lat >= window.south &&
    lat <= window.north
  );
}

function withBox(path) {
  if (!window) return path;
  const sep = path.includes("?") ? "&" : "?";
  return (
    `${path}${sep}west=${window.west}&east=${window.east}` +
    `&south=${window.south}&north=${window.north}`
  );
}

function simplify(ring) {
  if (!ring.some(inWindow)) return null;
  const out = ring.map(([lon, lat]) => [round(lon), round(lat)]);
  return out.length >= 4 ? out : null;
}

function pointsOf(frame, at) {
  const points = [];
  for (const feature of frame.features ?? []) {
    const pair = feature.geometry?.coordinates;
    if (!Array.isArray(pair) || pair.length < 2) continue;
    const lon = round(pair[0]);
    const lat = round(pair[1]);
    if (inWindow([lon, lat])) points.push([lon, lat]);
  }
  return { validTime: frame.validTime ?? at, points };
}

function ringsOf(frame, at) {
  const rings = [];
  for (const feature of frame.features ?? []) {
    for (const ring of feature.geometry?.coordinates ?? []) {
      const simplified = simplify(ring);
      if (simplified) rings.push(simplified);
    }
  }
  return { validTime: frame.validTime ?? at, rings };
}

async function marksAt(at) {
  const q = (path) => withBox(`${path}?at=${encodeURIComponent(at)}&fine=1`);
  const emptyPoints = { validTime: at, points: [] };
  const emptyRings = { validTime: at, rings: [] };
  const cores = await ask(q("/radar/objects/cores")).then(
    (frame) => pointsOf(frame, at),
    (failure) => ({ ...emptyPoints, error: failure.message })
  );
  const heading = await ask(q("/radar/objects/motion")).then(
    (frame) => ringsOf(frame, at),
    (failure) => ({ ...emptyRings, error: failure.message })
  );
  const lightning = await ask(
    withBox(`/cloudtop/lightning?at=${encodeURIComponent(at)}`)
  ).then(
    (frame) => pointsOf(frame, at),
    (failure) => ({ ...emptyPoints, error: failure.message })
  );
  return { cores, heading, lightning };
}

console.log(`fill ${FILE}\nagainst ${SERVER}\n`);

painted.marks ??= {};
for (const hour of painted.hours ?? []) {
  const have = painted.marks[hour];
  const missing =
    !have ||
    have.cores?.error ||
    have.heading?.error ||
    have.lightning?.error ||
    (have.cores && !("points" in have.cores));
  if (!missing) continue;
  await beat("marks", { hour });
  process.stdout.write(`  marks ${hour}… `);
  try {
    painted.marks[hour] = await once(() => marksAt(hour));
    const marks = painted.marks[hour];
    console.log(
      `cores ${marks.cores.points.length}  heading ${marks.heading.rings.length}  lightning ${marks.lightning.points.length}`
    );
  } catch (error) {
    console.log(`failed: ${error.message}`);
  }
  await writeFile(FILE, `${JSON.stringify(painted)}\n`);
}

if ((painted.hours ?? []).length) {
  await recycleApi("after marks");
}

let filled = 0;
let failed = 0;
let skipped = 0;
for (const analysis of painted.analyses ?? []) {
  for (const flare of analysis.flares ?? []) {
    if (!stormNeedsFill(flare.storm)) {
      skipped += 1;
      continue;
    }
    if (os.freemem() < LOW_MEM) {
      await recycleApi("low memory");
    }
    await beat("storm", { at: flare.at, timeZ: flare.timeZ });
    process.stdout.write(`  ${flare.timeZ}Z storm… `);
    try {
      const reading = await once(() =>
        stormNear(flare.lat, flare.lon, flare.at)
      );
      flare.storm = stormOf(reading);
      console.log(flare.storm ? "ok" : "none");
      filled += 1;
    } catch (error) {
      flare.storm = null;
      console.log(`fail: ${error.message}`);
      failed += 1;
    }
    await writeFile(FILE, `${JSON.stringify(painted)}\n`);
    await sleep(1500);
    if (filled > 0 && filled % 2 === 0) {
      await recycleApi("every two storms");
    }
  }
}

console.log(
  `\nfilled ${filled}, already had ${skipped}, failed ${failed}`
);
if (failed > 0) process.exitCode = 2;
