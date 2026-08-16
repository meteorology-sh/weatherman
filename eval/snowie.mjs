/**
 * SNOWIE — did HRRR put supercooled liquid in the seeding band over the
 * Payette basin at the hours the aircraft were seeding it?
 *
 * `node eval/snowie.mjs 2017-01-20 22 23 00 01` — with the server running.
 *
 * **The join cannot run in January 2017 and this does not try.** GOES cloud-top
 * pressure starts 2023-03-23 and MRMS starts 2020-10-14, so three of the five
 * inputs did not exist. What did exist is HRRR, unchanged in the fields this
 * reads, so the question narrows to the one field SNOWIE actually measured:
 * liquid water in the band. Everything the satellite and the radar would have
 * said is reported as absent rather than assumed.
 *
 * Liquid comes from the contour frame rather than a point route, because
 * `/candidate/point` is the join and the join needs all five sources. A point
 * inside the 150 g/m² ring carries at least 150 g/m²; the levels are nested,
 * so the highest ring containing a point is its bracket.
 */

// Node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { inFeature } from "./lib/geo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const SERVER = process.env.WEATHERMAN_SERVER ?? "http://localhost:3000";

/**
 * The Payette basin, approximately.
 *
 * Friedrich et al. flew ~50 km tracks perpendicular to the mean wind, with the
 * radar domain running 5–30 km east of the Packer John site. This box is a
 * starting frame around that and **should be pinned against the paper's
 * Figure 1 before any area figure is quoted** — it is wide enough to hold the
 * flight lines and too wide to call a target area.
 */
const BASIN = { west: -116.4, east: -115.4, south: 44.0, north: 44.8 };

/** Coarser than the 12 km grid is pointless; this is about 6 km. */
const STEP_DEG = 0.06;

/** `SEEDING.property` in `server/src/lib/services/hrrr/slw.ts`. */
const SLW_PROPERTY = "slwPath";

async function get(path, params) {
  const url = new URL(path, SERVER);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetch(url);
  if (!res.ok)
    throw new Error(`${res.status} ${url.pathname}: ${await res.text()}`);
  return res.json();
}

function grid() {
  const points = [];
  for (let lat = BASIN.south; lat <= BASIN.north; lat += STEP_DEG) {
    for (let lon = BASIN.west; lon <= BASIN.east; lon += STEP_DEG) {
      points.push({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) });
    }
  }
  return points;
}

/**
 * The highest contour level containing a point.
 *
 * The liquid layer's levels are nested — ground meeting 400 g/m² is inside the
 * 10, 50 and 150 rings too — so the answer is the largest level whose feature
 * contains the point, and 0 where none does.
 */
function bracket(frame, lon, lat) {
  let best = 0;
  for (const feature of frame.features) {
    const level = feature.properties[SLW_PROPERTY];
    if (level > best && inFeature(feature, lon, lat)) best = level;
  }
  return best;
}

const [date, ...hours] = process.argv.slice(2);
if (!date || hours.length === 0) {
  console.error("usage: node eval/snowie.mjs <YYYY-MM-DD> <hour> [hour …]");
  process.exit(2);
}

const samples = grid();
const centre = {
  lat: (BASIN.south + BASIN.north) / 2,
  lon: (BASIN.west + BASIN.east) / 2,
};

console.log(
  `SNOWIE ${date}: ${samples.length} samples over the Payette basin\n` +
    `  no cloud top, no cloud phase, no radar — HRRR only\n`
);

const byHour = [];

for (const hour of hours) {
  const rolls = Number(hour) < Number(hours[0]);
  const at = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  if (rolls) at.setUTCDate(at.getUTCDate() + 1);
  const stamp = at.toISOString();

  const started = Date.now();

  // The archive has holes. `wrfsfc` is missing at 20z on 2017-01-20 while
  // `wrfprs` that hour is fine, and an hour that cannot be built is a fact
  // about the archive rather than a reason to abandon the sweep.
  let liquid;
  let sounding;
  try {
    [liquid, sounding] = await Promise.all([
      get("/forecast/liquid", { hour: 0, at: stamp }),
      get("/forecast/sounding", {
        lat: centre.lat,
        lon: centre.lon,
        hour: 0,
        at: stamp,
      }),
    ]);
  } catch (error) {
    byHour.push({ at: stamp, unbuildable: error.message });
    console.log(
      `  ${stamp.slice(11, 16)}Z  not in the archive — ${error.message}`
    );
    continue;
  }

  const brackets = samples.map((s) => bracket(liquid, s.lon, s.lat));
  const withLiquid = brackets.filter((b) => b > 0).length;

  byHour.push({
    at: stamp,
    samples: samples.length,
    samplesWithBandLiquid: withLiquid,
    sharePct: Math.round((10000 * withLiquid) / samples.length) / 100,
    peakLevelGM2: Math.max(0, ...brackets),
    band: {
      baseFt: sounding.bandBaseFt,
      topFt: sounding.bandTopFt,
      freezingFt: sounding.freezingFt,
      surfaceFt: sounding.surfaceFt,
      baseC: sounding.baseC,
      topC: sounding.topC,
    },
    unavailable: ["cloud top (GOES)", "cloud phase (GOES)", "radar (MRMS)"],
  });

  const last = byHour.at(-1);
  console.log(
    `  ${stamp.slice(11, 16)}Z  ${String(withLiquid).padStart(3)}/${samples.length} ` +
      `samples in band liquid (${last.sharePct}%)  peak ring ${last.peakLevelGM2} g/m²  ` +
      `band ${last.band.baseFt ?? "—"}–${last.band.topFt ?? "—"} ft  ` +
      `surface ${last.band.surfaceFt} ft  [${((Date.now() - started) / 1000).toFixed(0)}s]`
  );
}

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, `snowie-${date}.json`),
  `${JSON.stringify({ date, server: SERVER, basin: BASIN, centre, byHour }, null, 2)}\n`
);

console.log(`\nwritten to eval/out/snowie-${date}.json`);
