/**
 * What the map said about the whole target area, hour by hour.
 *
 * `node eval/field.mjs 2025-04-22 21 22 23 00` — with the server running.
 * Samples every 12 km cell inside the seeded counties and reports how many
 * were candidates, and which test rejected the rest.
 *
 * This is what the null case needs: on a day nobody seeded, there are no
 * release points to ask about, and the question becomes whether the map was
 * showing opportunity over ground an operator looked at and declined.
 *
 * It is also where the per-case coverage figures come from. `WEATHERMAN.md`
 * argues that no per-region figure belongs on the operator panel, and that
 * argument holds — this is an evaluation asking a different question of the
 * same build, from outside the app.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { lattice } from "./lib/geo.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const SERVER = process.env.WEATHERMAN_SERVER ?? "http://localhost:3000";

/** `(BLOCK * 3) ** 2` in `server/src/lib/services/shared/grid.ts`. */
const CELL_KM2 = 144;

/**
 * Sample spacing, in degrees.
 *
 * Finer than the 12 km grid on purpose — about 8 km at this latitude, so no
 * cell can fall between samples. Duplicates are collapsed by the cell the join
 * answers from, and every duplicate after the first is a cache hit.
 */
const STEP_DEG = 0.075;

async function point(lat, lon, at) {
  const url = new URL("/candidate/point", SERVER);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("at", at);

  const res = await fetch(url);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} at ${lat},${lon}`);
  return res.json();
}

const [date, ...hours] = process.argv.slice(2);
if (!date || hours.length === 0) {
  console.error("usage: node eval/field.mjs <YYYY-MM-DD> <hour> [hour …]");
  process.exit(2);
}

const counties = JSON.parse(
  await readFile(join(HERE, "data", "counties-tx.geojson"), "utf8")
);

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);
const day = days.find((d) => d.date === date);

/**
 * The counties the aircraft actually worked that day. Empty on a day nobody
 * seeded.
 *
 * **The whole target area is always sampled**, and this only splits the
 * result. Sampling the worked counties alone would make a seeded day and a
 * declined day two different footprints, and the one number this evaluation
 * most needs — coverage where they flew against coverage where they did not —
 * cannot be read off two different denominators.
 */
const worked = new Set(day?.releases.map((r) => r.county) ?? []);
const samples = lattice(counties.features, STEP_DEG);

console.log(
  `${date}: ${samples.length} samples over ${counties.features.length} counties` +
    `${worked.size ? `, worked: ${[...worked].sort().join(", ")}` : " (nobody seeded)"}\n`
);

/** Candidate share over a set of cells, as a percentage. */
function coverage(cells) {
  if (cells.length === 0) return null;
  const candidates = cells.filter((c) => c.verdict === "candidate").length;
  return Math.round((10000 * candidates) / cells.length) / 100;
}

const byHour = [];

for (const hour of hours) {
  // An hour before the day's first is the next calendar day — a sortie that
  // ran past midnight, like 11 August's second one.
  const rolls = Number(hour) < Number(hours[0]);
  const at = new Date(`${date}T${String(hour).padStart(2, "0")}:00:00Z`);
  if (rolls) at.setUTCDate(at.getUTCDate() + 1);

  const cells = new Map();
  let outside = 0;

  const started = Date.now();
  let unbuildable = null;

  for (const sample of samples) {
    let answer;
    try {
      answer = await point(sample.lat, sample.lon, at.toISOString());
    } catch (error) {
      // The archive has holes, and an hour that cannot be built fails on the
      // first sample and every one after it. Record the hour and move on
      // rather than asking 900 more times.
      unbuildable = error.message;
      break;
    }
    if (!answer) {
      outside++;
      continue;
    }
    // The join answers from a cell, and many samples land in the same one.
    // Keying by the cell it named is what turns a lattice into a cell count.
    cells.set(`${answer.lat},${answer.lon}`, {
      ...answer,
      county: sample.county,
    });
  }

  if (unbuildable) {
    byHour.push({ at: at.toISOString(), unbuildable });
    console.log(
      `  ${at.toISOString().slice(11, 16)}Z  not in the archive — ${unbuildable}`
    );
    continue;
  }

  const verdicts = {};
  for (const cell of cells.values()) {
    verdicts[cell.verdict] = (verdicts[cell.verdict] ?? 0) + 1;
  }

  const candidates = verdicts.candidate ?? 0;
  const liquid = [...cells.values()].filter(
    (c) => c.verdict !== "noLiquid"
  ).length;

  const all = [...cells.values()];
  const inWorked = all.filter((c) => worked.has(c.county));
  const elsewhere = all.filter((c) => !worked.has(c.county));

  byHour.push({
    at: at.toISOString(),
    cells: cells.size,
    outsideDomain: outside,
    candidateCells: candidates,
    candidateKm2: candidates * CELL_KM2,
    targetKm2: cells.size * CELL_KM2,
    coveragePct: coverage(all) ?? 0,
    // The discrimination test: candidate share where the aircraft went
    // against candidate share over the rest of the target area the same hour.
    // Null on a day nobody seeded, where there is no "where they went".
    workedPct: coverage(inWorked),
    elsewherePct: coverage(elsewhere),
    liquidCells: liquid,
    verdicts,
    peakSlwGM2: Math.max(0, ...all.map((c) => c.slwGM2)),
  });

  const last = byHour.at(-1);
  console.log(
    `  ${at.toISOString().slice(11, 16)}Z  ${String(cells.size).padStart(3)} cells  ` +
      `${String(candidates).padStart(3)} candidate (${last.coveragePct}%)  ` +
      `${
        last.workedPct === null
          ? ""
          : `worked ${last.workedPct}% vs elsewhere ${last.elsewherePct}%  `
      }` +
      `peak ${last.peakSlwGM2} g/m²  ` +
      `${Object.entries(verdicts)
        .filter(([v]) => v !== "candidate")
        .sort((a, b) => b[1] - a[1])
        .map(([v, n]) => `${v} ${n}`)
        .join(", ")}` +
      `  [${((Date.now() - started) / 1000).toFixed(0)}s]`
  );
}

await mkdir(OUT, { recursive: true });
await writeFile(
  join(OUT, `field-${date}.json`),
  `${JSON.stringify(
    {
      date,
      server: SERVER,
      workedCounties: [...worked].sort(),
      byHour,
    },
    null,
    2
  )}\n`
);

console.log(`\nwritten to eval/out/field-${date}.json`);
