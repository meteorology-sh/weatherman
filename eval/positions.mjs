/**
 * Does each release sit in the county its own row names?
 *
 * `node eval/positions.mjs` — reads every parsed flight record and the
 * county boundaries, and prints the share of releases whose position falls
 * inside the county on the same line of the report.
 *
 * **It exists to calibrate the radial programs.** West Texas and Trans-Pecos
 * print a latitude and a longitude, so their agreement is how often an
 * operator's county label and an operator's coordinates disagree at all — the
 * floor any projected position has to be read against. The Panhandle and
 * South Texas print a bearing and a range off an origin the reports never
 * name, so their agreement is a measurement of the projection, and it means
 * nothing without the other two to read it against.
 *
 * **For a radial program it also asks which way the misses lean.** A bearing
 * read against the wrong north turns every release by the same angle, so the
 * releases that miss their county are reached by turning one way far more
 * often than the other. Against the right north a miss is a pilot naming the
 * county they were working, and has no preferred direction. It prints that
 * split with a two-sided sign test, and the further turn that would place the
 * most releases, both with the region's `magneticVariationDeg` already applied.
 *
 * A miss is not a parse error. A release two kilometers inside the next county
 * is a pilot naming the county they were working, and both numbers are the
 * operator's.
 */

// Node
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Local
import { inFeature, projectRadial } from "./lib/geo.mjs";
import { radialOf } from "./lib/tolerance.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA = join(HERE, "data");

/** How far either way a miss is turned looking for its county, degrees. */
const TURN_LIMIT = 30;
const TURN_STEP = 0.5;

const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);
const boundaries = JSON.parse(
  await readFile(join(DATA, "counties-tx.geojson"), "utf8")
);

const county = new Map(
  boundaries.features.map((feature) => [feature.properties.BASENAME, feature])
);

/** Where a printed radial lands with a further turn on top of the variation. */
function turned(origin, radial, turnDeg) {
  const [lat, lon] = projectRadial(
    origin,
    radial.bearingDeg + turnDeg,
    radial.rangeNm
  );
  return { lat, lon };
}

/** The smallest turn, either way, that puts a release in its county. */
function turnToCounty(origin, radial, shape) {
  for (let turn = TURN_STEP; turn <= TURN_LIMIT; turn += TURN_STEP) {
    for (const signed of [turn, -turn]) {
      const at = turned(origin, radial, signed);
      if (inFeature(shape, at.lon, at.lat)) return signed;
    }
  }
  return null;
}

/** Two-sided exact binomial sign test at p = 1/2. */
function signTest(a, b) {
  const n = a + b;
  if (!n) return 1;
  const logChoose = (k) => {
    let sum = 0;
    for (let i = 1; i <= k; i++) sum += Math.log(n - k + i) - Math.log(i);
    return sum;
  };
  let tail = 0;
  for (let k = Math.max(a, b); k <= n; k++) {
    tail += Math.exp(logChoose(k) - n * Math.LN2);
  }
  return Math.min(1, 2 * tail);
}

for (const region of regions.filter((entry) => entry.releases)) {
  const { days } = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );

  let inside = 0;
  let outside = 0;
  let unknown = 0;
  const radials = [];

  for (const day of days) {
    for (const release of day.releases) {
      if (!release.located || !release.county) continue;
      const shape = county.get(release.county);
      if (!shape) {
        unknown += 1;
        continue;
      }
      const placed = inFeature(shape, release.lon, release.lat);
      if (placed) inside += 1;
      else outside += 1;
      const radial = radialOf(release, region.origin);
      if (radial) radials.push({ radial, shape, placed });
    }
  }

  const scored = inside + outside;
  const variation = region.origin?.magneticVariationDeg;
  console.log(
    `${region.id.padEnd(11)} ${String(inside).padStart(4)}/${scored} ` +
      `${((inside / scored) * 100).toFixed(1)}% in the county the row names` +
      (region.origin ? `  (projected from ${region.origin.name}` : "") +
      (region.origin && variation != null ? `, ${variation}°E variation` : "") +
      (region.origin ? ")" : "") +
      (unknown ? `  ${unknown} counties with no boundary` : "")
  );

  if (!radials.length) continue;

  let clockwise = 0;
  let counter = 0;
  let unreached = 0;
  for (const { radial, shape, placed } of radials) {
    if (placed) continue;
    const turn = turnToCounty(region.origin, radial, shape);
    if (turn === null) unreached += 1;
    else if (turn > 0) clockwise += 1;
    else counter += 1;
  }

  let best = { turn: 0, placed: -1 };
  for (let turn = -10; turn <= 10; turn += 1) {
    let placed = 0;
    for (const { radial, shape } of radials) {
      const at = turned(region.origin, radial, turn);
      if (inFeature(shape, at.lon, at.lat)) placed += 1;
    }
    if (
      placed > best.placed ||
      (placed === best.placed && Math.abs(turn) < Math.abs(best.turn))
    ) {
      best = { turn, placed };
    }
  }

  console.log(
    `${"".padEnd(11)} ${radials.length} radial rows; misses reached turning ` +
      `clockwise ${clockwise}, counter-clockwise ${counter}, ` +
      `neither within ${TURN_LIMIT}° ${unreached}; ` +
      `sign test p = ${signTest(clockwise, counter).toPrecision(2)}; ` +
      `a further ${best.turn > 0 ? "+" : ""}${best.turn}° places the most ` +
      `(${best.placed}/${radials.length})`
  );
}
