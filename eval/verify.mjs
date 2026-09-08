/**
 * Is this tree a complete season — every report in cache, every seeded day
 * with a located flare painted at native sampling with storm motion, the
 * click readout, and a balloon file for each program that briefs on a
 * sonde.
 *
 * `node eval/verify.mjs`
 *
 * Reads only `data/`, `cache/` and `out/`. Does not touch the network.
 * Exit 0 if complete; exit 1 and print what is missing otherwise.
 */

// Node
import { readdir, readFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");
const CACHE = join(HERE, "cache");
const OUT = join(HERE, "out");

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);

const missing = [];
const extra = [];
let reports = 0;
let painted = 0;
let flares = 0;
let drifted = 0;
let withStorm = 0;
let withClick = 0;
let balloons = 0;

function native(cellKm) {
  return (
    cellKm &&
    typeof cellKm === "object" &&
    cellKm.cloudBase === 3 &&
    cellKm.cloudTop === 2 &&
    cellKm.liquid === 3 &&
    cellKm.candidate === 3 &&
    cellKm.radar === 1 &&
    cellKm.target === 3 &&
    cellKm.baseWindow === 3 &&
    cellKm.echoFreeze === 3
  );
}

async function listed(dir) {
  try {
    return new Set(await readdir(dir));
  } catch (error) {
    if (error.code === "ENOENT") return new Set();
    throw error;
  }
}

for (const region of regions) {
  if (!region.releases) continue;

  const manifest = JSON.parse(
    await readFile(join(DATA, region.reports), "utf8")
  );
  const expect = (manifest.documents ?? []).map((doc) => doc.file);
  const have = await listed(join(CACHE, region.id));
  reports += expect.length;
  for (const file of expect) {
    if (!have.has(file)) missing.push(`cache/${region.id}/${file}`);
  }
  for (const file of have) {
    if (!expect.includes(file)) extra.push(`cache/${region.id}/${file}`);
  }

  const record = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );
  const days = record.days.filter(
    (day) => day.seeded && day.releases.some((release) => release.located)
  );

  for (const day of days) {
    const name = region.runs.painted.replace("{date}", day.date);
    const path = join(OUT, name);
    try {
      await stat(path);
    } catch (error) {
      if (error.code === "ENOENT") {
        missing.push(`out/${name}`);
        continue;
      }
      throw error;
    }
    const paintedDay = JSON.parse(await readFile(path, "utf8"));
    if (!native(paintedDay.cellKm)) {
      missing.push(`out/${name} (not native cellKm)`);
      continue;
    }
    painted += 1;
    for (const analysis of paintedDay.analyses ?? []) {
      for (const flare of analysis.flares ?? []) {
        flares += 1;
        if (flare.drift) drifted += 1;
        else missing.push(`out/${name} ${flare.timeZ} (no storm motion)`);
        if (Object.prototype.hasOwnProperty.call(flare, "storm")) {
          withStorm += 1;
        } else {
          missing.push(`out/${name} ${flare.timeZ} (no storm reading)`);
        }
        // The cell and the column may each be null — a release outside the
        // model's grid is answered "not here" rather than with numbers — so
        // it is the keys that have to be there, not values under them.
        if (
          Object.prototype.hasOwnProperty.call(flare, "cell") &&
          Object.prototype.hasOwnProperty.call(flare, "column")
        ) {
          withClick += 1;
        } else {
          missing.push(`out/${name} ${flare.timeZ} (no click readout)`);
        }
      }
    }
  }

  if (region.runs.balloons) {
    const name = region.runs.balloons;
    try {
      await stat(join(OUT, name));
      balloons += 1;
    } catch (error) {
      if (error.code === "ENOENT") missing.push(`out/${name}`);
      else throw error;
    }
  }
}

if (missing.length || extra.length) {
  for (const line of missing) console.error(`missing  ${line}`);
  for (const line of extra) console.error(`extra    ${line}`);
  process.exit(1);
}

console.log("season complete");
console.log(`  reports   ${reports}`);
console.log(
  `  painted   ${painted} native days, ${flares} located flares, ` +
    `storm motion on ${drifted}, storm reading on ${withStorm}, ` +
    `click readout on ${withClick}`
);
console.log(`  balloons  ${balloons}`);
