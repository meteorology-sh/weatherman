/**
 * The county polygons the target-area figures are clipped to.
 *
 * `node eval/counties.mjs` — reads which counties appear in any program's
 * release list, pulls each one's boundary from Census TIGERweb as GeoJSON,
 * writes `eval/data/counties-tx.geojson`.
 *
 * Counties are the unit because the reports are written in counties. The
 * permit boundaries are a different shape and some of these counties sit under
 * other operators' permits; that is a refinement, not this file's job.
 */

// Node
import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");

const TIGERWEB =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb" +
  "/State_County/MapServer/1/query";

/** Texas. TIGERweb keys states by FIPS, and `BASENAME` is the bare name. */
const TEXAS = "48";

async function county(name) {
  const url = new URL(TIGERWEB);
  url.searchParams.set("where", `STATE='${TEXAS}' AND BASENAME='${name}'`);
  url.searchParams.set("outFields", "BASENAME,GEOID");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("f", "geojson");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`${name}: ${res.status}`);

  const body = await res.json();
  if (!body.features?.length) throw new Error(`${name}: no such county`);
  if (body.features.length > 1)
    throw new Error(`${name}: ${body.features.length} matches`);

  return body.features[0];
}

/**
 * Every county any program's flight record names.
 *
 * One file for all of them rather than one per region: the counties overlap —
 * West Texas and Trans-Pecos both fly Pecos, Crane, Crockett, Terrell and Upton
 * — and the map draws whichever region is open out of the same collection.
 */
const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);

const names = new Set();
for (const region of regions.filter((entry) => entry.releases)) {
  const { days } = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );
  for (const day of days) {
    for (const release of day.releases) {
      if (release.county) names.add(release.county);
    }
  }
}

const features = [];
for (const name of [...names].sort()) {
  features.push(await county(name));
  process.stdout.write(`${name}\n`);
}

await writeFile(
  join(DATA, "counties-tx.geojson"),
  `${JSON.stringify({ type: "FeatureCollection", features })}\n`
);

console.log(`\n${features.length} counties written`);
