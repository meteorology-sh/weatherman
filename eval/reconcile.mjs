/**
 * The layers, against the instrument the operator briefs its own sorties on.
 *
 * `node eval/reconcile.mjs` — with the server running. Writes
 * `eval/out/reconcile-2025.json`. `--score` re-prints the summary from that
 * file without fetching anything.
 *
 * **Every other comparison in this evaluation is bounded by a clock.** The
 * model analyses once an hour, so a flare at 1843Z is read against 19z whatever
 * we do, and 17 minutes is a long time in a growing turret. The radiosondes are
 * the exception: every daily report opens with a sounding table for KMAF and
 * KDRT, and its 12Z ascent lands on an HRRR analysis hour, so neither side has
 * to be rounded to meet the other.
 *
 * The offset is small rather than absent. A sonde is released about 45 minutes
 * before the nominal hour and reaches the seeding band minutes into the flight,
 * so the true separation is 20–30 minutes. It is survivable here because a
 * thermal profile at 4–7 km moves tens of metres in an hour, where a growing
 * turret swings 40 dBZ in the same span.
 *
 * The rows the operator prints are the seeding decision itself — the freezing
 * level and the −15 °C height bound the glaciogenic window, and the warm cloud
 * depth is what a hygroscopic flare works — so this measures agreement with
 * what the crews are actually launched on.
 *
 * What it can and cannot reach:
 *
 * - It checks where the seeding band sits. The freezing level and the −15 °C
 *   height are the band's own coordinates, and they decide which part of the
 *   column the liquid integral is taken over.
 * - It does not check the liquid. Nothing in the record measures supercooled
 *   water in the band, and no sounding index stands in for it.
 *
 * So this says whether we are looking in the right place, not whether we are
 * right about what is there.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER } from "./lib/evaluate.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const M_PER_FT = 0.3048;
const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

/**
 * The two ascents the reports quote, and where they are released from.
 *
 * Midland and Del Rio are the sites the operator's own morning briefing uses,
 * so these are the numbers the decision to fly was made against.
 */
const SITES = {
  KMAF: { lat: 31.9425, lon: -102.2019, name: "Midland" },
  KDRT: { lat: 29.3742, lon: -100.9169, name: "Del Rio" },
};

/** The ascent the reports quote. Also an HRRR analysis hour, which is the point. */
const SOUNDING_HOUR = 12;

async function sounding(lat, lon, at) {
  const url = new URL("/forecast/sounding", SERVER);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("hour", "0");
  url.searchParams.set("at", at);

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 160)}`);
  }
  return res.json();
}

/**
 * The height of an isotherm, read off the levels the sounding returned.
 *
 * Linear between the two levels that straddle it, which is what the report's
 * own indices are. Searched from the bottom up so an inversion aloft cannot
 * return a crossing above the one that matters.
 */
function isothermFt(levels, targetC) {
  const sorted = [...levels].sort((a, b) => a.heightFt - b.heightFt);

  for (let i = 1; i < sorted.length; i++) {
    const below = sorted[i - 1];
    const above = sorted[i];
    if (
      (below.tempC >= targetC && above.tempC <= targetC) ||
      (below.tempC <= targetC && above.tempC >= targetC)
    ) {
      const span = above.tempC - below.tempC;
      if (span === 0) return below.heightFt;
      const fraction = (targetC - below.tempC) / span;
      return below.heightFt + fraction * (above.heightFt - below.heightFt);
    }
  }
  return null;
}

/** The temperature at a pressure level, if that level was read. */
function tempAtMb(levels, mb) {
  return levels.find((level) => level.mb === mb)?.tempC ?? null;
}

/**
 * What is being compared, and in which direction.
 *
 * Each pair states the report's field, ours, and the unit both are put into.
 * Heights are compared in metres because that is what the report prints —
 * converting ours rather than theirs keeps the ground truth untouched.
 */
const PAIRS = [
  {
    key: "freezingLevel",
    label: "freezing level",
    unit: "m",
    reported: (s) => s.freezingLevelM,
    ours: (h) => (h.freezingFt === null ? null : h.freezingFt * M_PER_FT),
    // A freezing level at or below sea level is not a reading over west Texas —
    // the ground is above 200 m at both sites and the season runs April to
    // October. Where the report prints one it is a bad lift out of the PDF, and
    // scoring it would charge the model for our own parse. Dropped at scoring
    // rather than at the fetch so the reading is still written to the output,
    // and so a stored sweep and a fresh one produce the same table.
    keep: (cell) => cell.reported > 0,
  },
  {
    key: "minus15Height",
    label: "−15 °C height",
    unit: "m",
    reported: (s) => s.minus15HeightM,
    ours: (h) => {
      const ft = isothermFt(h.levels, -15);
      return ft === null ? null : ft * M_PER_FT;
    },
  },
  {
    key: "cloudBase",
    label: "cloud base",
    unit: "m",
    // Not the same quantity, and reported rather than scored. The sounding's
    // cloud base is lifted from the ascent's own LCL and CCL — where a parcel
    // *would* condense once the day heats up, which is a statement about the
    // afternoon. HRRR's is the base of whatever deck is over the cell at 12Z,
    // which on a clear morning is cirrus. They agree only when the morning
    // already holds the convective cloud, so a difference here is not an error.
    loose: true,
    reported: (s) => s.cloudBaseM,
    ours: (h) =>
      h.diagnostics?.cloudBaseFt == null
        ? null
        : h.diagnostics.cloudBaseFt * M_PER_FT,
  },
  {
    key: "temp700Mb",
    label: "700 mb temperature",
    unit: "°C",
    reported: (s) => s.temp700Mb,
    ours: (h) => tempAtMb(h.levels, 700),
  },
  {
    key: "cape",
    label: "surface CAPE",
    unit: "J/kg",
    reported: (s) => s.capeJKg,
    ours: (h) => h.diagnostics?.capeJKg ?? null,
  },
];

const OUTFILE = join(OUT, "reconcile-2025.json");

/**
 * `--score` re-prints the summary from the last run instead of fetching again.
 *
 * The sweep is hours of cold archive builds and the arithmetic over its output
 * is milliseconds. A published number has to be checkable without paying for
 * the sweep a second time, so the two are separable.
 */
const SCORE_ONLY = process.argv.includes("--score");

const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);
const seeded = SCORE_ONLY ? [] : days.filter((day) => day.seeded);
const rows = SCORE_ONLY ? JSON.parse(await readFile(OUTFILE, "utf8")).rows : [];

console.log(
  SCORE_ONLY
    ? `${rows.length} paired soundings, read back from eval/out/reconcile-2025.json\n`
    : `${days.filter((day) => day.seeded).length} seeded days, ` +
        `${Object.keys(SITES).length} sites, ${SOUNDING_HOUR}Z — an HRRR ` +
        `analysis hour, so neither side is rounded to meet the other.\n`
);

for (const day of seeded) {
  const at = `${day.date}T${String(SOUNDING_HOUR).padStart(2, "0")}:00:00.000Z`;

  for (const [code, site] of Object.entries(SITES)) {
    const reported = day.soundings?.[code];
    if (!reported) continue;

    let ours = null;
    let error = null;
    try {
      ours = await sounding(site.lat, site.lon, at);
    } catch (failure) {
      error = failure.message;
    }

    const compared = {};
    for (const pair of PAIRS) {
      const theirs = pair.reported(reported);
      const mine = ours ? pair.ours(ours) : null;
      compared[pair.key] =
        theirs == null || mine == null
          ? { reported: theirs ?? null, ours: mine ?? null, error: null }
          : {
              reported: theirs,
              ours: Math.round(mine * 10) / 10,
              error: Math.round((mine - theirs) * 10) / 10,
            };
    }

    rows.push({ date: day.date, site: code, at, error, compared });

    const summary = PAIRS.map((pair) => {
      const cell = compared[pair.key];
      return cell.error === null
        ? `${pair.key} —`
        : `${pair.key} ${cell.error > 0 ? "+" : ""}${cell.error}`;
    }).join("  ");

    console.log(
      `  ${day.date} ${code}  ${error ? `error: ${error}` : summary}`
    );
  }

  await mkdir(OUT, { recursive: true });
  await writeFile(
    join(OUT, "reconcile-2025.json"),
    `${JSON.stringify({ server: SERVER, sites: SITES, rows }, null, 2)}\n`
  );
}

/** Bias, spread and worst case for one pair, over the readings it accepts. */
function score(pair) {
  const errors = rows
    .map((row) => row.compared[pair.key])
    .filter((cell) => cell && cell.error !== null && cell.error !== undefined)
    .filter((cell) => (pair.keep ? pair.keep(cell) : true))
    .map((cell) => cell.error)
    .sort((a, b) => a - b);

  if (!errors.length) return null;

  const mean = errors.reduce((sum, value) => sum + value, 0) / errors.length;
  const absolute = errors.map(Math.abs).sort((a, b) => a - b);

  return {
    n: errors.length,
    bias: Math.round(mean * 10) / 10,
    medianAbs: absolute[Math.floor(absolute.length / 2)],
    worst: absolute[absolute.length - 1],
    range: [errors[0], errors[errors.length - 1]],
  };
}

console.log(`\n${"=".repeat(70)}`);
console.log(
  `${rows.length} paired soundings, ${rows.filter((row) => row.error).length} failed\n`
);
console.log(
  "reading".padEnd(20) +
    "n".padStart(4) +
    "bias".padStart(9) +
    "med |err|".padStart(11) +
    "worst".padStart(9) +
    "  range"
);

for (const pair of PAIRS) {
  const stats = score(pair);
  if (!stats) {
    console.log(`${pair.label.padEnd(20)}   — nothing to compare`);
    continue;
  }
  console.log(
    `${pair.label.padEnd(20)}` +
      `${String(stats.n).padStart(4)}` +
      `${String(stats.bias).padStart(9)}` +
      `${String(stats.medianAbs).padStart(11)}` +
      `${String(stats.worst).padStart(9)}` +
      `  ${stats.range[0]} … ${stats.range[1]} ${pair.unit}` +
      `${pair.loose ? "   (different quantities — see the source)" : ""}`
  );
}

/* ---------- the band as a whole ---------- */

/**
 * How much of the seeding band we drew is the seeding band that was measured.
 *
 * The two edges are scored separately above, but a crew does not fly an edge —
 * it flies the layer between them. Overlap divided by union is the figure that
 * answers "would an aircraft holding our band have been in theirs": 1.0 is the
 * same layer, 0.0 is two layers that do not touch. Reported against the union
 * rather than against theirs alone so that drawing a band far too deep is
 * penalised rather than rewarded for covering everything.
 */
const overlaps = rows
  .map((row) => {
    const base = row.compared.freezingLevel;
    const top = row.compared.minus15Height;
    if (base?.error === null || top?.error === null) return null;
    if (!base || !top) return null;

    const lowest = Math.min(base.reported, base.ours);
    const highest = Math.max(top.reported, top.ours);
    const shared =
      Math.min(top.reported, top.ours) - Math.max(base.reported, base.ours);
    return {
      date: row.date,
      site: row.site,
      depth: top.reported - base.reported,
      fraction: Math.max(0, shared) / (highest - lowest),
    };
  })
  .filter(Boolean)
  .sort((a, b) => a.fraction - b.fraction);

if (overlaps.length) {
  const fractions = overlaps.map((entry) => entry.fraction);
  const mean =
    fractions.reduce((sum, value) => sum + value, 0) / overlaps.length;
  const median = fractions[Math.floor(overlaps.length / 2)];
  const depths = overlaps.map((entry) => entry.depth).sort((a, b) => a - b);
  const pct = (value) => `${(value * 100).toFixed(1)}%`;

  console.log(`\n${"-".repeat(70)}`);
  console.log(
    `the band as a layer — ${overlaps.length} ascents with both edges\n`
  );
  console.log(
    `  overlap with the measured band   median ${pct(median)}   ` +
      `mean ${pct(mean)}   worst ${pct(fractions[0])}`
  );
  console.log(
    `  measured band depth              median ${depths[Math.floor(depths.length / 2)]} m   ` +
      `range ${depths[0]}–${depths[depths.length - 1]} m`
  );
  console.log(
    `  cleared 90% / 80%                ` +
      `${fractions.filter((value) => value >= 0.9).length} / ` +
      `${fractions.filter((value) => value >= 0.8).length} of ${overlaps.length}`
  );
  console.log(`\n  loosest five:`);
  for (const entry of overlaps.slice(0, 5)) {
    console.log(
      `    ${entry.date} ${entry.site}  ${pct(entry.fraction)}  ` +
        `over a ${entry.depth} m band`
    );
  }
}

console.log(
  SCORE_ONLY
    ? `\nread from eval/out/reconcile-2025.json — nothing fetched`
    : `\nwritten to eval/out/reconcile-2025.json`
);
