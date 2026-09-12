/**
 * The layers, against the instrument the operator briefs its own sorties on.
 *
 * `node eval/balloons.mjs [--region=wtwma] [--resume]` — with the server
 * running. Writes the file `data/regions.json` names for that region.
 * `--score` re-prints the summary from it without fetching anything.
 *
 * **Every other comparison in this evaluation is bounded by a clock.** The
 * model analyses once an hour, so a flare at 1843Z is read against 19z whatever
 * we do, and 17 minutes is a long time in a growing turret. The radiosondes are
 * the exception: every daily report opens with a sounding table, and its 12Z
 * ascent lands on an HRRR analysis hour, so neither side has to be rounded to
 * meet the other.
 *
 * **This can only be run where the region briefs on a balloon.** Four of the
 * five print a radiosonde — West Texas reads Midland and Del Rio, Trans-Pecos
 * and the Rolling Plains read Midland, South Texas reads Del Rio. The Panhandle
 * prints a NAM forecast column instead, and checking HRRR against NAM compares
 * two models rather than a model against an instrument, so it is refused here
 * rather than run and caveated.
 *
 * **The site is the balloon's, not the target area's.** The Rolling Plains fly
 * 200 km from Midland and brief on Midland anyway, so Midland is where our
 * column is sampled — the question is whether we agree with the instrument the
 * crew actually read, not with the air over the cell.
 *
 * The offset is small rather than absent. A sonde is released about 45 minutes
 * before the nominal hour and reaches the layer minutes into the flight,
 * so the true separation is 20–30 minutes. It is survivable here because a
 * thermal profile at 4–7 km moves tens of meters in an hour, where a growing
 * turret swings 40 dBZ in the same span.
 *
 * The rows the operator prints are the seeding decision itself — the freezing
 * level and the −15 °C height are the layer the crews brief, and the warm
 * cloud depth is what a hygroscopic flare works — so this measures agreement
 * with what the crews are actually launched on.
 *
 * What it can and cannot reach:
 *
 * - It checks the modeled column, at the two heights the reports print: 0 and
 *   −15 °C.
 * - It does not check the seeding band's own edges. The band runs −5 to
 *   −18 °C, and the reports carry an indices table rather than an ascent, so
 *   the balloon's −5 and −18 heights are not in the record at all. Deriving
 *   them from the two printed points would assume a lapse rate nobody read
 *   and extrapolate past −15 for the cold edge.
 * - It does not check the liquid. Nothing in the record measures supercooled
 *   water at any temperature, and no sounding index stands in for it.
 *
 * So this says whether the column is in the right place, not whether we are
 * right about what is in it.
 */

// Node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { SERVER, SERVERS } from "./lib/weatherman.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");

const M_PER_FT = 0.3048;
const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

/**
 * The radiosonde sites the programs brief on, and where they are released
 * from. A region names the ones it reads in `data/regions.json`; anything it
 * names that is not here is not a balloon and cannot be scored against.
 */
const STATIONS = {
  KMAF: { lat: 31.9425, lon: -102.2019, name: "Midland" },
  KDRT: { lat: 29.3742, lon: -100.9169, name: "Del Rio" },
};

/** The ascent the reports quote. Also an HRRR analysis hour, which is the point. */
const SOUNDING_HOUR = 12;

async function sounding(lat, lon, at, server = SERVER) {
  const url = new URL("/forecast/sounding", server);
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
 * Heights are compared in meters because that is what the report prints —
 * converting ours rather than theirs leaves the report's own numbers alone.
 */
const PAIRS = [
  {
    key: "freezingLevel",
    label: "freezing level",
    unit: "m",
    bandEdge: true,
    reported: (s) => s.freezingLevelM,
    ours: (h) => (h.freezingFt === null ? null : h.freezingFt * M_PER_FT),
    // A freezing level at or below sea level is not a reading over west Texas —
    // the ground is above 200 m at both sites and the season runs April to
    // October. Where the report prints one it is a bad lift out of the PDF, and
    // scoring it would charge the model for our own parse. Dropped at scoring
    // rather than at the fetch so the reading is still written to the output,
    // and so a stored run and a fresh one produce the same table.
    keep: (cell) => cell.reported > 0,
  },
  {
    key: "minus15Height",
    label: "−15 °C height",
    unit: "m",
    bandEdge: true,
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
    key: "ccl",
    label: "CCL",
    unit: "m",
    // The one row where both sides are the same quantity. The report prints the
    // ascent's own convective condensation level, and `ccl.ts` computes ours
    // from HRRR's surface moisture against its temperature profile — same
    // definition, same 12Z column, so this is scored rather than reported.
    //
    // It matters because the cloud-base layer falls back to this height
    // wherever HRRR diagnoses no cloud, which is about half the domain. The
    // `cloudBase` row above cannot check that fallback: it compares HRRR's 12Z
    // deck against an afternoon parcel height and the two are not the same
    // claim. This row is the fallback's own accuracy, against the instrument.
    reported: (s) => s.cclM,
    ours: (h) => (h.cclFt == null ? null : h.cclFt * M_PER_FT),
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

/**
 * `--score` re-prints the summary from the last run instead of fetching again.
 *
 * The run is hours of cold archive builds and the arithmetic over its output
 * is milliseconds. A published number has to be checkable without paying for
 * the run a second time, so the two are separable.
 */
const SCORE_ONLY = process.argv.includes("--score");

/**
 * `--resume` keeps the ascents already on disk and fetches only what is
 * missing. The run is long enough that losing it to a restarted machine is a
 * real cost, and an ascent does not change once read.
 */
const RESUME = process.argv.includes("--resume");

const REGION =
  process.argv.find((arg) => arg.startsWith("--region="))?.slice(9) ?? "wtwma";

const { regions } = JSON.parse(
  await readFile(join(HERE, "data", "regions.json"), "utf8")
);
const region = regions.find((entry) => entry.id === REGION);

if (!region) {
  console.error(
    `unknown region "${REGION}" — try ${regions.map((r) => r.id).join(", ")}`
  );
  process.exit(1);
}

const sites = (region.sounding ?? []).filter((code) => STATIONS[code]);

if (!region.releases || sites.length === 0) {
  const named = (region.sounding ?? []).join(", ") || "nothing";
  console.error(
    `${region.name} briefs on ${named}, which is not a radiosonde.\n` +
      "This measures our column against an instrument; against a model column " +
      "it would\ncompare two forecasts and report the agreement as accuracy."
  );
  process.exit(1);
}

const OUTFILE = join(OUT, region.runs?.balloons ?? `balloons-${REGION}.json`);

const { days } = JSON.parse(
  await readFile(join(HERE, "data", region.releases), "utf8")
);

/** What a previous run already read, when asked to keep it. */
const rows =
  SCORE_ONLY || RESUME
    ? (JSON.parse(await readFile(OUTFILE, "utf8").catch(() => "{}")).rows ?? [])
    : [];

const done = new Set(rows.map((row) => `${row.date} ${row.site}`));
const seeded = SCORE_ONLY ? [] : days.filter((day) => day.seeded);

console.log(
  SCORE_ONLY
    ? `${rows.length} paired soundings, read back from ${OUTFILE}\n`
    : `${region.name}\n${seeded.length} seeded days, ` +
        `${sites.join(" and ")} at ${SOUNDING_HOUR}Z — an HRRR ` +
        `analysis hour, so neither side is rounded to meet the other.` +
        `${RESUME && rows.length ? `\n${rows.length} ascents already on disk, kept.` : ""}\n`
);

/**
 * Every ascent still to fetch, flattened out of the day list.
 *
 * Flat because the work is one (day, site) pair per model column and the day
 * loop was only ever a way to reach them. `--resume` has already removed the
 * ones on disk.
 */
const queue = [];
for (const day of seeded) {
  const at = `${day.date}T${String(SOUNDING_HOUR).padStart(2, "0")}:00:00.000Z`;
  for (const code of sites) {
    const reported = day.soundings?.[code];
    if (!reported) continue;
    if (done.has(`${day.date} ${code}`)) continue;
    queue.push({ date: day.date, code, at, reported });
  }
}

/**
 * One worker per API, each taking the next ascent off the queue.
 *
 * Every column is a separate HRRR run, so nothing is shared between them and
 * the only limit is how many APIs there are to ask. See `SERVERS` for why the
 * pool is sized by addresses rather than by a concurrency number.
 */
let next = 0;
async function worker(server) {
  while (next < queue.length) {
    const task = queue[next++];
    const site = STATIONS[task.code];

    let ours = null;
    let error = null;
    try {
      ours = await sounding(site.lat, site.lon, task.at, server);
    } catch (failure) {
      error = failure.message;
    }

    const compared = {};
    for (const pair of PAIRS) {
      const theirs = pair.reported(task.reported);
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

    rows.push({
      date: task.date,
      site: task.code,
      at: task.at,
      error,
      compared,
    });

    const summary = PAIRS.map((pair) => {
      const cell = compared[pair.key];
      return cell.error === null
        ? `${pair.key} —`
        : `${pair.key} ${cell.error > 0 ? "+" : ""}${cell.error}`;
    }).join("  ");

    console.log(
      `  ${task.date} ${task.code}  ${error ? `error: ${error}` : summary}`
    );
  }
}

if (SERVERS.length > 1) {
  console.log(`  ${queue.length} ascents over ${SERVERS.length} APIs\n`);
}

await Promise.all(SERVERS.map((server) => worker(server)));

// Sorted before writing, so a run over one API and a run over thirty produce
// the same file. Workers finish out of order and the output is a record, not
// a log of what happened to land first.
rows.sort(
  (a, b) => a.date.localeCompare(b.date) || a.site.localeCompare(b.site)
);

await mkdir(OUT, { recursive: true });
await writeFile(
  OUTFILE,
  `${JSON.stringify(
    {
      server: SERVERS.length > 1 ? SERVERS : SERVER,
      region: region.id,
      sites: Object.fromEntries(sites.map((code) => [code, STATIONS[code]])),
      rows,
    },
    null,
    2
  )}\n`
);

/**
 * An ascent whose printed band cannot be a measured band.
 *
 * Fifteen degrees of cooling needs depth. The dry adiabatic lapse rate,
 * 9.8 °C/km, is the steepest a deep layer sustains — anything steeper is
 * superadiabatic, which happens in a shallow layer over hot ground and never
 * through the 4–7 km column this band sits in. So the freezing level and the
 * −15 °C height cannot be printed closer together than 15 / 9.8 km.
 *
 * South Texas prints 4072 m and 4944 m on 31 March: 872 m apart, 17.2 °C/km.
 * One of those two numbers is a typo and **nothing here can say which**. Our
 * own column agrees with the freezing level and not with the −15 °C height,
 * but using that to pick which of their numbers to keep would be judging the
 * balloon by the model and then reporting the agreement as accuracy. So
 * the whole morning is dropped from both edges and from the band, and named in
 * the output — the same rule as a coordinate kept exactly as printed and left
 * unscored.
 */
const DRY_ADIABATIC_C_PER_KM = 9.8;
const SHALLOWEST_BAND_M = (15 / DRY_ADIABATIC_C_PER_KM) * 1000;

const impossible = rows
  .filter((row) => {
    const base = row.compared.freezingLevel;
    const top = row.compared.minus15Height;
    return (
      base?.reported != null &&
      top?.reported != null &&
      top.reported - base.reported < SHALLOWEST_BAND_M
    );
  })
  .map((row) => {
    const depth =
      row.compared.minus15Height.reported - row.compared.freezingLevel.reported;
    return { date: row.date, site: row.site, depth, rate: (15 / depth) * 1000 };
  });

const unusable = new Set(
  impossible.map((entry) => `${entry.date} ${entry.site}`)
);

/** Bias, spread and worst case for one pair, over the readings it accepts. */
function score(pair) {
  const errors = rows
    .filter(
      (row) => !(pair.bandEdge && unusable.has(`${row.date} ${row.site}`))
    )
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

for (const entry of impossible) {
  console.log(
    `  ${entry.date} ${entry.site} prints a ${Math.round(entry.depth)} m band, ` +
      `which is ${entry.rate.toFixed(1)} °C/km — steeper than dry adiabatic,\n` +
      `  so one of its two edges is a typo and neither is scored below.\n`
  );
}
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
 * How much of the 0 to −15 °C layer we model is the layer that was measured.
 *
 * The two edges are scored separately above, but a crew does not fly an edge —
 * it flies the layer between them. Overlap divided by union is the figure that
 * answers "would an aircraft holding our layer have been in theirs": 1.0 is the
 * same layer, 0.0 is two layers that do not touch. Reported against the union
 * rather than against theirs alone so that drawing a layer far too deep is
 * penalized rather than rewarded for covering everything.
 */
const overlaps = rows
  .map((row) => {
    const base = row.compared.freezingLevel;
    const top = row.compared.minus15Height;
    if (base?.error === null || top?.error === null) return null;
    if (!base || !top) return null;
    if (unusable.has(`${row.date} ${row.site}`)) return null;

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
    ? `\nread from ${OUTFILE} — nothing fetched`
    : `\nwritten to ${OUTFILE}`
);
