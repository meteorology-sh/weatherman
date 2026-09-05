/**
 * Print the EVALUATION.md tables from files already in eval/out.
 *
 * `node eval/score-season.mjs` — no server. Layer overlap and Texas
 * features come from the painted days. Band overlap is calculated from
 * the balloon JSON. Shared Midland and Del Rio mornings are counted
 * once in the season band table.
 */

// Node
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import {
  bandOverlap,
  spread,
  summariseOverlaps,
} from "./lib/band-score.mjs";
import { tallyFlags } from "./lib/storm-score.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");

const LAYERS = [
  ["cloudBase", "Cloud base"],
  ["cloudTop", "Cloud tops"],
  ["radar", "Radar reflectivity"],
  ["liquid", "Supercooled liquid water"],
  ["candidate", "Seeding opportunity"],
];

const TEXAS_KEYS = [
  ["upwind", "Upwind"],
  ["inRain", "In 20 dBZ"],
  ["nearerEdge", "Nearer the edge"],
  ["echoPastFreezing", "Echo top past freezing"],
];

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);

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
  Object.fromEntries(LAYERS.map(([key]) => [key, { n: 0, inside: 0 }]));

const stats = {};
for (const region of evaluable) {
  stats[region.id] = { days: 0, flares: [], layers: emptyLayers() };
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
  for (const flare of flares) {
    for (const [key] of LAYERS) {
      const near = flare.near?.[key];
      if (!near || near.km == null) continue;
      stats[id].layers[key].n += 1;
      if (near.inside) stats[id].layers[key].inside += 1;
    }
  }
}

console.log("## Flare overlap with each original Weatherman layer\n");
console.log(
  "| Programme | Releases | " +
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

console.log("\n## Flare overlap with each Texas selection feature\n");
console.log(
  "| Programme | Releases | " +
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
  const summary = summariseOverlaps(overlaps);
  const freeze = [];
  const top = [];
  for (const row of rows) {
    if (!bandOverlap(row)) continue;
    if (row.compared?.freezingLevel?.error != null) {
      freeze.push(row.compared.freezingLevel.error);
    }
    if (row.compared?.minus15Height?.error != null) {
      top.push(row.compared.minus15Height.error);
    }
  }
  return { summary, freeze: spread(freeze), top: spread(top) };
}

function edge(s) {
  if (!s) return "—";
  const bias = Math.round(s.bias);
  const typical = Math.round(s.typical);
  return `${bias > 0 ? "+" : ""}${bias} m / ${typical} m`;
}

function overlapCell(summary) {
  if (!summary) return "—";
  return `**${(summary.median * 100).toFixed(1)}%**`;
}

function cleared(summary) {
  if (!summary) return "—";
  return `${summary.over90} of ${summary.n}`;
}

console.log("\n## The seeding band against the balloons\n");
console.log(
  "| Programme | Ascents | Freezing level | −15 °C height | Band overlap | Cleared 90% |"
);
console.log("| --- | ---: | ---: | ---: | ---: | ---: |");

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
  const { summary, freeze, top } = bandRow(data.rows ?? []);
  console.log(
    `| ${region.short} | ${summary?.n ?? 0} | ${edge(freeze)} | ${edge(top)} | ${overlapCell(summary)} | ${cleared(summary)} |`
  );
  for (const row of data.rows ?? []) {
    const key = `${row.date} ${row.site}`;
    if (!byKey.has(key)) byKey.set(key, row);
  }
}

const distinct = bandRow([...byKey.values()]);
if (distinct.summary) {
  console.log(
    `\n${distinct.summary.n} distinct scored ascents · median depth ${distinct.summary.medianDepth} m · mean overlap ${(distinct.summary.mean * 100).toFixed(1)}% · worst ${(distinct.summary.worst * 100).toFixed(1)}% · cleared 80% ${distinct.summary.over80} of ${distinct.summary.n}`
  );
} else {
  console.log("no balloon comparison on disk");
}
