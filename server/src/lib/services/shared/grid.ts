/**
 * The 12 km grid every layer here is contoured on, and the averaging onto it.
 *
 * Shared infrastructure with no source of its own, like `contour.ts` and
 * `grib.ts`: it knows HRRR's grid dimensions and nothing else about HRRR. Both
 * weather services block-average onto a 12 km cell, and the rule that makes
 * that honest — **averaging removes structure, it never invents any**
 * (`MEASUREMENTS.md` §3) — is enforced here rather than restated in each caller.
 *
 * Everything in this file is pure array or text maths, so it is testable on
 * grids you can read.
 */

// Types
import type { Grid, Geo } from "./contour";

/** HRRR CONUS is a fixed Lambert grid; these never change between runs. */
export const NX = 1799;
export const NY = 1059;
export const POINTS = NX * NY;

/** 3 km -> 12 km. Block-averaging removes structure; it never invents it. */
export const BLOCK = 4;

/** Ground covered by one block-averaged cell, km^2. */
export const CELL_KM2 = (BLOCK * 3) ** 2;

/** `grib_get_data -m` prints this where the record has no value. */
export const MISSING = 9999;

/**
 * Where a block has no sampled points at all.
 *
 * NaN rather than a number, because there is no number here that is not a
 * plausible height. It is also what every consumer already wants: marching
 * squares thresholds with `>=`, which is false for NaN, so nothing is drawn
 * where there is no cloud — real nodata, the same the cloud-top layer has.
 */
export const NO_VALUE = Number.NaN;

/**
 * Block-average a full-resolution field to the 12 km contour grid.
 *
 * Mean rather than max on purpose. Precipitation is the awkward case: it covers
 * ~2% of the domain, so a lone 3 km core is diluted 16x by a mean, and a max
 * would keep its peak. Measured against the 3 km truth for a real f12 frame,
 * the mean conserves total water to 0.3% and overstates the >=7.6 mm/hr area by
 * 10%, while the max inflates that area 3.6x and total water 3.7x. The crushed
 * peak (235 -> 72 mm/hr) costs nothing because the top contour is 7.6 and both
 * agree the cell is heavy.
 */
export function blockAverage(
  values: Float32Array,
  scale: number,
  nx = NX,
  ny = NY
): Grid {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const out = new Float32Array(ox * oy);

  for (let bj = 0; bj < oy; bj++) {
    for (let bi = 0; bi < ox; bi++) {
      let sum = 0;
      for (let dj = 0; dj < BLOCK; dj++) {
        const row = (bj * BLOCK + dj) * nx + bi * BLOCK;
        for (let di = 0; di < BLOCK; di++) sum += values[row + di];
      }
      out[bj * ox + bi] = (sum / (BLOCK * BLOCK)) * scale;
    }
  }
  return { nx: ox, ny: oy, values: out };
}

/**
 * Block-average a field that has real nodata in it.
 *
 * `blockAverage` above is the right tool for a field that is defined
 * everywhere; this one is for the `wrfsfc` diagnostics, where "no cloud here"
 * is an answer rather than a gap. Two rules make it honest:
 *
 * - **Missing points never enter the mean.** Averaging a sentinel in would put
 *   a cloud base halfway to the sentinel wherever cloud met clear sky.
 * - **A cell needs a majority of real points to have a value at all**, which is
 *   the same rule the cloud-top layer resamples the satellite with. The
 *   alternative — one sampled point makes the cell — paints a solid 12 km base
 *   over a scatter of cumulus, which is not a target a drone is sent to.
 *
 * `missing` is null for a field with no sentinel, where every point is real and
 * the majority rule can never bite.
 */
export function blockAverageSparse(
  values: Float32Array,
  scale: number,
  missing: number | null,
  nx = NX,
  ny = NY
): Grid {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const out = new Float32Array(ox * oy);
  const points = BLOCK * BLOCK;

  for (let bj = 0; bj < oy; bj++) {
    for (let bi = 0; bi < ox; bi++) {
      let sum = 0;
      let seen = 0;
      for (let dj = 0; dj < BLOCK; dj++) {
        const row = (bj * BLOCK + dj) * nx + bi * BLOCK;
        for (let di = 0; di < BLOCK; di++) {
          const v = values[row + di];
          if (missing !== null && v === missing) continue;
          sum += v;
          seen++;
        }
      }
      out[bj * ox + bi] = seen * 2 > points ? (sum / seen) * scale : NO_VALUE;
    }
  }
  return { nx: ox, ny: oy, values: out };
}

/**
 * A point the grid does not cover.
 *
 * Its own class so a router can tell it apart from a failure. Asking about
 * somewhere the model does not reach is a fair question with the answer "not
 * here", and answering it with a 500 tells an operator the server broke when
 * nothing did.
 */
export class OutsideDomain extends Error {
  constructor(lat: number, lon: number) {
    super(`No HRRR data at ${lat}, ${lon} — the domain is CONUS`);
    this.name = "OutsideDomain";
  }
}

/**
 * Refuse a point the grid cannot cover, before anything is built.
 *
 * A cheap bounding box, and deliberately generous: it exists to reject a click
 * on Hawaii without paying for a 40 s decode first, not to trace the domain.
 * The grid is a Lambert quadrilateral and this is a lat/lon rectangle, so the
 * corners of the box lie outside the grid — {@link inGrid} is what actually
 * decides, once there is a grid to decide against.
 */
export function assertInDomain(lat: number, lon: number) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    throw new Error("A map point needs a numeric lat and lon");
  }
  if (lat < 21 || lat > 53 || lon < -135 || lon > -60) {
    throw new OutsideDomain(lat, lon);
  }
}

/** Ground covered by one block-averaged cell along one side, km. */
const CELL_KM = BLOCK * 3;

/**
 * The farthest a point inside the grid can be from the nearest cell centre:
 * half a cell's diagonal. Beyond it the point is outside the grid, however
 * close the edge cell happens to be.
 */
export const SNAP_KM = (CELL_KM / 2) * Math.SQRT2;

/** Degrees to km on the ground. The grid is 12 km, so flat earth is exact enough. */
function separationKm(
  lat: number,
  lon: number,
  toLat: number,
  toLon: number
): number {
  const dy = toLat - lat;
  const dx = (toLon - lon) * Math.cos((lat * Math.PI) / 180);
  return Math.hypot(dy, dx) * 111.32;
}

/**
 * Whether the grid actually covers a point.
 *
 * `nearestCell` always returns a cell, so it reports Kansas for a click on
 * Hudson Bay unless something asks how far away that cell was. Inside the grid
 * the answer is at most half a cell's diagonal; anything farther is a click off
 * the edge of the model, and it is the only test that follows the Lambert
 * boundary without doing any projection maths.
 */
export function inGrid(geo: Geo, lat: number, lon: number): boolean {
  const cell = nearestCell(geo, lat, lon);
  return separationKm(lat, lon, geo.lats[cell], geo.lons[cell]) <= SNAP_KM;
}

/**
 * The grid's outer edge as a closed ring of [lon, lat], for drawing.
 *
 * The four edges walked in order — south, east, north, west — from the cells
 * themselves, so the ring bends the way the Lambert grid does and nothing here
 * knows what a Lambert projection is. `step` thins the walk: the boundary is
 * smooth at 12 km, so every fourth cell draws the same line for a quarter of
 * the coordinates. Each edge stops one short of its far corner, which is the
 * next edge's first point, so every corner appears exactly once.
 */
export function perimeter(geo: Geo, step = 4): [number, number][] {
  const { nx, ny } = geo;
  const at = (i: number, j: number): [number, number] => {
    const k = j * nx + i;
    return [
      Math.round(geo.lons[k] * 10000) / 10000,
      Math.round(geo.lats[k] * 10000) / 10000,
    ];
  };

  const ring: [number, number][] = [];
  const walk = (n: number, pick: (t: number) => [number, number]) => {
    for (let t = 0; t < n - 1; t += step) ring.push(pick(t));
  };

  walk(nx, (i) => at(i, 0));
  walk(ny, (j) => at(nx - 1, j));
  walk(nx, (i) => at(nx - 1 - i, ny - 1));
  walk(ny, (j) => at(0, ny - 1 - j));
  ring.push(ring[0]);
  return ring;
}

/**
 * Index of the grid cell nearest a point.
 *
 * A plain scan of the 12 km grid — 118k cells, well under a millisecond, and it
 * needs no assumption about how the Lambert projection lays out. Longitude is
 * scaled by cos(lat) so "nearest" means nearest on the ground rather than
 * nearest in degrees, which at 45 N would be 40% wrong east-west.
 */
export function nearestCell(geo: Geo, lat: number, lon: number): number {
  const scale = Math.cos((lat * Math.PI) / 180);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < geo.lats.length; i++) {
    const dy = geo.lats[i] - lat;
    const dx = (geo.lons[i] - lon) * scale;
    const d = dy * dy + dx * dx;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Parse `grib_get_data` output ("lat lon value" per line, row-major) directly
 * into block averages, so the 1.9M-point grid is never held in memory. `scale`
 * converts the GRIB units to the units we contour in, and is applied to the
 * block mean rather than each point — the mean is linear, so it is the same
 * number for a sixteenth of the multiplies. See blockAverage for why the mean.
 * `nx`/`ny` are parameters so this is testable on a grid you can read.
 */
export function accumulate(
  text: string,
  scale: number,
  nx = NX,
  ny = NY
): { grid: Grid; geo: Geo } {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const n = ox * oy;
  const sv = new Float64Array(n);
  const sla = new Float64Array(n);
  const slo = new Float64Array(n);
  /** Points in the block — every row has a lat/lon, even a missing one. */
  const cnt = new Uint16Array(n);
  /** Points in the block with a real value. Only these may divide `sv`. */
  const vcnt = new Uint16Array(n);

  let i = 0; // point index within the full grid
  let pos = text.indexOf("\n") + 1; // skip the header line

  while (pos < text.length) {
    let nl = text.indexOf("\n", pos);
    if (nl < 0) nl = text.length;
    const line = text.slice(pos, nl);
    pos = nl + 1;
    if (!line) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const row = Math.floor(i / nx);
    const col = i % nx;
    i++;

    const bj = Math.floor(row / BLOCK);
    const bi = Math.floor(col / BLOCK);
    if (bj >= oy || bi >= ox) continue;

    const o = bj * ox + bi;

    // The location is good even where the value is not, so the geo grid takes
    // every row. Dropping a whole row here would drag the block's centroid.
    sla[o] += Number(parts[0]);
    let lon = Number(parts[1]);
    if (lon > 180) lon -= 360;
    slo[o] += lon;
    cnt[o]++;

    const value = Number(parts[2]);
    // MISSING is what we asked grib_get_data to print for absent values, so it
    // must be dropped rather than averaged in — it is finite, and 9999 would
    // read as permanent overcast or a cloudburst. Neither field currently has
    // any, so this guards the contract rather than a live failure.
    if (!Number.isFinite(value) || value === MISSING) continue;

    sv[o] += value;
    vcnt[o]++;
  }

  const values = new Float32Array(n);
  const lats = new Float32Array(n);
  const lons = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const c = cnt[k] || 1;
    lats[k] = sla[k] / c;
    lons[k] = slo[k] / c;
    // A block with no readings at all contours as 0, which draws nothing —
    // the honest answer for nodata, and the reason these are vectors.
    values[k] = vcnt[k] ? (sv[k] / vcnt[k]) * scale : 0;
  }

  return {
    grid: { nx: ox, ny: oy, values },
    geo: { nx: ox, ny: oy, lats, lons },
  };
}
