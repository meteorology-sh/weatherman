/**
 * Where each scored 2025 flare sat in its radar storm.
 *
 * `node eval/storms.mjs [--resume] [--day=2025-08-04] [--region=wtwma]`
 * `[--out=storms-sample.json]` — Weatherman server running. Reads the days
 * already in `eval/out/target-2025.json` so it scores the same flares, at
 * the same two hours. Writes `eval/out/storms-2025.json` unless `--out`
 * names another file.
 *
 * Asks, of each hour: is the flare inside a ≥20 dBZ object, how far is the
 * strongest cell, how far is the quiet edge, how long that rain has been
 * seen, whether the GOES top over the storm is colder than five minutes
 * ago, how many lightning flashes sat over it, and whether the measured
 * 18 dBZ echo top sits above the freezing level.
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
const RESUME = process.argv.includes("--resume");
const ONLY = process.argv.find((arg) => arg.startsWith("--day="))?.slice(6);
const REGION =
  process.argv.find((arg) => arg.startsWith("--region="))?.slice(9) ?? null;
const OUT_NAME =
  process.argv.find((arg) => arg.startsWith("--out="))?.slice(6) ??
  "storms-2025.json";
const FILE = join(OUT, OUT_NAME);

const data = JSON.parse(await readFile(SOURCE, "utf8"));

function rowOk(row) {
  return (
    row.lo &&
    row.hi &&
    !row.lo.error &&
    !row.hi.error &&
    typeof row.lo.inWorking === "boolean" &&
    typeof row.hi.inWorking === "boolean" &&
    "echoTopFt" in row.lo &&
    "echoTopFt" in row.hi
  );
}

function dayComplete(day) {
  return day.rows?.length > 0 && day.rows.every(rowOk);
}

let done = [];
if (RESUME) {
  try {
    done = JSON.parse(await readFile(FILE, "utf8")).regions ?? [];
    let kept = 0;
    let dropped = 0;
    for (const region of done) {
      const complete = region.days.filter(dayComplete);
      dropped += region.days.length - complete.length;
      kept += complete.length;
      region.days = complete;
    }
    console.log(
      `resuming — ${kept} days already scored` +
        (dropped ? `, ${dropped} incomplete days to retry` : "") +
        "\n"
    );
  } catch {
    console.log("resuming — nothing to resume from\n");
  }
}

console.log(`against ${SERVER}\n`);

const regions = [];

for (const region of data.regions) {
  if (REGION && region.id !== REGION) continue;
  let entry = done.find((row) => row.id === region.id);
  if (!entry) {
    entry = { id: region.id, name: region.name, days: [] };
    done.push(entry);
  }
  const already = new Set(entry.days.map((day) => day.date));
  for (const day of region.days) {
    if (ONLY && day.date !== ONLY) continue;
    if (already.has(day.date)) continue;
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
    entry.days.push({ date: day.date, rows });
    await mkdir(OUT, { recursive: true });
    await writeFile(
      FILE,
      `${JSON.stringify({ server: SERVER, regions: done }, null, 2)}\n`
    );
    const mins = ((Date.now() - started) / 60000).toFixed(1);
    const inside = rows.filter((r) => r.lo?.inside || r.hi?.inside).length;
    const working = rows.filter(
      (r) => r.lo?.inWorking || r.hi?.inWorking
    ).length;
    console.log(
      `  ${region.id} ${day.date}  ${String(rows.length).padStart(3)} flares  ${mins.padStart(5)} min   inside ${inside}/${rows.length}  upwind inside-edge ${working}/${rows.length}`
    );
  }
  regions.push(entry);
}

await mkdir(OUT, { recursive: true });
await writeFile(
  FILE,
  `${JSON.stringify({ server: SERVER, regions: done }, null, 2)}\n`
);

function pickInside(row) {
  if (row.hi?.inside) return row.hi;
  if (row.lo?.inside) return row.lo;
  return row.hi?.object ? row.hi : row.lo;
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10;
}

function tally(label, rows) {
  const scored = rows.filter(rowOk);
  const bothInside = scored.filter((r) => r.lo.inside && r.hi.inside).length;
  const oneInside = scored.filter(
    (r) => r.lo.inside !== r.hi.inside
  ).length;
  const anyNear = scored.filter((r) => r.lo.object || r.hi.object).length;
  const insideRows = scored.filter((r) => r.lo.inside || r.hi.inside);
  const working = scored.filter((r) => r.lo.inWorking || r.hi.inWorking);
  const closerToEdge = insideRows.filter((r) => {
    const a = pickInside(r);
    return a && a.edgeKm < a.coreKm;
  }).length;
  const closerToUpwind = insideRows.filter((r) => {
    const a = pickInside(r);
    return a && a.upwindEdgeKm !== null && a.upwindEdgeKm < a.coreKm;
  }).length;
  const growing = insideRows.filter((r) => {
    const a = pickInside(r);
    return (a?.object?.areaDeltaKm2 ?? 0) > 0.5;
  }).length;
  const colderTop = insideRows.filter((r) => {
    const a = pickInside(r);
    return (a?.goesTopDeltaC ?? 0) < -0.5;
  }).length;
  const withLightning = insideRows.filter((r) => {
    const a = pickInside(r);
    return (a?.glmFlashes ?? 0) > 0;
  }).length;
  const pastFreezing = insideRows.filter((r) => {
    const a = pickInside(r);
    return (
      a?.echoTopFt != null &&
      a?.freezingFt != null &&
      a.echoTopFt >= a.freezingFt
    );
  }).length;
  const ages = insideRows
    .map((r) => pickInside(r)?.object?.ageMin)
    .filter((v) => v != null);
  const coreKm = insideRows
    .map((r) => pickInside(r)?.coreKm)
    .filter((v) => v != null);
  const edgeKm = insideRows
    .map((r) => pickInside(r)?.edgeKm)
    .filter((v) => v != null);
  const upwindKm = insideRows
    .map((r) => pickInside(r)?.upwindEdgeKm)
    .filter((v) => v != null);

  console.log(`\n${label}`);
  console.log(`${rows.length} flares, ${scored.length} with an answer at both hours`);
  console.log(`  inside the rain at both hours:           ${bothInside}`);
  console.log(`  inside at exactly one of the two:        ${oneInside}`);
  console.log(`  inside rain, upwind, nearer the edge:    ${working.length}`);
  console.log(`  a storm within ~40 km at either:         ${anyNear}`);
  console.log(
    `  of ${insideRows.length} inside at least one hour:`
  );
  console.log(`    closer to the quiet edge than the core:  ${closerToEdge}`);
  console.log(`    closer to the upwind edge than the core: ${closerToUpwind}`);
  console.log(`    raining area larger than previous scan:  ${growing}`);
  console.log(`    GOES top colder than five minutes ago:   ${colderTop}`);
  console.log(`    lightning over the storm in five minutes: ${withLightning}`);
  console.log(
    `    18 dBZ echo top at or above freezing:     ${pastFreezing}`
  );
  const withLiquid = insideRows.filter((r) => {
    const a = pickInside(r);
    return (a?.slwGM2 ?? 0) >= 10;
  }).length;
  console.log(
    `    modelled liquid in the band over storm:  ${withLiquid}`
  );
  console.log(`    median age of the rain, minutes:         ${median(ages)}`);
  console.log(
    `    median km to core / edge / upwind edge:  ${median(coreKm)} / ${median(edgeKm)} / ${median(upwindKm)}`
  );
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
console.log(`\nwritten to ${FILE}`);

async function ask(lat, lon, hour) {
  try {
    const reading = await stormNear(lat, lon, hour);
    if (!reading) {
      return {
        object: null,
        inside: false,
        inWorking: false,
        coreKm: null,
        edgeKm: null,
        upwindEdgeKm: null,
      };
    }
    return {
      object: {
        id: reading.object.id,
        maxDbz: reading.object.maxDbz,
        areaKm2: reading.object.areaKm2,
        ageMin: reading.object.ageMin,
        ageFloor: reading.object.ageFloor ?? false,
        motionTowardDeg: reading.object.motionTowardDeg ?? null,
        motionKmh: reading.object.motionKmh ?? null,
        areaDeltaKm2: reading.object.areaDeltaKm2 ?? null,
      },
      inside: reading.inside,
      inWorking: reading.inWorking ?? false,
      coreKm: reading.coreKm,
      edgeKm: reading.edgeKm,
      upwindEdgeKm: reading.upwindEdgeKm,
      goesTopC: reading.goesTopC ?? null,
      goesTopDeltaC: reading.goesTopDeltaC ?? null,
      glmFlashes: reading.glmFlashes ?? null,
      echoTopFt: reading.echoTopFt ?? null,
      modelEchoTopFt: reading.modelEchoTopFt ?? null,
      freezingFt: reading.freezingFt ?? null,
      slwGM2: reading.slwGM2 ?? null,
    };
  } catch (error) {
    return { error: error.message };
  }
}
