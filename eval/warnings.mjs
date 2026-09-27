/**
 * Add the NWS warnings in force to days already painted.
 *
 * `node eval/warnings.mjs [--season=2025]` — with the Weatherman server
 * running. For every painted file in `out/<season>/` and `out/<season>/as-printed/`,
 * asks `/warnings/severe` at each analysis hour in that program's window and
 * stores the answer as `marks[hour].warnings`, the field `paint.mjs` now
 * writes itself. Nothing else in the file changes.
 *
 * One archive request per analysis and no model build, so it runs against any
 * Weatherman API, local or not.
 */

// Node
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

// Local
import { SERVER } from "./lib/weatherman.mjs";
import { seasonDirs, seasonOf } from "./lib/season.mjs";
import { warningsOf, warningsPath } from "./lib/warnings.mjs";

const SEASON = seasonOf();
const { out: OUT } = seasonDirs(SEASON);

async function ask(path) {
  const res = await fetch(new URL(path, SERVER), {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return res.json();
}

async function paintedIn(dir) {
  try {
    return (await readdir(dir))
      .filter((name) => name.startsWith("painted-") && name.endsWith(".json"))
      .map((name) => join(dir, name));
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

const files = [
  ...(await paintedIn(OUT)),
  ...(await paintedIn(join(OUT, "as-printed"))),
];

let warned = 0;
let failed = 0;
for (const file of files) {
  const painted = JSON.parse(await readFile(file, "utf8"));
  painted.marks ??= {};
  const counts = [];
  for (const hour of painted.hours ?? []) {
    painted.marks[hour] ??= {};
    try {
      const marks = warningsOf(await ask(warningsPath(hour, painted.window)));
      painted.marks[hour].warnings = marks;
      counts.push(marks.warnings.length);
      if (marks.warnings.length) warned += 1;
    } catch (failure) {
      painted.marks[hour].warnings = {
        validTime: hour,
        warnings: [],
        error: failure.message,
      };
      counts.push("failed");
      failed += 1;
    }
  }
  await writeFile(file, `${JSON.stringify(painted)}\n`);
  console.log(`${file.slice(OUT.length + 1)}  ${counts.join(" ")}`);
}

console.log(
  `\n${files.length} painted files; ${warned} analyses with a warning in force` +
    (failed ? `; ${failed} analyses failed — run again` : "")
);
if (failed) process.exit(1);
