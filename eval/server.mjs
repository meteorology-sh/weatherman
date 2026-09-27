/**
 * The findings, over HTTP, for the eval app to draw.
 *
 * `node eval/server.mjs [--season=2025]` — port 3100, one season at a time. No
 * dependencies, no build.
 *
 * It serves two things and nothing else: the operators' own record, committed in
 * `data/`,
 * and whatever the scripts in this directory have written to `out/`. It holds no
 * weather at all — every layer the app paints comes from the Weatherman server
 * itself, so the picture under the flares is the product's own output rather
 * than a second rendering of the same idea.
 *
 * **Separate from the Weatherman server on purpose.** What it serves is one
 * operator's flight record and our scoring of it. Neither is a measurement the
 * product makes, so no product route reads `out/`. `out/` is a working
 * directory that is not committed; this server re-reads it on every request.
 *
 * **The arithmetic behind a published number lives here, not in the app.**
 * Sounding-layer overlap is calculated from the balloon JSON. Layer and
 * Texas-feature counts are calculated from the painted files. The page and
 * `EVALUATION.md` cannot drift apart by recomputing the same figure two ways.
 */

// Node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Local
import {
  bandOverlap,
  spread,
  summarizeOverlaps,
  unusableKey,
} from "./lib/band-score.mjs";
import { COUNTIES, regionsOf, seasonDirs, seasonOf } from "./lib/season.mjs";
import { summarizeDay, tallyFlags } from "./lib/storm-score.mjs";

const SEASON = seasonOf();
const { data: DATA, out: OUT } = seasonDirs(SEASON);
const PORT = Number(process.env.EVAL_PORT ?? 3100);

const M_PER_FT = 0.3048;

/* ---------- committed input, read once ---------- */

/**
 * The programs this evaluation can run against, and the flight record each
 * one has been parsed into.
 *
 * **A region with no parsed record is still listed.** Texas licenses several
 * programs and only one of them has been read out of its reports so far; a
 * region list that hid the others would make one operator's season look like the
 * whole state. The app routes to them and says what is missing.
 */
const regions = await regionsOf(SEASON);

const loaded = new Map();
for (const region of regions) {
  if (!region.releases) {
    loaded.set(region.id, { region, seeded: null });
    continue;
  }
  const { days } = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );
  loaded.set(region.id, { region, seeded: days.filter((day) => day.seeded) });
}

/** A region's parsed season, or null when it has none. */
const evaluable = (id) => {
  const entry = loaded.get(id);
  return entry?.seeded ? entry : null;
};

/**
 * The county boundaries, with an id stamped on each.
 *
 * TIGERweb sends a name and a GEOID and no object id, and a layer told which
 * field is its id will not load without one. Numbered here rather than in
 * `counties.mjs` so the committed file stays exactly what the Census served.
 */
const counties = JSON.stringify(
  await readFile(COUNTIES, "utf8").then((text) => {
    const collection = JSON.parse(text);
    collection.features.forEach((feature, index) => {
      feature.properties = { OBJECTID: index + 1, ...feature.properties };
    });
    return collection;
  })
);

/* ---------- run output, re-read per request ---------- */

/** A run's output, or null if that run has not happened yet. */
async function run(name) {
  try {
    return JSON.parse(await readFile(join(OUT, name), "utf8"));
  } catch {
    return null;
  }
}

/* ---------- finding 1: the band against the balloons ---------- */

const READINGS = [
  { key: "freezingLevel", label: "Freezing level", unit: "m" },
  { key: "minus15Height", label: "−15 °C height", unit: "m" },
  { key: "temp700Mb", label: "Temperature at 700 mb", unit: "°C" },
  { key: "cape", label: "Surface instability", unit: "J/kg" },
];

async function band({ region }) {
  const data = await run(region.runs.balloons);
  if (!data) return null;

  const rows = data.rows;
  const usable = rows.filter((row) => !unusableKey(row));
  const readings = READINGS.map((reading) => {
    const values = usable
      .map((row) => row.compared?.[reading.key])
      .filter((cell) => cell && cell.error !== null && cell.error !== undefined)
      .filter((cell) => reading.key !== "freezingLevel" || cell.reported > 0)
      .map((cell) => cell.error);
    return { ...reading, ...spread(values) };
  });

  const overlaps = usable.map(bandOverlap).filter(Boolean);

  return {
    sites: data.sites,
    attempted: rows.length,
    failed: rows.filter((row) => row.error).length,
    readings,
    overlap: summarizeOverlaps(overlaps),
    ascents: overlaps.sort((a, b) => a.date.localeCompare(b.date)),
    rows,
  };
}

/* ---------- one day ---------- */

/** The file a run wrote for one date, e.g. `painted-{date}.json`. */
const forDate = (template, date) => template.replace("{date}", date);

/**
 * A painted day, with the seeding opportunity scored on the cell.
 *
 * A release is in the seeding opportunity when a click on the 3 km cell it
 * landed in says FLY. The stored outline is smoothed and can disagree with the
 * cells along its edge (`docs/GEOMETRY.md`), so `near.target.inside` is
 * replaced by the verdict here, once, and every count and label the app shows
 * reads the same answer `EVALUATION.md` prints. `km` is zero on FLY; on DON'T
 * FLY inside the outline it is the distance out of the outline.
 */
async function paintedOn(region, date) {
  const painted = await run(forDate(region.runs.painted, date));
  for (const flare of painted ? flaresOf(painted) : []) {
    const near = flare.near?.target;
    if (!near || (near.km === null && !near.empty) || !flare.cell) continue;
    const fly = flare.cell.target === "target";
    if (fly) near.km = 0;
    else if (near.inside) near.km = near.edgeKm ?? near.km;
    near.inside = fly;
  }
  return painted;
}

/* ---------- how near the flares were ---------- */

/**
 * A set of measured distances, as the few numbers worth quoting.
 *
 * **Inside is inside the contour.** Native cell size is the next honest step
 * out, not a second definition of inside. Two cells is carried as the step
 * after that. Neither is a claim about how near an aircraft ought to be.
 */
function summarize(measured, cell) {
  const kms = measured
    .map((near) => near.km)
    .filter((km) => km !== null)
    .sort((a, b) => a - b);
  return {
    n: measured.length,
    inside: measured.filter((near) => near.inside).length,
    withinCell: kms.filter((km) => km <= cell).length,
    withinTwoCells: kms.filter((km) => km <= 2 * cell).length,
    median: kms.length ? kms[Math.floor(kms.length / 2)] : null,
    worst: kms.length ? kms[kms.length - 1] : null,
  };
}

/** Every release in a painted day, in time order across its analyses. */
const flaresOf = (painted) =>
  (painted.analyses ?? []).flatMap((entry) => entry.flares);

/**
 * The releases a layer could be measured against — the rest have no frame.
 *
 * A layer that painted nothing in the window is an answer, and the release is
 * outside it, so it stays in the denominator with no distance, as it does in
 * `EVALUATION.md`. A null is a route that failed.
 */
const measuredAgainst = (flares, key) =>
  flares
    .map((flare) => flare.near?.[key])
    .filter((near) => near && (near.km !== null || near.empty === true));

/** How far each release had to be carried to meet its analysis. */
function offsets(flares) {
  const minutes = flares
    .map((flare) => flare.offsetMinutes)
    .filter((value) => value !== null && value !== undefined)
    .map(Math.abs)
    .sort((a, b) => a - b);
  return minutes.length
    ? {
        median: minutes[Math.floor(minutes.length / 2)],
        worst: minutes[minutes.length - 1],
      }
    : null;
}

/**
 * The day's distances, summarized per layer.
 *
 * Computed here rather than in the page for the reason everything else is: a
 * figure quoted anywhere has to come from one place, or the map and the prose
 * drift apart while both look right.
 */
function cellOf(painted, layer) {
  if (painted.cellKm && typeof painted.cellKm === "object") {
    return layer.cellKm ?? painted.cellKm[layer.key] ?? 3;
  }
  return layer.cellKm ?? painted.cellKm ?? 3;
}

function proximity(painted) {
  const flares = flaresOf(painted);
  const layers = {};

  for (const layer of painted.layers ?? []) {
    layers[layer.key] = summarize(
      measuredAgainst(flares, layer.key),
      cellOf(painted, layer)
    );
  }

  return {
    cellKm: painted.cellKm,
    flares: flares.length,
    layers,
    // The point of printing it is that it bounds what the drift correction
    // could be worth.
    offset: offsets(flares),
  };
}

/**
 * The same question over every day that has been painted.
 *
 * **A season is not the average of its days.** A day with one flare and a day
 * with forty-six each answer the question once, so the pooled figures below
 * count releases rather than averaging per-day rates, and the per-day rows are
 * carried alongside because the interesting shape of this finding is which days
 * disagree rather than how often they do.
 *
 * A day whose file has not been built is missing rather than zero, and `days`
 * against `flying` says how much of the season the numbers cover.
 */
async function near({ region, seeded }) {
  const built = [];
  for (const record of seeded) {
    const painted = await paintedOn(region, record.date);
    if (painted) built.push({ date: record.date, painted });
  }
  if (!built.length) return null;

  const cell = built[0].painted.cellKm;
  const layers = built[0].painted.layers ?? [];
  const all = built.flatMap((entry) => flaresOf(entry.painted));

  return {
    cellKm: cell,
    days: built.length,
    flying: seeded.length,
    flares: all.length,
    // Every release the season has, painted or not, so the coverage of the
    // pooled numbers can be read off the same object.
    located: seeded.reduce(
      (n, day) => n + day.releases.filter((release) => release.located).length,
      0
    ),
    layers: Object.fromEntries(
      layers.map((layer) => [
        layer.key,
        summarize(
          measuredAgainst(all, layer.key),
          cellOf(built[0].painted, layer)
        ),
      ])
    ),
    offset: offsets(all),
    rows: built.map((entry) => ({
      date: entry.date,
      ...proximity(entry.painted),
    })),
  };
}

/**
 * The radar-storm tests over every day that has been painted.
 *
 * Same pooling rule as `near`: a day with one flare and a day with forty-six
 * each answer once, so the bars count releases. A flare whose painted record
 * has no `storm` key is missing rather than no, and `scored` against `flares`
 * says how much of the painted season actually carries a reading.
 */
async function storms({ region, seeded }) {
  const built = [];
  for (const record of seeded) {
    const painted = await paintedOn(region, record.date);
    if (painted) built.push({ date: record.date, painted });
  }
  if (!built.length) return null;

  const all = built.flatMap((entry) => flaresOf(entry.painted));
  return {
    days: built.length,
    flying: seeded.length,
    flares: all.length,
    scored: all.filter((flare) =>
      Object.prototype.hasOwnProperty.call(flare, "storm")
    ).length,
    tests: tallyFlags(all),
    rows: built.map((entry) =>
      summarizeDay(entry.date, flaresOf(entry.painted))
    ),
  };
}

async function day({ region, seeded }, date) {
  const record = seeded.find((entry) => entry.date === date);
  if (!record) return null;

  return {
    date,
    dayTotal: record.dayTotal ?? null,
    soundings: record.soundings ?? null,
    observations: record.observations ?? [],
    unlocated: record.releases.filter((release) => !release.located),
    // Whether the painted frames for this day have been built. The app offers
    // the map only when they have, rather than opening an empty one.
    painted: Boolean(await run(forDate(region.runs.painted, date))),
    releases: record.releases
      .filter((release) => release.located)
      .map((release) => ({
        ...release,
        // A Panhandle row says a flare was released and never how many, so
        // its payload is unknown rather than glaciogenic by default.
        payload:
          release.glaciogenic === null && release.hygroscopic === null
            ? null
            : release.glaciogenic && release.hygroscopic
              ? "both"
              : release.hygroscopic
                ? "hygroscopic"
                : "glaciogenic",
      })),
  };
}

/**
 * The seeding-band heights the operator briefed on, in feet.
 *
 * The reports print meters and the app talks in feet everywhere else, so the
 * conversion happens once, here, rather than at each place that draws it.
 */
function briefing(record) {
  // The first site the day carries. West Texas briefs on Midland and Del Rio,
  // Trans-Pecos on Midland alone, and the Panhandle on a model column rather
  // than a balloon at all — so which key is there is the region's business.
  const site = Object.values(record.soundings ?? {}).find(
    (values) => values && Object.keys(values).length
  );
  if (!site) return null;
  const ft = (m) => (m == null ? null : Math.round(m / M_PER_FT));
  return {
    freezingLevelFt: ft(site.freezingLevelM),
    // The Panhandle's forecast column stops at -10 °C, which is above the
    // freezing level and below the top of the band. Reporting it as the -15
    // height would be reporting a different height under its name.
    minus15HeightFt: ft(site.minus15HeightM),
    minus10HeightFt: ft(site.minus10HeightM),
    temp700Mb: site.temp700Mb ?? null,
  };
}

/* ---------- routes ---------- */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  try {
    const path = url.pathname;

    if (path === "/healthcheck") return send(200, { ok: true });
    if (path === "/counties.geojson") return send(200, counties);

    // Every program, whether or not its reports have been parsed,
    // so the app can route to one that has not been and say what is missing.
    if (path === "/regions") {
      return send(
        200,
        regions.map(
          ({ id, name, short, base, source, season, window, sounding }) => ({
            id,
            name,
            short,
            base: base ?? null,
            source: source ?? null,
            season: season ?? null,
            window: window ?? null,
            // What the region's own briefing reads. Two balloon ascents in West
            // Texas, one in Trans-Pecos, a model column in the Panhandle — a
            // page that names Midland and Del Rio for all three is describing
            // one operator's morning as everybody's.
            sounding: sounding ?? [],
            evaluable: Boolean(evaluable(id)),
            days: evaluable(id)?.seeded.length ?? 0,
            flares:
              evaluable(id)?.seeded.reduce(
                (n, d) => n + d.releases.filter((r) => r.located).length,
                0
              ) ?? 0,
          })
        )
      );
    }

    // Everything below is one program's season. The region is in the path
    // rather than a query parameter because it selects the whole dataset, not a
    // filter on one — a page for a region is a different page.
    const scoped = path.match(/^\/region\/([a-z0-9-]+)(\/.*)?$/);
    if (scoped) {
      const entry = evaluable(scoped[1]);
      if (!entry) {
        return send(404, {
          error: loaded.has(scoped[1])
            ? `${loaded.get(scoped[1]).region.name} has no parsed flight record yet`
            : `no region "${scoped[1]}"`,
        });
      }
      const { region, seeded } = entry;
      const rest = scoped[2] ?? "";

      if (rest === "/band") {
        const found = await band(entry);
        return found
          ? send(200, found)
          : send(404, {
              error: "no balloon comparison yet — node eval/balloons.mjs",
            });
      }

      if (rest === "/near") {
        const found = await near(entry);
        return found
          ? send(200, found)
          : send(404, {
              error: "no day painted yet — node eval/paint.mjs <date>",
            });
      }

      if (rest === "/storms") {
        const found = await storms(entry);
        return found
          ? send(200, found)
          : send(404, {
              error: "no day painted yet — node eval/paint.mjs <date>",
            });
      }

      if (rest === "/days") {
        return send(
          200,
          await Promise.all(
            seeded.map(async (record) => ({
              date: record.date,
              flares: record.releases.filter((r) => r.located).length,
              unlocated: record.releases.filter((r) => !r.located).length,
              observations: record.observations?.length ?? 0,
              painted: Boolean(
                await run(forDate(region.runs.painted, record.date))
              ),
              briefing: briefing(record),
            }))
          )
        );
      }

      const painted = rest.match(/^\/day\/(\d{4}-\d{2}-\d{2})\/painted$/);
      if (painted) {
        const found = await paintedOn(region, painted[1]);
        if (!found) {
          return send(404, {
            error:
              `not painted yet — node eval/paint.mjs ${painted[1]} ` +
              `--region=${region.id}`,
          });
        }
        return send(200, { ...found, proximity: proximity(found) });
      }

      const one = rest.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
      if (one) {
        const found = await day(entry, one[1]);
        return found
          ? send(200, found)
          : send(404, { error: `no report for ${one[1]}` });
      }
    }

    send(404, { error: `no route for ${path}` });
  } catch (error) {
    send(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`eval data on http://localhost:${PORT}`);
  for (const { region, seeded } of loaded.values()) {
    console.log(
      seeded
        ? `  ${region.id.padEnd(11)} ${seeded.length} flying days, ` +
            `${seeded.reduce((n, d) => n + d.releases.length, 0)} flares`
        : `  ${region.id.padEnd(11)} no flight record parsed`
    );
  }
});
