/**
 * Unstick the overnight Texas sample if the API or the runner has stopped.
 *
 * `node eval/watch-texas-night.mjs`
 *
 * Exit 0: work is moving, or the queue is done.
 * Exit 3: API was down; this process poked nodemon and/or asked for a restart.
 * Exit 4: runner was dead with work left; this process started it.
 * Exit 5: heartbeat was stale; this process killed the hang and restarted.
 */

// Node
import { spawn } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const OUT = join(HERE, "out");
const PROGRESS = join(OUT, "texas-eval-progress.json");
const HEARTBEAT = join(OUT, "texas-eval-heartbeat.json");
const LOCK = join(OUT, "texas-eval.lock");
const LOG = join(OUT, "texas-eval-run.log");
const SERVER = process.env.WEATHERMAN_SERVER ?? "http://127.0.0.1:3001";
const STALE_MS = Number(process.env.TEXAS_EVAL_STALE_MS ?? 12 * 60 * 1000);

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pidsMatching(pattern) {
  try {
    const { stdout } = await exec("pgrep", ["-f", pattern]);
    return stdout
      .trim()
      .split("\n")
      .map(Number)
      .filter((pid) => pid && pid !== process.pid);
  } catch {
    return [];
  }
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

async function pokeApi() {
  const index = join(ROOT, "server", "src", "index.ts");
  await exec("touch", [index]);
}

function startRunner() {
  const child = spawn(
    process.execPath,
    [join(HERE, "run-texas-night.mjs")],
    {
      cwd: ROOT,
      env: { ...process.env, WEATHERMAN_SERVER: SERVER },
      detached: true,
      stdio: "ignore",
    }
  );
  child.unref();
  return child.pid;
}

function startApi() {
  const child = spawn("yarn", ["docker"], {
    cwd: join(ROOT, "server"),
    env: {
      ...process.env,
      PORT: "3001",
      NODE_OPTIONS: "--max-old-space-size=1024",
    },
    detached: true,
    stdio: "ignore",
  });
  child.unref();
  return child.pid;
}

async function killPids(pids) {
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* already gone */
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 2000));
  for (const pid of pids) {
    if (alive(pid)) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* already gone */
      }
    }
  }
}

async function workers() {
  const patterns = [
    "eval/run-texas-night.mjs",
    "eval/paint.mjs",
    "eval/fill-storms.mjs",
  ];
  const ids = new Set();
  for (const pattern of patterns) {
    for (const pid of await pidsMatching(pattern)) ids.add(pid);
  }
  return [...ids];
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function apiRssKb() {
  try {
    const { stdout } = await exec("ps", ["-eo", "rss,cmd"]);
    for (const line of stdout.split("\n")) {
      if (
        line.includes("weatherman/server") &&
        line.includes("ts-node") &&
        line.includes("index.ts")
      ) {
        return Number(line.trim().split(/\s+/)[0]) || 0;
      }
    }
  } catch {
    /* none */
  }
  return 0;
}

const progress = await readJson(PROGRESS);
const heartbeat = await readJson(HEARTBEAT);
const lock = await readJson(LOCK);
const apiUp = await health();
const kids = await workers();
const rssKb = await apiRssKb();
if (apiUp && rssKb > 1_200_000) {
  console.log(`API RSS ${rssKb} kB — recycling`);
  await pokeApi();
}
const lockAlive = lock?.pid ? alive(lock.pid) : false;
const ageMs = heartbeat?.t ? Date.now() - Date.parse(heartbeat.t) : null;
const pending = progress
  ? !(progress.finished || (progress.done && progress.current === null && false))
  : true;
const queueDone = Boolean(progress?.finished);

const status = {
  t: new Date().toISOString(),
  apiUp,
  server: SERVER,
  heartbeatAgeSec: ageMs == null ? null : Math.round(ageMs / 1000),
  heartbeat: heartbeat,
  current: progress?.current ?? null,
  done: progress?.done?.length ?? 0,
  failed: progress?.failed?.length ?? 0,
  lockPid: lock?.pid ?? null,
  lockAlive,
  workers: kids,
  queueDone,
};

console.log(JSON.stringify(status, null, 2));

if (queueDone && apiUp && !progress?.current) {
  process.exit(0);
}

if (!apiUp) {
  console.log("API down — touching server/src/index.ts");
  await pokeApi();
  await new Promise((resolve) => setTimeout(resolve, 15000));
  if (!(await health())) {
    console.log("API still down — starting PORT=3001 yarn docker");
    startApi();
    await writeFile(
      LOG,
      `${new Date().toISOString()} watch: started API on 3001\n`,
      { flag: "a" }
    );
    process.exit(3);
  }
}

if (ageMs != null && ageMs > STALE_MS && kids.length) {
  console.log(
    `heartbeat ${Math.round(ageMs / 1000)}s old — killing ${kids.join(", ")}`
  );
  await killPids(kids);
  try {
    await unlink(LOCK);
  } catch {
    /* none */
  }
  const pid = startRunner();
  console.log(`restarted runner as ${pid}`);
  await writeFile(
    LOG,
    `${new Date().toISOString()} watch: killed hang, restarted runner ${pid}\n`,
    { flag: "a" }
  );
  process.exit(5);
}

const runnerUp = kids.some((pid) => {
  try {
    const cmd = readFile(`/proc/${pid}/cmdline`, "utf8");
    return cmd;
  } catch {
    return false;
  }
});

let runnerAlive = false;
for (const pid of kids) {
  try {
    const cmd = await readFile(`/proc/${pid}/cmdline`, "utf8");
    if (cmd.includes("run-texas-night.mjs")) runnerAlive = true;
  } catch {
    /* gone */
  }
}

if (!runnerAlive && !queueDone) {
  const pid = startRunner();
  console.log(`runner was dead — started ${pid}`);
  await writeFile(
    LOG,
    `${new Date().toISOString()} watch: started runner ${pid}\n`,
    { flag: "a" }
  );
  process.exit(4);
}

void pending;
void runnerUp;
process.exit(0);
