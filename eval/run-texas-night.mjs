/**
 * Paint a representative sample of flying days, rotating programmes, and
 * keep a log of which days already have Texas storm readings.
 *
 * `WEATHERMAN_SERVER=http://127.0.0.1:3001 node eval/run-texas-night.mjs`
 *
 * Safe to restart: completed days stay completed. One child at a time.
 */

// Node
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");
const PROGRESS = join(OUT, "texas-eval-progress.json");
const HEARTBEAT = join(OUT, "texas-eval-heartbeat.json");
const LOG = join(OUT, "texas-eval-run.log");
const LOCK = join(OUT, "texas-eval.lock");

const SERVER = process.env.WEATHERMAN_SERVER ?? "http://127.0.0.1:3001";
const PAINT_MS = Number(process.env.TEXAS_EVAL_PAINT_MS ?? 75 * 60 * 1000);
const FILL_MS = Number(process.env.TEXAS_EVAL_FILL_MS ?? 40 * 60 * 1000);

const { regions } = JSON.parse(await readFile(join(DATA, "regions.json"), "utf8"));

function paintedName(regionId, date) {
  const region = regions.find((entry) => entry.id === regionId);
  return (region?.runs?.painted ?? "painted-{date}.json").replace(
    "{date}",
    date
  );
}

function paintedPath(regionId, date) {
  return join(OUT, paintedName(regionId, date));
}

/** New paints stay this small so the API cannot fill 6 GiB. */
const MAX_FLARES = 7;

/** Rotate programmes. Twelve flares or fewer so morning has finished days. */
const QUEUE = [
  // Already-painted days: fill storms and marks, do not rebuild the five fills.
  { region: "transpecos", date: "2025-08-12", kind: "fill", n: 18 },
  { region: "panhandle", date: "2025-08-11", kind: "fill", n: 10 },
  { region: "plains", date: "2025-06-30", kind: "fill", n: 12 },
  { region: "wtwma", date: "2025-08-11", kind: "fill", n: 11, note: "19Z only" },
  // New days, jumping programmes.
  { region: "transpecos", date: "2025-04-16", kind: "paint", n: 10 },
  { region: "plains", date: "2025-06-10", kind: "paint", n: 11 },
  { region: "wtwma", date: "2025-05-09", kind: "paint", n: 9 },
  { region: "transpecos", date: "2025-05-04", kind: "paint", n: 8 },
  { region: "stwma", date: "2025-03-31", kind: "paint", n: 7 },
  { region: "panhandle", date: "2025-04-22", kind: "paint", n: 11 },
  { region: "plains", date: "2025-07-01", kind: "paint", n: 7 },
  { region: "wtwma", date: "2025-08-13", kind: "paint", n: 10 },
  { region: "transpecos", date: "2025-06-30", kind: "paint", n: 7 },
  { region: "stwma", date: "2025-06-15", kind: "paint", n: 5 },
  { region: "panhandle", date: "2025-08-18", kind: "paint", n: 9 },
  { region: "plains", date: "2025-05-29", kind: "paint", n: 5 },
  { region: "wtwma", date: "2025-09-05", kind: "paint", n: 8 },
  { region: "transpecos", date: "2025-04-24", kind: "paint", n: 9 },
  { region: "stwma", date: "2025-05-08", kind: "paint", n: 7 },
  { region: "panhandle", date: "2025-09-09", kind: "paint", n: 8 },
  { region: "plains", date: "2025-06-11", kind: "paint", n: 5 },
  { region: "wtwma", date: "2025-05-27", kind: "paint", n: 7 },
  { region: "transpecos", date: "2025-10-17", kind: "paint", n: 5 },
  { region: "stwma", date: "2025-06-29", kind: "paint", n: 5 },
  { region: "panhandle", date: "2025-08-10", kind: "paint", n: 6 },
  { region: "plains", date: "2025-06-26", kind: "paint", n: 9 },
  { region: "wtwma", date: "2025-08-16", kind: "paint", n: 6 },
  { region: "transpecos", date: "2025-06-02", kind: "paint", n: 6 },
  { region: "stwma", date: "2025-03-26", kind: "paint", n: 5 },
  { region: "panhandle", date: "2025-09-03", kind: "paint", n: 6 },
  { region: "plains", date: "2025-05-25", kind: "paint", n: 4 },
  { region: "wtwma", date: "2025-04-29", kind: "paint", n: 3 },
  { region: "transpecos", date: "2025-09-20", kind: "paint", n: 3 },
  { region: "stwma", date: "2025-06-30", kind: "paint", n: 4 },
  { region: "panhandle", date: "2025-04-23", kind: "paint", n: 7 },
  { region: "wtwma", date: "2025-09-13", kind: "paint", n: 5 },
  { region: "transpecos", date: "2025-09-14", kind: "paint", n: 4 },
  { region: "stwma", date: "2025-07-02", kind: "paint", n: 2 },
  { region: "panhandle", date: "2025-04-24", kind: "paint", n: 4 },
  { region: "wtwma", date: "2025-08-18", kind: "paint", n: 2 },
  { region: "transpecos", date: "2025-05-23", kind: "paint", n: 4 },
  { region: "panhandle", date: "2025-05-26", kind: "paint", n: 4 },
  { region: "wtwma", date: "2025-10-07", kind: "paint", n: 2 },
  { region: "wtwma", date: "2025-09-20", kind: "paint", n: 11 },
  { region: "wtwma", date: "2025-05-18", kind: "paint", n: 11 },
];

function upwindOf(coreLat, coreLon, lat, lon, towardDeg) {
  const upwind = (towardDeg + 180) % 360;
  const mid = ((coreLat + lat) / 2) * (Math.PI / 180);
  const dlat = lat - coreLat;
  const dlon = (lon - coreLon) * Math.cos(mid);
  let deg = (Math.atan2(dlon, dlat) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  let delta = Math.abs(deg - upwind);
  if (delta > 180) delta = 360 - delta;
  return delta <= 90;
}

function scorePainted(painted) {
  const flares = (painted.analyses ?? []).flatMap((entry) => entry.flares);
  const n = flares.length;
  const yes = {
    rain: 0,
    upwind: 0,
    edge: 0,
    echo: 0,
    grew: 0,
    all5: 0,
    spatial4: 0,
    liquid: 0,
    join: 0,
    storms: 0,
    cores: 0,
  };
  for (const flare of flares) {
    const storm = flare.storm;
    if (storm) yes.storms += 1;
    if (storm?.object?.coreLat != null) yes.cores += 1;
    const rain = !!(storm && storm.object && storm.inside);
    const toward = storm?.object?.motionTowardDeg;
    const coreLat = storm?.object?.coreLat;
    const coreLon = storm?.object?.coreLon;
    const upwind =
      toward != null && coreLat != null && coreLon != null
        ? upwindOf(coreLat, coreLon, flare.lat, flare.lon, toward)
        : false;
    const edge =
      storm &&
      storm.edgeKm != null &&
      storm.coreKm != null &&
      storm.edgeKm < storm.coreKm;
    const echo =
      storm &&
      storm.echoTopFt != null &&
      storm.freezingFt != null &&
      storm.echoTopFt >= storm.freezingFt;
    const delta = storm?.object?.areaDeltaKm2;
    const grew = delta != null && delta > 0.5;
    if (rain) yes.rain += 1;
    if (upwind) yes.upwind += 1;
    if (edge) yes.edge += 1;
    if (echo) yes.echo += 1;
    if (grew) yes.grew += 1;
    if (rain && upwind && edge && echo) yes.spatial4 += 1;
    if (rain && upwind && edge && echo && grew) yes.all5 += 1;
    if (flare.near?.liquid?.inside) yes.liquid += 1;
    if (flare.near?.candidate?.inside) yes.join += 1;
  }
  return { n, hours: painted.hours?.length ?? 0, ...yes };
}

function stormsComplete(painted) {
  const flares = (painted.analyses ?? []).flatMap((entry) => entry.flares);
  if (!flares.length) return false;
  return flares.every((flare) => {
    const storm = flare.storm;
    if (!storm) return false;
    if (!("echoTopFt" in storm)) return false;
    if (
      storm.object &&
      storm.object.coreLat == null &&
      storm.object.motionTowardDeg != null
    ) {
      return false;
    }
    return true;
  });
}

async function beat(phase, extra) {
  const body = { t: new Date().toISOString(), phase, ...extra };
  await writeFile(HEARTBEAT, `${JSON.stringify(body)}\n`);
}

async function appendLog(line) {
  const stamp = new Date().toISOString();
  await writeFile(LOG, `${stamp} ${line}\n`, { flag: "a" });
  console.log(line);
}

async function loadProgress() {
  try {
    return JSON.parse(await readFile(PROGRESS, "utf8"));
  } catch {
    return {
      started: new Date().toISOString(),
      server: SERVER,
      done: [
        {
          region: "wtwma",
          date: "2025-05-22",
          n: 23,
          scores: {
            n: 23,
            hours: 3,
            rain: 13,
            upwind: 8,
            edge: 15,
            echo: 21,
            grew: 7,
            all5: 1,
            spatial4: 2,
            liquid: 14,
            join: 3,
            storms: 23,
            cores: 23,
          },
        },
        {
          region: "wtwma",
          date: "2025-08-04",
          n: 5,
          scores: {
            n: 5,
            hours: 1,
            rain: 5,
            upwind: 5,
            edge: 5,
            echo: 5,
            grew: 3,
            all5: 3,
            spatial4: 5,
            liquid: 4,
            join: 2,
            storms: 5,
            cores: 5,
          },
        },
      ],
      failed: [],
      current: null,
    };
  }
}

function keyOf(item) {
  return `${item.region}:${item.date}`;
}

async function saveProgress(progress) {
  progress.updated = new Date().toISOString();
  await writeFile(PROGRESS, `${JSON.stringify(progress, null, 2)}\n`);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function takeLock() {
  try {
    const existing = JSON.parse(await readFile(LOCK, "utf8"));
    if (existing.pid && alive(existing.pid) && existing.pid !== process.pid) {
      console.error(`already running as pid ${existing.pid}`);
      process.exit(0);
    }
  } catch {
    /* no lock, or stale */
  }
  await writeFile(
    LOCK,
    `${JSON.stringify({ pid: process.pid, t: new Date().toISOString() })}\n`
  );
}

async function health() {
  try {
    const res = await fetch(new URL("/healthcheck", SERVER), {
      signal: AbortSignal.timeout(8000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Drop the mosaic cache so the next day does not grow into an OOM kill. */
async function recycleApi() {
  await appendLog("recycling API");
  await exec("touch", [join(HERE, "..", "server", "src", "index.ts")]);
  for (let i = 0; i < 30; i++) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (await health()) return true;
  }
  return false;
}

function runChild(args, timeoutMs, label, extraEnv = {}) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: join(HERE, ".."),
      env: {
        ...process.env,
        WEATHERMAN_SERVER: SERVER,
        TEXAS_EVAL_HEARTBEAT: HEARTBEAT,
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    const onData = async (buf) => {
      const text = buf.toString();
      stdout += text;
      process.stdout.write(text);
      await writeFile(LOG, text, { flag: "a" }).catch(() => {});
      await beat("child", { label, line: text.trim().split("\n").pop() });
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 5000);
      resolve({ code: 124, stdout, timedOut: true });
    }, timeoutMs);
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, timedOut: false });
    });
  });
}

await mkdir(OUT, { recursive: true });
await takeLock();
await beat("start", { pid: process.pid, server: SERVER });

if (!(await health())) {
  console.error(`Weatherman at ${SERVER} is not answering /healthcheck`);
  process.exit(1);
}

const progress = await loadProgress();
progress.server = SERVER;
const doneKeys = new Set(progress.done.map(keyOf));
await saveProgress(progress);
await appendLog(`night runner pid ${process.pid} against ${SERVER}`);

progress.skipped ??= [];
for (const item of QUEUE) {
  if (doneKeys.has(keyOf(item))) continue;
  const fileEarly = paintedPath(item.region, item.date);
  let alreadyPainted = false;
  try {
    JSON.parse(await readFile(fileEarly, "utf8"));
    alreadyPainted = true;
  } catch {
    alreadyPainted = false;
  }
  if (item.n > MAX_FLARES && !alreadyPainted) {
    if (!progress.skipped.some((entry) => keyOf(entry) === keyOf(item))) {
      progress.skipped.push({
        ...item,
        reason: `more than ${MAX_FLARES} flares`,
      });
      await saveProgress(progress);
    }
    await appendLog(
      `skip ${item.region} ${item.date} — ${item.n} flares, cap is ${MAX_FLARES}`
    );
    continue;
  }
  const priorFails = progress.failed.filter(
    (entry) => keyOf(entry) === keyOf(item)
  ).length;
  if (priorFails >= 3) {
    await appendLog(
      `skip ${item.region} ${item.date} — failed ${priorFails} times`
    );
    continue;
  }

  progress.current = { ...item, started: new Date().toISOString() };
  await saveProgress(progress);
  await beat("day", item);
  await appendLog(
    `begin ${item.kind} ${item.region} ${item.date} (${item.n} flares)`
  );

  if (!(await health())) {
    await appendLog("API down — stopping so the 20-minute check can restart it");
    progress.current = { ...item, stopped: "api-down" };
    await saveProgress(progress);
    process.exit(3);
  }

  const file = paintedPath(item.region, item.date);
  let paintedOk = false;
  try {
    JSON.parse(await readFile(file, "utf8"));
    paintedOk = true;
  } catch {
    paintedOk = false;
  }

  if (!paintedOk) {
    const result = await runChild(
      ["eval/paint.mjs", item.date, `--region=${item.region}`],
      PAINT_MS,
      `paint ${item.region} ${item.date}`
    );
    if (result.timedOut) {
      await appendLog(`paint timed out ${item.region} ${item.date}`);
    } else if (result.code !== 0) {
      await appendLog(
        `paint exit ${result.code} ${item.region} ${item.date}`
      );
    }
    if (!(await recycleApi())) {
      await appendLog("API did not come back after paint — stopping");
      process.exit(3);
    }
  }

  const fillOnce = async (label) => {
    const fill = await runChild(
      ["eval/fill-storms.mjs", file],
      FILL_MS,
      label
    );
    if (fill.timedOut) {
      await appendLog(`${label} timed out`);
    }
    return fill;
  };
  await fillOnce(`fill ${item.region} ${item.date}`);
  try {
    const first = JSON.parse(await readFile(file, "utf8"));
    if (!stormsComplete(first)) {
      await appendLog(
        `fill incomplete ${item.region} ${item.date} — trying once more`
      );
      await fillOnce(`fill-retry ${item.region} ${item.date}`);
    }
  } catch {
    /* scored below */
  }

  let painted;
  try {
    painted = JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    progress.failed.push({
      ...item,
      error: `no painted file: ${error.message}`,
      at: new Date().toISOString(),
    });
    progress.current = null;
    await saveProgress(progress);
    await appendLog(`FAIL ${item.region} ${item.date}: no file`);
    continue;
  }

  const scores = scorePainted(painted);
  const complete = stormsComplete(painted);
  const row = {
    region: item.region,
    date: item.date,
    n: scores.n,
    hours: scores.hours,
    kind: item.kind,
    note: item.note,
    scores,
    complete,
    file: paintedName(item.region, item.date),
    at: new Date().toISOString(),
  };

  if (complete) {
    progress.done.push(row);
    doneKeys.add(keyOf(item));
    progress.failed = progress.failed.filter((entry) => keyOf(entry) !== keyOf(item));
    await appendLog(
      `DONE ${item.region} ${item.date}  rain ${scores.rain}/${scores.n}  ` +
        `upwind ${scores.upwind}  edge ${scores.edge}  echo ${scores.echo}  ` +
        `grew ${scores.grew}  all5 ${scores.all5}  liquid ${scores.liquid}  ` +
        `join ${scores.join}`
    );
  } else {
    progress.failed.push({
      ...row,
      error: `storms ${scores.storms}/${scores.n}, cores ${scores.cores}`,
    });
    await appendLog(
      `INCOMPLETE ${item.region} ${item.date} storms ${scores.storms}/${scores.n}`
    );
  }
  progress.current = null;
  await saveProgress(progress);
  if (!(await recycleApi())) {
    await appendLog("API did not come back after recycle — stopping");
    process.exit(3);
  }
}

progress.current = null;
progress.finished = new Date().toISOString();
await saveProgress(progress);
await beat("idle", { pid: process.pid });
await appendLog("queue finished");
