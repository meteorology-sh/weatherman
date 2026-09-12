/**
 * Print one season's evaluation tables from files already in its
 * `eval/out/<season>/`.
 *
 * `node eval/score-season.mjs [--season=2025]` — no server. The 2025 tables are
 * `docs/EVALUATION.md`; every other season's are `docs/EVALUATION-<season>.md`. Layer overlap and Texas storm
 * features come from the painted days. Sounding-layer overlap is
 * calculated from the balloon JSON. Shared Midland and Del Rio mornings
 * are counted once in the season sounding-layer table.
 *
 * Every overlap is also read against a tolerance: one cell of the layer plus
 * the rounding of the printed position (`lib/tolerance.mjs`). A release
 * outside the layer but within it is printed on its own line, never added to
 * inside.
 */

// Node
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Local
import { bandOverlap, spread, summarizeOverlaps } from "./lib/band-score.mjs";
import { boxAreaKm2, inFeature, polygonsAreaKm2 } from "./lib/geo.mjs";
import { COUNTIES, regionsOf, seasonDirs, seasonOf } from "./lib/season.mjs";
import { tallyFlags } from "./lib/storm-score.mjs";
import { positionBoundKm, radialOf } from "./lib/tolerance.mjs";

const SEASON = seasonOf();
const { out: OUT } = seasonDirs(SEASON);

/** The layers Weatherman draws, in the panel's order. */
const LAYERS = [
  ["target", "Seeding opportunity"],
  ["radar", "Radar reflectivity"],
  ["echoFreeze", "Echo past freezing"],
  ["cloudBase", "Cloud base"],
  ["liquid", "Supercooled liquid water"],
];

/**
 * Layers whose edge is placed by an observation valid at the release minute.
 *
 * These fills have already followed the storm before anything is carried to
 * meet them, so the release is scored where it happened. `paint.mjs` records
 * this on each flare as `near.<layer>.clock`; the set is repeated here so days
 * painted before that field existed score by the same rule as days painted
 * after, rather than the tables mixing two conventions.
 */
const MEASURED_EDGE = new Set(["cloudBase", "radar", "target", "echoFreeze"]);

/**
 * Was the release in the layer, measured against the clock that layer answers?
 *
 * A newer painted file already drifted to the right clock and its `inside` is
 * the answer. An older one drifted everything to the model hour, so for a
 * measured-edge layer the undrifted distance is the one that meant something —
 * and it is on the file, which is why no repaint is owed for these tables.
 */
function insideByClock(near, key) {
  if (near.clock) return near.inside;
  if (!MEASURED_EDGE.has(key)) return near.inside;
  return near.kmAtRelease === 0;
}

/**
 * Whether a release has an answer for this layer.
 *
 * A layer that painted nothing in the window is an answer — the release is
 * outside it — so `empty` counts. A null is a route that failed, and a failed
 * route is not a miss; `verify.mjs` refuses a season that has one.
 */
function scorable(near) {
  return Boolean(near) && (near.km != null || near.empty === true);
}

/** The distance to the edge, from the same clock `insideByClock` reads. */
function kmByClock(near, key) {
  if (near.clock) return near.km;
  if (!MEASURED_EDGE.has(key)) return near.km;
  return near.kmAtRelease;
}

const TEXAS_KEYS = [
  ["upwind", "Upwind"],
  ["inRain", "In 20 dBZ"],
  ["nearerEdge", "Nearer the edge"],
  ["echoPastFreezing", "Echo top past freezing"],
];

const regions = await regionsOf(SEASON);

/**
 * County boundaries, for the one check in this file that asks nothing of
 * Weatherman: did the release land in the county its own row named?
 *
 * `positions.mjs` prints that share per program. Here it splits the fill
 * overlap by it, which separates a program the layers disagree with from a
 * program whose positions we cannot place — the two look identical in a
 * pooled percentage and are not the same finding. A miss is not a parse
 * error: a release two kilometers over the line is a pilot naming the county
 * they were working.
 */
const counties = new Map(
  JSON.parse(await readFile(COUNTIES, "utf8")).features.map((feature) => [
    feature.properties.BASENAME,
    feature,
  ])
);

/** Null where the row names no county, or one outside the boundary file. */
function inNamedCounty(flare) {
  const shape = counties.get(flare.county);
  if (!shape) return null;
  return inFeature(shape, flare.lon, flare.lat);
}

function pct(n, d) {
  if (!d) return "—";
  return `${((100 * n) / d).toFixed(1)}%`;
}

function cell(inside, n) {
  if (!n) return "—";
  return `${inside}/${n} (${pct(inside, n)})`;
}

/** A storm feature over every located flare; one with no storm reading did not pass. */
function testCell(test, flares) {
  return cell(test?.yes ?? 0, flares);
}

function regionOfPainted(name) {
  if (name.includes("transpecos")) return "transpecos";
  if (name.includes("panhandle")) return "panhandle";
  if (name.includes("stwma")) return "stwma";
  if (name.includes("plains")) return "plains";
  return "wtwma";
}

const evaluable = regions.filter((region) => region.releases);

/**
 * `within` counts releases outside the layer but no further from its edge
 * than their tolerance. They are not inside, and are never added to it.
 */
const emptyLayers = () =>
  Object.fromEntries(
    LAYERS.map(([key]) => [key, { n: 0, inside: 0, within: 0 }])
  );

/**
 * The fills whose painted area answers the coverage question.
 *
 * Each is a single-level mask, so the area of its polygons is the ground it
 * covers. The banded layers are left out: their levels nest or partition, and
 * one number over a ramp would not mean the same thing.
 */
const AREA_FILLS = LAYERS.filter(([key]) =>
  ["target", "echoFreeze"].includes(key)
);

const stats = {};
for (const region of evaluable) {
  stats[region.id] = {
    days: 0,
    flares: [],
    layers: emptyLayers(),
    /** Painted km² per analysis hour, per fill. */
    areas: Object.fromEntries(AREA_FILLS.map(([key]) => [key, []])),
    /** The ground each of those hours was asked about, km². */
    windows: [],
    /**
     * Seeding-opportunity overlap split by whether the release landed in the
     * county its row named. `unplaced` is a row whose county the boundary file
     * does not carry.
     */
    placed: { n: 0, inside: 0 },
    misplaced: { n: 0, inside: 0 },
    unplaced: 0,
    /** How each release's position was printed, and the km its rounding allows. */
    radial: 0,
    positionKm: [],
    dates: [],
  };
}

const files = (await readdir(OUT)).filter(
  (name) => name.startsWith("painted-") && name.endsWith(".json")
);

/** The cell each layer is traced from, km, as the painted files record it. */
const cellKmOf = {};

for (const name of files) {
  const id = regionOfPainted(name);
  const painted = JSON.parse(await readFile(join(OUT, name), "utf8"));
  const flares = (painted.analyses ?? []).flatMap((a) => a.flares);
  const origin = evaluable.find((region) => region.id === id)?.origin;
  stats[id].days += 1;
  stats[id].dates.push(painted.date);
  stats[id].flares.push(...flares);
  for (const [key, km] of Object.entries(painted.cellKm ?? {})) {
    cellKmOf[key] ??= km;
  }
  const askedKm2 = painted.window ? boxAreaKm2(painted.window) : null;
  for (const frame of Object.values(painted.frames ?? {})) {
    if (askedKm2 != null) stats[id].windows.push(askedKm2);
    for (const [key] of AREA_FILLS) {
      const levels = frame[key]?.levels;
      if (!levels) continue;
      stats[id].areas[key].push(
        levels.reduce(
          (sum, level) => sum + polygonsAreaKm2(level.polygons ?? []),
          0
        )
      );
    }
  }
  for (const flare of flares) {
    const positionKm = positionBoundKm(flare, origin);
    stats[id].positionKm.push(positionKm);
    if (radialOf(flare, origin)) stats[id].radial += 1;

    // Every located flare is in every denominator. A flare with no answer for
    // a layer is not inside it.
    const target = flare.near?.target;
    const placed = inNamedCounty(flare);
    if (placed === null) stats[id].unplaced += 1;
    else {
      const bucket = placed ? stats[id].placed : stats[id].misplaced;
      bucket.n += 1;
      if (scorable(target) && insideByClock(target, "target")) {
        bucket.inside += 1;
      }
    }
    for (const [key] of LAYERS) {
      const layer = stats[id].layers[key];
      layer.n += 1;
      const near = flare.near?.[key];
      if (!scorable(near)) continue;
      if (insideByClock(near, key)) {
        layer.inside += 1;
        continue;
      }
      const cellKm = painted.cellKm?.[key];
      const km = kmByClock(near, key);
      if (cellKm != null && km != null && km <= cellKm + positionKm) {
        layer.within += 1;
      }
    }
  }
}

console.log("## Flare overlap with each layer\n");
console.log(
  "Two programs print a position the record cannot pin down. The Rolling" +
    " Plains write a fraction that is sometimes a decimal degree and sometimes" +
    " minutes and never say which, and the two readings of one row lie tens of" +
    " kilometres apart — many cells of any layer here. South Texas and the" +
    " Panhandle write a bearing and a range from a point their reports never" +
    " name. Every position is read exactly as printed and nothing is rewritten," +
    " so where those three score low the row is about the record as much as" +
    " about the layer. `positions.mjs` prints how far that goes.\n"
);
console.log(
  "| Program | Releases | " +
    LAYERS.map(([, label]) => label).join(" | ") +
    " |"
);
console.log("| --- | ---: | " + LAYERS.map(() => "---:").join(" | ") + " |");

const seasonLayers = emptyLayers();
const seasonFlares = [];
for (const region of evaluable) {
  const row = stats[region.id];
  seasonFlares.push(...row.flares);
  for (const [key] of LAYERS) {
    seasonLayers[key].n += row.layers[key].n;
    seasonLayers[key].inside += row.layers[key].inside;
    seasonLayers[key].within += row.layers[key].within;
  }
  console.log(
    `| ${region.short} | ${row.flares.length} | ` +
      LAYERS.map(([key]) =>
        cell(row.layers[key].inside, row.layers[key].n)
      ).join(" | ") +
      " |"
  );
}
console.log(
  `| Season | ${seasonFlares.length} | ` +
    LAYERS.map(([key]) =>
      cell(seasonLayers[key].inside, seasonLayers[key].n)
    ).join(" | ") +
    " |"
);

console.log("\n## Flare overlap within tolerance\n");
console.log(
  "A release outside a layer but no further from its edge than one cell of" +
    " that layer plus the rounding of its printed position. The geometry cannot" +
    " rule it out and cannot place it inside, so it is counted on its own and" +
    " never added to inside. Nothing lowers inside: a painted file stores no" +
    " distance to the edge for a release that landed in the layer."
);

const kmCell = (km) => (km == null ? "—" : `${km.toFixed(2)} km`);

/** Inside, then within tolerance, as shares of the releases a layer answered. */
function toleranceCell(layer) {
  if (!layer.n) return "—";
  return `${pct(layer.inside, layer.n)} + ${pct(layer.within, layer.n)}`;
}

console.log(
  "\n| Program | Releases | Printed as bearing and range | Position rounding, median | Position rounding, max |"
);
console.log("| --- | ---: | ---: | ---: | ---: |");
for (const region of evaluable) {
  const row = stats[region.id];
  console.log(
    `| ${region.short} | ${row.flares.length} | ${row.radial} | ` +
      `${kmCell(median(row.positionKm))} | ` +
      `${kmCell(row.positionKm.length ? Math.max(...row.positionKm) : null)} |`
  );
}

console.log(
  "\n| Layer | Cell | Inside | Within tolerance | Inside or within |"
);
console.log("| --- | ---: | ---: | ---: | ---: |");
for (const [key, label] of LAYERS) {
  const layer = seasonLayers[key];
  console.log(
    `| ${label} | ${cellKmOf[key] ?? "—"} km | ${cell(layer.inside, layer.n)} | ` +
      `${cell(layer.within, layer.n)} | ${cell(layer.inside + layer.within, layer.n)} |`
  );
}

console.log(
  "\n| Program | Releases | " +
    LAYERS.map(([, label]) => `${label}, inside + within`).join(" | ") +
    " |"
);
console.log("| --- | ---: | " + LAYERS.map(() => "---:").join(" | ") + " |");
for (const region of evaluable) {
  const row = stats[region.id];
  console.log(
    `| ${region.short} | ${row.flares.length} | ` +
      LAYERS.map(([key]) => toleranceCell(row.layers[key])).join(" | ") +
      " |"
  );
}
console.log(
  `| Season | ${seasonFlares.length} | ` +
    LAYERS.map(([key]) => toleranceCell(seasonLayers[key])).join(" | ") +
    " |"
);

console.log(
  "\n## Seeding opportunity, split by whether the report placed the flare\n"
);
console.log(
  "A release that missed the county its own row named is a release we cannot" +
    " place, not a release the layer missed. Where the two columns agree, the" +
    " overlap is about the weather; where they do not, it is about the report."
);
console.log(
  "\n| Program | In its named county | Somewhere else | County not in the file |"
);
console.log("| --- | ---: | ---: | ---: |");
for (const region of evaluable) {
  const row = stats[region.id];
  console.log(
    `| ${region.short} | ${cell(row.placed.inside, row.placed.n)} | ` +
      `${cell(row.misplaced.inside, row.misplaced.n)} | ${row.unplaced} |`
  );
}

console.log("\n## Ground each single-level fill painted\n");
console.log(
  "The median painted analysis hour per program, km². The season row adds" +
    " the programs' medians.\n"
);
console.log(
  "| Program | Hours | Ground asked | " +
    AREA_FILLS.map(([, label]) => label).join(" | ") +
    " |"
);
console.log(
  "| --- | ---: | ---: | " + AREA_FILLS.map(() => "---:").join(" | ") + " |"
);

/** Median of an array of numbers, or null when it is empty. */
function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2;
}

const km2 = (n) => (n == null ? "—" : Math.round(n).toLocaleString("en-US"));

/** Median painted area, and what share of the asked ground that is. */
function areaCell(painted, asked) {
  const mid = median(painted);
  if (mid == null) return "—";
  const whole = median(asked);
  if (!whole) return km2(mid);
  return `${km2(mid)} (${pct(mid, whole)})`;
}

for (const region of evaluable) {
  const row = stats[region.id];
  console.log(
    `| ${region.short} | ${row.windows.length} | ${km2(median(row.windows))} | ` +
      AREA_FILLS.map(([key]) => areaCell(row.areas[key], row.windows)).join(
        " | "
      ) +
      " |"
  );
}

/** One median hour from each program, added. */
const acrossPrograms = (pick) =>
  evaluable.reduce(
    (sum, region) => sum + (median(pick(stats[region.id])) ?? 0),
    0
  );
const seasonAsked = acrossPrograms((row) => row.windows);
console.log(
  `| Season | ${evaluable.reduce((sum, region) => sum + stats[region.id].windows.length, 0)} | ` +
    `${km2(seasonAsked)} | ` +
    AREA_FILLS.map(([key]) => {
      const painted = acrossPrograms((row) => row.areas[key]);
      return `${km2(painted)} (${pct(painted, seasonAsked)})`;
    }).join(" | ") +
    " |"
);

console.log("\n## Flare overlap with each Texas selection feature\n");
console.log(
  "| Program | Releases | " +
    TEXAS_KEYS.map(([, label]) => label).join(" | ") +
    " |"
);
console.log(
  "| --- | ---: | " + TEXAS_KEYS.map(() => "---:").join(" | ") + " |"
);
for (const region of evaluable) {
  const tests = Object.fromEntries(
    tallyFlags(stats[region.id].flares).map((t) => [t.key, t])
  );
  console.log(
    `| ${region.short} | ${stats[region.id].flares.length} | ` +
      TEXAS_KEYS.map(([key]) =>
        testCell(tests[key], stats[region.id].flares.length)
      ).join(" | ") +
      " |"
  );
}
const seasonTests = Object.fromEntries(
  tallyFlags(seasonFlares).map((t) => [t.key, t])
);
console.log(
  `| Season | ${seasonFlares.length} | ` +
    TEXAS_KEYS.map(([key]) =>
      testCell(seasonTests[key], seasonFlares.length)
    ).join(" | ") +
    " |"
);

function bandRow(rows) {
  const overlaps = rows.map(bandOverlap).filter(Boolean);
  const summary = summarizeOverlaps(overlaps);
  const freeze = [];
  const top = [];
  // The CCL is scored over every row that carries one, not only the rows with
  // a usable band: it is the cloud-base layer's fallback height, not a band
  // edge, so an ascent whose printed band is unusable can still say whether
  // the fallback was right.
  const ccl = [];
  for (const row of rows) {
    if (row.compared?.ccl?.error != null) ccl.push(row.compared.ccl.error);
    if (!bandOverlap(row)) continue;
    if (row.compared?.freezingLevel?.error != null) {
      freeze.push(row.compared.freezingLevel.error);
    }
    if (row.compared?.minus15Height?.error != null) {
      top.push(row.compared.minus15Height.error);
    }
  }
  return {
    summary,
    freeze: spread(freeze),
    top: spread(top),
    ccl: spread(ccl),
    cclN: ccl.length,
  };
}

/**
 * One height cell, written so it reads without the caption.
 *
 * Two different numbers: how far our height sits from the balloon's on
 * average, then how far a single ascent typically misses regardless of
 * direction. A signed pair like "−21 m / 53 m" cannot say which is which.
 */
function edge(s) {
  if (!s) return "—";
  const bias = Math.round(s.bias);
  const typical = Math.round(s.typical);
  const offset =
    bias === 0 ? "level" : `${Math.abs(bias)} m ${bias > 0 ? "high" : "low"}`;
  return `${offset} · ${typical} m typical`;
}

function overlapCell(summary) {
  if (!summary) return "—";
  return `**${(summary.mean * 100).toFixed(1)}%**`;
}

function cleared(summary) {
  if (!summary) return "—";
  return `${summary.over90} of ${summary.n}`;
}

console.log("\n## The sounding layer against the balloons\n");
console.log(
  "The freezing level and the −15 °C height are what the reports print, so they\nare what can be scored. The seeding band's own edges, −5 and −18 °C, are not\nin the record — this is a check on the column those heights are read off, not\non the band.\n\nEach height cell reads: how far our height sits from the balloon's on average,\nthen the typical miss in either direction. The CCL column is the cloud-base\nlayer's fallback height and is scored over every ascent that prints one, so\nits count can exceed the layer's.\n"
);
console.log(
  "| Program | Ascents | Freezing level | −15 °C height | CCL | Layer overlap | Cleared 90% |"
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");

const byKey = new Map();
for (const region of evaluable) {
  const name = region.runs?.balloons;
  if (!name) continue;
  let data;
  try {
    data = JSON.parse(await readFile(join(OUT, name), "utf8"));
  } catch {
    continue;
  }
  const { summary, freeze, top, ccl } = bandRow(data.rows ?? []);
  console.log(
    `| ${region.short} | ${summary?.n ?? 0} | ${edge(freeze)} | ${edge(top)} | ${edge(ccl)} | ${overlapCell(summary)} | ${cleared(summary)} |`
  );
  for (const row of data.rows ?? []) {
    const key = `${row.date} ${row.site}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
}

const distinct = bandRow([...byKey.values()]);
if (distinct.summary) {
  console.log(
    `\n${distinct.summary.n} distinct scored ascents · median depth ${distinct.summary.medianDepth} m · mean overlap ${(distinct.summary.mean * 100).toFixed(1)}% · worst ${(distinct.summary.worst * 100).toFixed(1)}% · cleared 80% ${distinct.summary.over80} of ${distinct.summary.n}` +
      (distinct.ccl
        ? `\nCCL over ${distinct.cclN} distinct ascents · ${edge(distinct.ccl)} · the cloud-base layer's fallback height, against the instrument`
        : "")
  );
} else {
  console.log("no balloon comparison on disk");
}

/**
 * The fly rule's criteria, asked of each release's own cell.
 *
 * Read off `cell`, the click readout `paint.mjs` stored from
 * `/candidate/point`, so these are the answers the product gave, not a
 * re-derivation. Every located flare is in every denominator, and a flare with
 * no click readout passes nothing. The verdict charges a cell to the first test
 * it fails — base, then rain, then payload — so rain is only asked of a cell
 * whose base passed, and row 2 is the two together. The two payload halves come
 * from `payload`, which the server asks of every cell whatever the verdict.
 *
 * A release is an ice flare when its row logs glaciogenic and a salt flare
 * when it logs hygroscopic; a row logging both is in both columns.
 */
const BASE_FAILS = new Set(["noCloudBase", "baseTooHigh"]);
const supportsIce = (flare) =>
  flare.cell?.payload === "ice" || flare.cell?.payload === "both";
const supportsSalt = (flare) =>
  flare.cell?.payload === "salt" || flare.cell?.payload === "both";
const baseOk = (flare) =>
  Boolean(flare.cell) && !BASE_FAILS.has(flare.cell.target);
const flies = (flare) => flare.cell?.target === "target";

const criteriaColumns = [
  {
    label: "Ice flares",
    flares: seasonFlares.filter(
      (flare) => flare.payload === "glaciogenic" || flare.payload === "both"
    ),
    own: supportsIce,
  },
  {
    label: "Salt flares",
    flares: seasonFlares.filter(
      (flare) => flare.payload === "hygroscopic" || flare.payload === "both"
    ),
    own: supportsSalt,
  },
  {
    label: "Type not logged",
    flares: seasonFlares.filter((flare) => flare.payload == null),
    own: null,
  },
  { label: "All flares", flares: seasonFlares, own: null },
];

const CRITERIA = [
  ["1. Cloud base under 18,000 ft MSL", baseOk],
  [
    "2. Base passes and rain at 20 dBZ within a cell",
    (flare) => baseOk(flare) && flare.cell.target !== "noStorm",
  ],
  ["3a. Echo top at or above freezing within a cell (ice)", supportsIce],
  ["3b. Base below the freezing level (salt)", supportsSalt],
  ["FLY", flies],
];

console.log("\n## The fly criteria at each release\n");
console.log(
  "| Criterion | " +
    criteriaColumns
      .map((column) => `${column.label} (${column.flares.length})`)
      .join(" | ") +
    " |"
);
console.log("| --- | " + criteriaColumns.map(() => "---:").join(" | ") + " |");
for (const [label, passes] of CRITERIA) {
  console.log(
    `| ${label} | ` +
      criteriaColumns
        .map((column) =>
          cell(column.flares.filter(passes).length, column.flares.length)
        )
        .join(" | ") +
      " |"
  );
}
console.log(
  "| FLY, for the flare that was flown | " +
    criteriaColumns
      .map((column) =>
        column.own
          ? cell(
              column.flares.filter((flare) => flies(flare) && column.own(flare))
                .length,
              column.flares.length
            )
          : "—"
      )
      .join(" | ") +
    " |"
);

const seasonDates = evaluable
  .flatMap((region) => stats[region.id].dates)
  .sort();
console.log("\n## The season\n");
console.log("| The season | |");
console.log("| --- | ---: |");
console.log(`| Flying days painted | ${files.length} |`);
console.log(`| First / last | ${seasonDates[0]} / ${seasonDates.at(-1)} |`);
console.log(`| Located flares | ${seasonFlares.length} |`);
console.log(
  `| Flares a click answered | ${seasonFlares.filter((flare) => flare.cell).length} |`
);
console.log(
  `| Flares standing in a 20 dBZ storm object | ${seasonFlares.filter((flare) => flare.storm).length} |`
);
console.log(
  `| Programs | ${evaluable.filter((region) => stats[region.id].flares.length).length} |`
);
console.log(`| Balloon ascents, band scored | ${distinct.summary?.n ?? 0} |`);
console.log(`| Balloon ascents, CCL scored | ${distinct.cclN} |`);
