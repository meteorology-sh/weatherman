/**
 * Does each release sit in the county its own row names?
 *
 * `node eval/positions.mjs` — reads every parsed flight record and the
 * county boundaries, and prints the share of releases whose position falls
 * inside the county on the same line of the report.
 *
 * **It exists to calibrate the Panhandle.** West Texas and Trans-Pecos print a
 * latitude and a longitude, so their agreement is how often an
 * operator's county label and an operator's coordinates disagree at all — the
 * floor any projected position has to be read against. The Panhandle prints a bearing and a range off an origin the
 * reports never name, so its agreement is a measurement of the projection, and
 * it means nothing without the other two to read it against.
 *
 * A miss is not a parse error. A release two kilometres inside the next county
 * is a pilot naming the county they were working, and both numbers are the
 * operator's.
 */

// Node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);
const boundaries = JSON.parse(
  await readFile(join(DATA, "counties-tx.geojson"), "utf8")
);

const county = new Map(
  boundaries.features.map((feature) => [feature.properties.BASENAME, feature])
);

/** Ray casting. The rings are Census county boundaries, so they are simple. */
function inRing(ring, x, y) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function contains(feature, lon, lat) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === "Polygon" ? [coordinates] : coordinates;
  return polygons.some(
    (polygon) =>
      inRing(polygon[0], lon, lat) &&
      !polygon.slice(1).some((hole) => inRing(hole, lon, lat))
  );
}

for (const region of regions.filter((entry) => entry.releases)) {
  const { days } = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );

  let inside = 0;
  let outside = 0;
  let unknown = 0;

  for (const day of days) {
    for (const release of day.releases) {
      if (!release.located || !release.county) continue;
      const shape = county.get(release.county);
      if (!shape) {
        unknown += 1;
        continue;
      }
      if (contains(shape, release.lon, release.lat)) inside += 1;
      else outside += 1;
    }
  }

  const scored = inside + outside;
  console.log(
    `${region.id.padEnd(11)} ${String(inside).padStart(4)}/${scored} ` +
      `${((inside / scored) * 100).toFixed(1)}% in the county the row names` +
      (region.origin ? `  (projected from ${region.origin.name})` : "") +
      (unknown ? `  ${unknown} counties with no boundary` : "")
  );
}
