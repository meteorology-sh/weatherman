/**
 * Print the EVALUATION.md tables from files already in eval/out.
 *
 * `node eval/score-season.mjs` — no server. Layer overlap and Texas storm
 * features come from the painted days. Band overlap is
 * calculated from the balloon JSON. Shared Midland and Del Rio mornings
 * are counted once in the season band table.
 *
 * Every overlap is also read against a tolerance: one cell of the layer plus
 * the rounding of the printed position (`lib/tolerance.mjs`). A release
 * outside the layer but within it is printed on its own line, never added to
 * inside.
 */

// Node
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { bandOverlap, spread, summarizeOverlaps } from "./lib/band-score.mjs";
import { boxAreaKm2, inFeature, polygonsAreaKm2 } from "./lib/geo.mjs";
import { tallyFlags } from "./lib/storm-score.mjs";
import { positionBoundKm, radialOf } from "./lib/tolerance.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");

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
const MEASURED_EDGE = new Set([
  "cloudBase",
  "radar",
  "target",
  "echoFreeze",
]);

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

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);

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
  JSON.parse(
    await readFile(join(DATA, "counties-tx.geojson"), "utf8")
  ).features.map((feature) => [feature.properties.BASENAME, feature])
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

function testCell(test) {
  if (!test || !test.n) return "—";
  return cell(test.yes, test.n);
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
    LAYERS.map(([key]) => [
      key,
      { n: 0, inside: 0, within: 0 },
    ])
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
  const origin = evaluable.find((region) => region.id === id)?.origin?.at;
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

    const near = flare.near?.target;
    if (near && near.km != null) {
      const placed = inNamedCounty(flare);
      if (placed === null) stats[id].unplaced += 1;
      else {
        const bucket = placed ? stats[id].placed : stats[id].misplaced;
        bucket.n += 1;
        if (insideByClock(near, "target")) bucket.inside += 1;
      }
    }
    for (const [key] of LAYERS) {
      const near = flare.near?.[key];
      if (!near || near.km == null) continue;
      const layer = stats[id].layers[key];
      layer.n += 1;
      if (insideByClock(near, key)) {
        layer.inside += 1;
        continue;
      }
      const cellKm = painted.cellKm?.[key];
      if (cellKm != null && kmByClock(near, key) <= cellKm + positionKm) {
        layer.within += 1;
      }
    }
  }
}

console.log("## Flare overlap with each layer\n");
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

console.log("\n| Layer | Cell | Inside | Within tolerance | Inside or within |");
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
      TEXAS_KEYS.map(([key]) => testCell(tests[key])).join(" | ") +
      " |"
  );
}
const seasonTests = Object.fromEntries(
  tallyFlags(seasonFlares).map((t) => [t.key, t])
);
console.log(
  `| Season | ${seasonFlares.length} | ` +
    TEXAS_KEYS.map(([key]) => testCell(seasonTests[key])).join(" | ") +
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

function edge(s) {
  if (!s) return "—";
  const bias = Math.round(s.bias);
  const typical = Math.round(s.typical);
  return `${bias > 0 ? "+" : ""}${bias} m / ${typical} m`;
}

function overlapCell(summary) {
  if (!summary) return "—";
  return `**${(summary.mean * 100).toFixed(1)}%**`;
}

function cleared(summary) {
  if (!summary) return "—";
  return `${summary.over90} of ${summary.n}`;
}

console.log("\n## The seeding band against the balloons\n");
console.log(
  "Each cell is bias / typical miss. The CCL column is the cloud-base layer's\nfallback height and is scored over every ascent that prints one, so its\ncount can exceed the band's.\n"
);
console.log(
  "| Program | Ascents | Freezing level | −15 °C height | CCL | Band overlap | Cleared 90% |"
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
 * re-derivation. The verdict charges a cell to the first test it fails — base,
 * then rain, then payload — so rain is only answered for a cell whose base
 * passed. The two payload halves come from `payload`, which the server asks of
 * every cell whatever the verdict.
 *
 * A release is an ice flare when its row logs glaciogenic and a salt flare
 * when it logs hygroscopic; a row logging both is in both columns.
 */
const BASE_FAILS = new Set(["noCloudBase", "baseTooHigh"]);
const supportsIce = (cell) => cell.payload === "ice" || cell.payload === "both";
const supportsSalt = (cell) =>
  cell.payload === "salt" || cell.payload === "both";

const answered = seasonFlares.filter((flare) => flare.cell);
const criteriaColumns = [
  {
    label: "Ice flares",
    flares: answered.filter(
      (flare) => flare.payload === "glaciogenic" || flare.payload === "both"
    ),
    own: supportsIce,
  },
  {
    label: "Salt flares",
    flares: answered.filter(
      (flare) => flare.payload === "hygroscopic" || flare.payload === "both"
    ),
    own: supportsSalt,
  },
  {
    label: "Type not logged",
    flares: answered.filter((flare) => flare.payload == null),
    own: null,
  },
  { label: "All answered", flares: answered, own: null },
];

const baseOk = (flare) => !BASE_FAILS.has(flare.cell.target);
const CRITERIA = [
  ["1. Cloud base under 18,000 ft MSL", (flares) => [flares.filter(baseOk).length, flares.length]],
  [
    "2. Rain at 20 dBZ within a cell, of those passing 1",
    (flares) => {
      const reached = flares.filter(baseOk);
      return [
        reached.filter((flare) => flare.cell.target !== "noStorm").length,
        reached.length,
      ];
    },
  ],
  [
    "3a. Echo top at or above freezing within a cell (ice)",
    (flares) => [flares.filter((flare) => supportsIce(flare.cell)).length, flares.length],
  ],
  [
    "3b. Base below the freezing level (salt)",
    (flares) => [flares.filter((flare) => supportsSalt(flare.cell)).length, flares.length],
  ],
  ["FLY", (flares) => [flares.filter((flare) => flare.cell.target === "target").length, flares.length]],
];

console.log("\n## The fly criteria at each release\n");
console.log(
  "| Criterion | " + criteriaColumns.map((column) => `${column.label} (${column.flares.length})`).join(" | ") + " |"
);
console.log("| --- | " + criteriaColumns.map(() => "---:").join(" | ") + " |");
for (const [label, score] of CRITERIA) {
  console.log(
    `| ${label} | ` +
      criteriaColumns.map((column) => cell(...score(column.flares))).join(" | ") +
      " |"
  );
}
console.log(
  "| FLY, for the flare that was flown | " +
    criteriaColumns
      .map((column) =>
        column.own
          ? cell(
              column.flares.filter(
                (flare) => flare.cell.target === "target" && column.own(flare.cell)
              ).length,
              column.flares.length
            )
          : "—"
      )
      .join(" | ") +
    " |"
);

const seasonDates = evaluable.flatMap((region) => stats[region.id].dates).sort();
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
