/**
 * Where each scored 2025 flare sat in its radar storm.
 *
 * `node eval/storms.mjs` — Weatherman server running. Reads the days already
 * in `eval/out/target-2025.json` so it scores the same 216 flares, at the
 * same two hours. Writes `eval/out/storms-2025.json`.
 *
 * Asks, of each hour: is the flare inside a ≥20 dBZ object, how far is the
 * strongest cell, how far is the quiet edge, and (when the object is moving)
 * how far is the upwind edge. Age is blank on a single archived scan.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER, stormNear } from "./lib/weatherman.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const SOURCE = join(OUT, "target-2025.json");
const FILE = join(OUT, "storms-2025.json");

const data = JSON.parse(await readFile(SOURCE, "utf8"));

console.log(`against ${SERVER}\n`);

const regions = [];

for (const region of data.regions) {
  const days = [];
  for (const day of region.days) {
    const started = Date.now();
    const rows = [];
    for (const row of day.rows) {
      const lo = await ask(row.release.lat, row.release.lon, row.h0);
      const hi = await ask(row.release.lat, row.release.lon, row.h1);
      rows.push({
        at: row.release.at,
        lat: row.release.lat,
        lon: row.release.lon,
        h0: row.h0,
        h1: row.h1,
        lo,
        hi,
      });
    }
    days.push({ date: day.date, rows });
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    const inside = rows.filter(
      (r) => r.lo?.inside || r.hi?.inside
    ).length;
    console.log(
      `  ${region.id} ${day.date}  ${String(rows.length).padStart(3)} flares  ${mins.padStart(5)} min   inside at least one hour ${inside}/${rows.length}`
    );
  }
  regions.push({ id: region.id, name: region.name, days });
}

await mkdir(OUT, { recursive: true });
await writeFile(FILE, `${JSON.stringify({ server: SERVER, regions }, null, 2)}\n`);

function tally(label, rows) {
  const scored = rows.filter((r) => r.lo && r.hi && !r.lo.error && !r.hi.error);
  const bothInside = scored.filter((r) => r.lo.inside && r.hi.inside).length;
  const oneInside = scored.filter(
    (r) => r.lo.inside !== r.hi.inside
  ).length;
  const anyNear = scored.filter(
    (r) => r.lo.object || r.hi.object
  ).length;
  const closerToEdge = scored.filter((r) => {
    const a = r.hi.inside || r.lo.inside ? (r.hi.inside ? r.hi : r.lo) : r.hi.object ? r.hi : r.lo;
    if (!a?.object) return false;
    return a.edgeKm < a.coreKm;
  }).length;
  console.log(`\n${label}`);
  console.log(`${rows.length} flares, ${scored.length} with an answer at both hours`);
  console.log(`  inside the storm at both hours:     ${bothInside}`);
  console.log(`  inside at exactly one of the two:   ${oneInside}`);
  console.log(`  a storm within ~40 km at either:    ${anyNear}`);
  console.log(`  closer to the quiet edge than core: ${closerToEdge} (using the hour it is inside, else the later hour)`);
}

console.log(`\n${"=".repeat(72)}`);
for (const region of regions) {
  tally(
    region.name,
    region.days.flatMap((d) => d.rows)
  );
}
tally(
  "all programmes",
  regions.flatMap((r) => r.days.flatMap((d) => d.rows))
);
console.log(`\nwritten to eval/out/storms-2025.json`);

async function ask(lat, lon, hour) {
  try {
    const reading = await stormNear(lat, lon, hour);
    if (!reading) return { object: null, inside: false, coreKm: null, edgeKm: null, upwindEdgeKm: null };
    return {
      object: {
        id: reading.object.id,
        maxDbz: reading.object.maxDbz,
        areaKm2: reading.object.areaKm2,
        ageMin: reading.object.ageMin,
      },
      inside: reading.inside,
      coreKm: reading.coreKm,
      edgeKm: reading.edgeKm,
      upwindEdgeKm: reading.upwindEdgeKm,
    };
  } catch (error) {
    return { error: error.message };
  }
}
