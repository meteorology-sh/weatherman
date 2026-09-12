/**
 * Is this tree a complete season — every report in cache, every seeded day
 * with a located flare painted at native sampling with storm motion, the
 * click readout, and a balloon file for each program that briefs on a
 * sonde.
 *
 * `node eval/verify.mjs [--season=2025]`
 *
 * Reads only that season's `data/`, `cache/` and `out/`. Does not touch the network.
 * Exit 0 if complete; exit 1 and print what is missing otherwise.
 */

// Node
import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

// Local
import { regionsOf, seasonDirs, seasonOf } from "./lib/season.mjs";

const SEASON = seasonOf();
const { data: DATA, cache: CACHE, out: OUT } = seasonDirs(SEASON);

const regions = await regionsOf(SEASON);

const missing = [];
const extra = [];
let reports = 0;
let painted = 0;
let flares = 0;
let drifted = 0;
let withStorm = 0;
let withClick = 0;
let balloons = 0;
let asPrinted = 0;

/** The layers Weatherman draws. A painted file may carry others; they are not read. */
const LAYER_KEYS = ["target", "radar", "echoFreeze", "cloudBase", "liquid"];

function native(cellKm) {
  return (
    cellKm &&
    typeof cellKm === "object" &&
    cellKm.cloudBase === 3 &&
    cellKm.liquid === 3 &&
    cellKm.radar === 1 &&
    cellKm.target === 3 &&
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
    if (!have.has(file)) missing.push(`cache/${SEASON}/${region.id}/${file}`);
  }
  for (const file of have) {
    if (!expect.includes(file))
      extra.push(`cache/${SEASON}/${region.id}/${file}`);
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
        missing.push(`out/${SEASON}/${name}`);
        continue;
      }
      throw error;
    }
    const paintedDay = JSON.parse(await readFile(path, "utf8"));
    if (!native(paintedDay.cellKm)) {
      missing.push(`out/${SEASON}/${name} (not native cellKm)`);
      continue;
    }
    painted += 1;

    // A program whose bearings carry a magnetic variation is painted a second
    // time with them read as true north, for the evaluation's before column.
    if (region.origin?.magneticVariationDeg != null) {
      try {
        const printed = JSON.parse(
          await readFile(join(OUT, "as-printed", name), "utf8")
        );
        if (native(printed.cellKm)) asPrinted += 1;
        else
          missing.push(`out/${SEASON}/as-printed/${name} (not native cellKm)`);
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
        missing.push(`out/${SEASON}/as-printed/${name}`);
      }
    }
    let dayFlares = 0;
    let dayCells = 0;
    for (const analysis of paintedDay.analyses ?? []) {
      for (const flare of analysis.flares ?? []) {
        flares += 1;
        dayFlares += 1;
        // An empty layer is an answer (`empty: true`); a null is a route that
        // failed, and a season with a failed route is not complete.
        for (const key of LAYER_KEYS) {
          if (flare.near?.[key] == null) {
            missing.push(
              `out/${SEASON}/${name} ${flare.timeZ} (${key} failed)`
            );
          }
        }
        if (flare.drift) drifted += 1;
        else
          missing.push(
            `out/${SEASON}/${name} ${flare.timeZ} (no storm motion)`
          );
        if (Object.prototype.hasOwnProperty.call(flare, "storm")) {
          withStorm += 1;
        } else {
          missing.push(
            `out/${SEASON}/${name} ${flare.timeZ} (no storm reading)`
          );
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
          missing.push(
            `out/${SEASON}/${name} ${flare.timeZ} (no click readout)`
          );
        }
        if (flare.cell) dayCells += 1;
      }
    }

    // One null cell is geography; every cell on the day null is a route that
    // stopped answering. `/candidate/point` answers for any release inside the
    // model grid whatever the weather, so a whole day of nulls is an API that
    // died mid-run — which still writes the day, at a size that looks like a
    // quiet one.
    if (dayFlares > 0 && dayCells === 0) {
      missing.push(
        `out/${SEASON}/${name} (every cell readout on the day is null)`
      );
    }
  }

  if (region.runs.balloons) {
    const name = region.runs.balloons;
    try {
      await stat(join(OUT, name));
      balloons += 1;
    } catch (error) {
      if (error.code === "ENOENT") missing.push(`out/${SEASON}/${name}`);
      else throw error;
    }
  }
}

if (missing.length || extra.length) {
  for (const line of missing) console.error(`missing  ${line}`);
  for (const line of extra) console.error(`extra    ${line}`);
  process.exit(1);
}

console.log(`season ${SEASON} complete`);
console.log(`  reports   ${reports}`);
console.log(
  `  painted   ${painted} native days, ${flares} located flares, ` +
    `storm motion on ${drifted}, storm reading on ${withStorm}, ` +
    `click readout on ${withClick}`
);
console.log(`  as printed ${asPrinted} radial days`);
console.log(`  balloons  ${balloons}`);
