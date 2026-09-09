/**
 * Print the EVALUATION.md tables from files already in eval/out.
 *
 * `node eval/score-season.mjs` — no server. Layer overlap, Texas fills,
 * and Texas storm features come from the painted days. Band overlap is
 * calculated from the balloon JSON. Shared Midland and Del Rio mornings
 * are counted once in the season band table.
 */

// Node
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { bandOverlap, spread, summarizeOverlaps } from "./lib/band-score.mjs";
import { boxAreaKm2, inFeature, polygonsAreaKm2 } from "./lib/geo.mjs";
import { tallyFlags } from "./lib/storm-score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");

const LAYERS = [
  ["cloudBase", "Cloud base"],
  ["cloudTop", "Cloud tops"],
  ["radar", "Radar reflectivity"],
  ["liquid", "Supercooled liquid water"],
  ["candidate", "Candidate supercooled liquid"],
];

const TEXAS_FILLS = [
  ["target", "Seeding opportunity"],
  ["baseWindow", "Base window"],
  ["echoFreeze", "Echo past freezing"],
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
  "cloudTop",
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

const emptyLayers = () =>
  Object.fromEntries(
    [...LAYERS, ...TEXAS_FILLS].map(([key]) => [key, { n: 0, inside: 0 }])
  );

/**
 * The three fills whose painted area answers the coverage question.
 *
 * Each is a single-level mask, so the area of its polygons is the ground it
 * covers. The banded layers are left out: their levels nest or partition, and
 * one number over a ramp would not mean the same thing.
 */
const AREA_FILLS = TEXAS_FILLS;

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
  };
}

const files = (await readdir(OUT)).filter(
  (name) => name.startsWith("painted-") && name.endsWith(".json")
);

for (const name of files) {
  const id = regionOfPainted(name);
  const painted = JSON.parse(await readFile(join(OUT, name), "utf8"));
  const flares = (painted.analyses ?? []).flatMap((a) => a.flares);
  stats[id].days += 1;
  stats[id].flares.push(...flares);
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
    for (const [key] of [...LAYERS, ...TEXAS_FILLS]) {
      const near = flare.near?.[key];
      if (!near || near.km == null) continue;
      stats[id].layers[key].n += 1;
      if (insideByClock(near, key)) stats[id].layers[key].inside += 1;
    }
  }
}

console.log("## Flare overlap with each original Weatherman layer\n");
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
  for (const [key] of [...LAYERS, ...TEXAS_FILLS]) {
    seasonLayers[key].n += row.layers[key].n;
    seasonLayers[key].inside += row.layers[key].inside;
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

console.log("\n## Flare overlap with each Texas fill\n");
console.log(
  "| Program | Releases | " +
    TEXAS_FILLS.map(([, label]) => label).join(" | ") +
    " |"
);
console.log(
  "| --- | ---: | " + TEXAS_FILLS.map(() => "---:").join(" | ") + " |"
);
for (const region of evaluable) {
  const row = stats[region.id];
  console.log(
    `| ${region.short} | ${row.flares.length} | ` +
      TEXAS_FILLS.map(([key]) =>
        cell(row.layers[key].inside, row.layers[key].n)
      ).join(" | ") +
      " |"
  );
}
console.log(
  `| Season | ${seasonFlares.length} | ` +
    TEXAS_FILLS.map(([key]) =>
      cell(seasonLayers[key].inside, seasonLayers[key].n)
    ).join(" | ") +
    " |"
);

console.log("\n## Seeding opportunity, split by whether the report placed the flare\n");
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

console.log("\n## Ground each Texas fill painted\n");
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
