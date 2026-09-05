/**
 * Paint remaining Texas days in parallel against several Weatherman APIs.
 *
 * Worker-only. One child per API port, no recycle.
 *
 * WEATHERMAN_PORTS=3000,3001,3002,3003,3004,3005 \
 *   node eval/run-texas-parallel.mjs
 */

import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");
const PROGRESS = join(OUT, "parallel-progress.json");
const LOG = join(OUT, "parallel-run.log");

const PORTS = (process.env.WEATHERMAN_PORTS ?? "3000,3001,3002,3003,3004,3005")
  .split(",")
  .map((p) => Number(p.trim()))
  .filter(Boolean);
const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 600_000);
const PAINT_MS = Number(process.env.TEXAS_EVAL_PAINT_MS ?? 30 * 60 * 1000);
const FILL_MS = Number(process.env.TEXAS_EVAL_FILL_MS ?? 20 * 60 * 1000);

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);

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

const QUEUE = [
  { region: "transpecos", date: "2025-08-12", kind: "fill", n: 18 },
  { region: "panhandle", date: "2025-08-11", kind: "fill", n: 10 },
  { region: "plains", date: "2025-06-30", kind: "fill", n: 12 },
  { region: "wtwma", date: "2025-08-11", kind: "fill", n: 11 },
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

function stormsComplete(painted) {
  const flares = (painted.analyses ?? []).flatMap((entry) => entry.flares);
  if (!flares.length) return false;
  return flares.every((flare) => {
    const storm = flare.storm;
    if (!storm) return false;
    if (!("echoTopFt" in storm)) return false;
    return true;
  });
}

async function loadPainted(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function appendLog(line) {
  const stamp = new Date().toISOString();
  const text = `${stamp} ${line}\n`;
  await writeFile(LOG, text, { flag: "a" });
  process.stdout.write(text);
}

function runChild(args, timeoutMs, extraEnv) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: ROOT,
      env: {
        ...process.env,
        WEATHERMAN_TIMEOUT_MS: String(TIMEOUT_MS),
        NODE_OPTIONS: "--max-old-space-size=4096",
        ...extraEnv,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    const onData = (buf) => {
      const text = buf.toString();
      stdout += text;
      process.stdout.write(text);
      writeFile(LOG, text, { flag: "a" }).catch(() => {});
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

const progress = {
  started: new Date().toISOString(),
  ports: PORTS,
  done: [],
  failed: [],
  running: [],
  current: null,
};

let saving = Promise.resolve();
function save() {
  saving = saving.then(() =>
    writeFile(PROGRESS, `${JSON.stringify(progress, null, 2)}\n`)
  );
  return saving;
}

async function workOne(item, port) {
  const server = `http://127.0.0.1:${port}`;
  const file = paintedPath(item.region, item.date);
  const label = `${item.region} ${item.date}`;
  progress.running.push({ ...item, port, started: new Date().toISOString() });
  await save();
  await appendLog(`begin ${item.kind} ${label} on :${port}`);

  const have = await loadPainted(file);
  if (!have) {
    const paint = await runChild(
      ["eval/paint.mjs", item.date, `--region=${item.region}`],
      PAINT_MS,
      { WEATHERMAN_SERVER: server }
    );
    if (paint.timedOut || paint.code !== 0) {
      const error = paint.timedOut
        ? "paint timed out"
        : `paint exit ${paint.code}`;
      progress.failed.push({ ...item, port, error });
      progress.running = progress.running.filter(
        (row) => !(row.region === item.region && row.date === item.date)
      );
      await save();
      await appendLog(`FAIL ${label}: ${error}`);
      return;
    }
  }

  const afterPaint = await loadPainted(file);
  if (!afterPaint) {
    progress.failed.push({ ...item, port, error: "no painted file" });
    progress.running = progress.running.filter(
      (row) => !(row.region === item.region && row.date === item.date)
    );
    await save();
    await appendLog(`FAIL ${label}: no painted file`);
    return;
  }

  if (!stormsComplete(afterPaint)) {
    const fill = await runChild(
      ["eval/fill-storms.mjs", file],
      FILL_MS,
      { WEATHERMAN_SERVER: server }
    );
    if (fill.timedOut) await appendLog(`fill timed out ${label}`);
  }

  const painted = await loadPainted(file);
  const complete = painted ? stormsComplete(painted) : false;
  progress.running = progress.running.filter(
    (row) => !(row.region === item.region && row.date === item.date)
  );
  if (complete) {
    progress.done.push({
      ...item,
      port,
      file: paintedName(item.region, item.date),
      at: new Date().toISOString(),
    });
    await appendLog(`DONE ${label} on :${port}`);
  } else {
    progress.failed.push({ ...item, port, error: "storms incomplete" });
    await appendLog(`INCOMPLETE ${label}`);
  }
  await save();
}

await mkdir(OUT, { recursive: true });

const jobs = [];
for (const item of QUEUE) {
  const file = paintedPath(item.region, item.date);
  const painted = await loadPainted(file);
  if (painted && stormsComplete(painted)) continue;
  jobs.push(item);
}

await appendLog(
  `parallel runner pid ${process.pid} — ${jobs.length} days, ${PORTS.length} APIs (${PORTS.join(",")})`
);
progress.queued = jobs.length;
await save();

let next = 0;
await Promise.all(
  PORTS.map(async (port) => {
    while (true) {
      const idx = next++;
      if (idx >= jobs.length) return;
      try {
        await workOne(jobs[idx], port);
      } catch (error) {
        const item = jobs[idx];
        progress.failed.push({
          ...item,
          port,
          error: error instanceof Error ? error.message : String(error),
        });
        progress.running = progress.running.filter(
          (row) =>
            !(row.region === item.region && row.date === item.date)
        );
        await save();
        await appendLog(
          `FAIL ${item.region} ${item.date}: ${error.message ?? error}`
        );
      }
    }
  })
);

progress.finished = new Date().toISOString();
progress.running = [];
await save();
await appendLog(
  `queue finished — ${progress.done.length} done, ${progress.failed.length} failed`
);
