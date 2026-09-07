/**
 * HRRR's native 3 km Lambert grid, and the averaging helpers that coarsen it.
 *
 * Shared infrastructure with no source of its own, like `contour.ts` and
 * `grib.ts`: it knows HRRR's grid dimensions and nothing else about HRRR.
 * Contoured HRRR layers use this grid as published. The candidate map
 * averages each 4×4 of native cells, then contours that coarser field —
 * averaging removes structure, it does not invent it. Eval asks for the
 * native grid. Clicks still read the native cell.
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

/** Native HRRR spacing, km. */
export const CELL_KM = 3;

/** Native cells on a side of one candidate-map cell. 3 km -> 12 km on HRRR. */
export const BLOCK = 4;

/** Ground covered by one native cell, km^2. */
export const CELL_KM2 = CELL_KM ** 2;

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
 * The lat/lon window every layer is traced in.
 *
 * The default is Texas plus a little padding — eval and a first paint
 * without a map extent use that. The map may ask for the whole model
 * domain; the candidate path averages rather than refusing the box.
 */
export type LonLatBox = {
  west: number;
  east: number;
  south: number;
  north: number;
};

export const DRAWN: LonLatBox = {
  west: -107,
  east: -93,
  south: 25.5,
  north: 37,
};

/** HRRR CONUS, a little padded. A globe-sized query clips to this. */
const DOMAIN: LonLatBox = {
  west: -134,
  east: -60,
  south: 20,
  north: 55,
};

export function inBox(
  lat: number,
  lon: number,
  box: LonLatBox = DRAWN
): boolean {
  return (
    lat >= box.south &&
    lat <= box.north &&
    lon >= box.west &&
    lon <= box.east
  );
}

/**
 * Order the corners and clip to the model domain. A country-scale box
 * stays country-scale; it is not shrunk to Texas.
 */
export function clampBox(box: LonLatBox): LonLatBox {
  let { west, east, south, north } = box;
  if (east < west) {
    const t = west;
    west = east;
    east = t;
  }
  if (north < south) {
    const t = south;
    south = north;
    north = t;
  }
  west = Math.max(DOMAIN.west, Math.min(west, DOMAIN.east));
  east = Math.max(DOMAIN.west, Math.min(east, DOMAIN.east));
  south = Math.max(DOMAIN.south, Math.min(south, DOMAIN.north));
  north = Math.max(DOMAIN.south, Math.min(north, DOMAIN.north));
  if (east < west) {
    const t = west;
    west = east;
    east = t;
  }
  if (north < south) {
    const t = south;
    south = north;
    north = t;
  }
  return { west, east, south, north };
}

/**
 * Read a contour window from query parameters. Missing or unparseable
 * values fall back to the Texas default, which is what eval and a first
 * paint without a map extent use.
 */
export function parseBox(query: {
  west?: unknown;
  east?: unknown;
  south?: unknown;
  north?: unknown;
}): LonLatBox {
  const num = (value: unknown) => {
    if (typeof value === "number") return value;
    if (typeof value === "string" && value !== "") return Number(value);
    return NaN;
  };
  const west = num(query.west);
  const east = num(query.east);
  const south = num(query.south);
  const north = num(query.north);
  if (![west, east, south, north].every(Number.isFinite)) return DRAWN;
  return clampBox({ west, east, south, north });
}

/** Whether the caller asked for the evaluation's fine rings. */
export function parseFine(query: { fine?: unknown }): boolean {
  return parseFlag(query.fine);
}

/** A query parameter read as a switch: "1", "true", or the values themselves. */
export function parseFlag(value: unknown): boolean {
  return value === "1" || value === "true" || value === true || value === 1;
}

/**
 * Mean each `factor`×`factor` block onto a coarser grid, with matching
 * lat/lon. Missing cells do not enter the mean; a block of only missing
 * cells stays missing. This is averaging, not interpolation.
 *
 * `majority` is for a field whose absence is nodata rather than zero: a
 * block needs more sampled cells than missing ones to have a value at
 * all, so a lone cloudy pixel does not paint the whole coarse cell.
 */
export function downsample(
  grid: Grid,
  geo: Geo,
  factor: number,
  missing: (v: number) => boolean = (v) => !Number.isFinite(v),
  majority = false
): { grid: Grid; geo: Geo } {
  if (factor <= 1) return { grid, geo };
  const ox = Math.floor(grid.nx / factor);
  const oy = Math.floor(grid.ny / factor);
  if (ox < 1 || oy < 1) return { grid, geo };
  const values = new Float32Array(ox * oy);
  const lats = new Float32Array(ox * oy);
  const lons = new Float32Array(ox * oy);
  const block = factor * factor;
  for (let bj = 0; bj < oy; bj++) {
    for (let bi = 0; bi < ox; bi++) {
      let sum = 0;
      let n = 0;
      let lat = 0;
      let lon = 0;
      for (let dj = 0; dj < factor; dj++) {
        const row = (bj * factor + dj) * grid.nx + bi * factor;
        for (let di = 0; di < factor; di++) {
          const k = row + di;
          lat += geo.lats[k];
          lon += geo.lons[k];
          const v = grid.values[k];
          if (missing(v)) continue;
          sum += v;
          n++;
        }
      }
      const o = bj * ox + bi;
      values[o] =
        n === 0 || (majority && n * 2 <= block) ? Number.NaN : sum / n;
      lats[o] = lat / block;
      lons[o] = lon / block;
    }
  }
  return {
    grid: { nx: ox, ny: oy, values },
    geo: { nx: ox, ny: oy, lats, lons },
  };
}

/**
 * The sub-grid the map contours: a crop, then — unless evaluation asked
 * for native rings — a 4×4 average. The factor does not change with the
 * window, so zooming does not restyle the rings.
 */
export function prepareDraw(
  grid: Grid,
  geo: Geo,
  box: LonLatBox,
  fine = false,
  missing?: (v: number) => boolean,
  majority = false
): { grid: Grid; geo: Geo } {
  const cropped = crop(grid, geo, box);
  if (fine) return cropped;
  return downsample(cropped.grid, cropped.geo, BLOCK, missing, majority);
}

/**
 * Rectangular sub-grid covering `box`, padded one cell so contours on the
 * edge still close.
 *
 * Rows and columns stay as they were — this is a crop, not a resample.
 * Nothing is interpolated. Cells outside the box are dropped.
 */
export function crop(
  grid: Grid,
  geo: Geo,
  box: LonLatBox = DRAWN
): { grid: Grid; geo: Geo } {
  const { nx, ny } = geo;
  let i0 = nx;
  let i1 = -1;
  let j0 = ny;
  let j1 = -1;

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (!inBox(geo.lats[k], geo.lons[k], box)) continue;
      if (i < i0) i0 = i;
      if (i > i1) i1 = i;
      if (j < j0) j0 = j;
      if (j > j1) j1 = j;
    }
  }

  if (i1 < i0 || j1 < j0) {
    const empty = new Float32Array(0);
    return {
      grid: { nx: 0, ny: 0, values: empty },
      geo: { nx: 0, ny: 0, lats: empty, lons: empty },
    };
  }

  i0 = Math.max(0, i0 - 1);
  i1 = Math.min(nx - 1, i1 + 1);
  j0 = Math.max(0, j0 - 1);
  j1 = Math.min(ny - 1, j1 + 1);

  const ox = i1 - i0 + 1;
  const oy = j1 - j0 + 1;
  const values = new Float32Array(ox * oy);
  const lats = new Float32Array(ox * oy);
  const lons = new Float32Array(ox * oy);

  for (let j = 0; j < oy; j++) {
    const src = (j0 + j) * nx + i0;
    const dst = j * ox;
    values.set(grid.values.subarray(src, src + ox), dst);
    lats.set(geo.lats.subarray(src, src + ox), dst);
    lons.set(geo.lons.subarray(src, src + ox), dst);
  }

  return {
    grid: { nx: ox, ny: oy, values },
    geo: { nx: ox, ny: oy, lats, lons },
  };
}

/**
 * Apply a unit scale, and turn a missing sentinel into NaN.
 *
 * This is what a native-grid build does instead of block-averaging: the values
 * are already 3 km, so the only jobs left are units and nodata.
 */
export function scaleField(
  values: Float32Array,
  scale: number,
  missing: number | null = null
): Float32Array {
  const out = new Float32Array(values.length);
  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    out[i] = missing !== null && v === missing ? NO_VALUE : v * scale;
  }
  return out;
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

/**
 * The farthest a point inside the grid can be from the nearest cell center:
 * half a cell's diagonal. Beyond it the point is outside the grid, however
 * close the edge cell happens to be.
 */
export const SNAP_KM = (CELL_KM / 2) * Math.SQRT2;

/** Degrees to km on the ground. The grid is 3 km, so flat earth is exact enough. */
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
 * knows what a Lambert projection is. `step` thins the walk: every fourth 3 km
 * cell is 12 km along the edge, the same line for a quarter of the coordinates.
 * Each edge stops one short of its far corner, which is the next edge's first
 * point, so every corner appears exactly once.
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
 * A plain scan of the 3 km grid — 1.9M cells, a few milliseconds, and it needs
 * no assumption about how the Lambert projection lays out. Longitude is scaled
 * by cos(lat) so "nearest" means nearest on the ground rather than nearest in
 * degrees, which at 45 N would be 40% wrong east-west.
 *
 * Do not call this in a loop over another grid. `cellAt` takes an optional
 * seed so a walk across neighboring pixels reuses the last cell.
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
 * Index of the grid cell whose **footprint** contains a point.
 *
 * This is what a readout wants and `nearestCell` is not it. A cell's footprint
 * is a square in the grid's own row and column space, and the contours are
 * traced in that same space, with each band edge drawn midway between two cell
 * centers. The nearest *center* in latitude and longitude is a different
 * question, and near a cell boundary the two answer differently, so a point
 * inside a drawn band could be reported against a neighboring cell that the
 * band excluded.
 *
 * **Solved in the grid's own space, without a projection inverse.** Take a
 * starting guess, then read the two vectors that step one cell along its row
 * and one along its column straight off the lat/lon arrays. They span the local
 * grid, so the point's offset from that cell's center resolves into "how many
 * cells along the row, how many along the column", and rounding both lands on
 * the cell containing it. The starting guess only has to be within a cell for
 * the rounding to correct it, which `nearestCell` always is.
 *
 * `seed` is that guess when the caller already has a nearby cell — a walk
 * across neighboring pixels of another grid. Without it this falls back to
 * `nearestCell`, which is the right seed for a single click and the wrong one
 * for 3.75 million GOES pixels.
 *
 * At the grid's edge the step goes to the neighbor behind and the vector is
 * negated, so the basis means the same thing everywhere.
 */
export function cellAt(
  geo: Geo,
  lat: number,
  lon: number,
  seed?: number
): number {
  const { nx, ny } = geo;
  if (seed === undefined) seed = nearestCell(geo, lat, lon);
  const i0 = seed % nx;
  const j0 = Math.floor(seed / nx);

  const [i1, si] = i0 + 1 < nx ? [i0 + 1, 1] : [i0 - 1, -1];
  const [j1, sj] = j0 + 1 < ny ? [j0 + 1, 1] : [j0 - 1, -1];
  // A grid one cell across in either direction spans nothing to solve in.
  if (i1 < 0 || j1 < 0) return seed;

  const at = (i: number, j: number) => j * nx + i;
  const here = at(i0, j0);
  const alongRow: [number, number] = [
    si * (geo.lons[at(i1, j0)] - geo.lons[here]),
    si * (geo.lats[at(i1, j0)] - geo.lats[here]),
  ];
  const alongColumn: [number, number] = [
    sj * (geo.lons[at(i0, j1)] - geo.lons[here]),
    sj * (geo.lats[at(i0, j1)] - geo.lats[here]),
  ];

  const det = alongRow[0] * alongColumn[1] - alongRow[1] * alongColumn[0];
  // Degenerate only if the two steps are parallel, which no real grid is.
  if (det === 0) return seed;

  const dx = lon - geo.lons[here];
  const dy = lat - geo.lats[here];
  const along = (dx * alongColumn[1] - dy * alongColumn[0]) / det;
  const across = (alongRow[0] * dy - alongRow[1] * dx) / det;

  const i = Math.min(Math.max(i0 + Math.round(along), 0), nx - 1);
  const j = Math.min(Math.max(j0 + Math.round(across), 0), ny - 1);
  return at(i, j);
}

/**
 * Parse `grib_get_data` output ("lat lon value" per line, row-major) into the
 * native grid. `scale` converts the GRIB units to the units we contour in.
 * `nx`/`ny` are parameters so this is testable on a grid you can read.
 */
export function accumulate(
  text: string,
  scale: number,
  nx = NX,
  ny = NY
): { grid: Grid; geo: Geo } {
  const n = nx * ny;
  const values = new Float32Array(n);
  const lats = new Float32Array(n);
  const lons = new Float32Array(n);

  let i = 0;
  let pos = text.indexOf("\n") + 1; // skip the header line

  while (pos < text.length && i < n) {
    let nl = text.indexOf("\n", pos);
    if (nl < 0) nl = text.length;
    const line = text.slice(pos, nl);
    pos = nl + 1;
    if (!line) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    lats[i] = Number(parts[0]);
    let lon = Number(parts[1]);
    if (lon > 180) lon -= 360;
    lons[i] = lon;

    const value = Number(parts[2]);
    // MISSING is what we asked grib_get_data to print for absent values, so it
    // must be dropped rather than drawn — it is finite, and 9999 would read as
    // permanent overcast or a cloudburst.
    values[i] =
      !Number.isFinite(value) || value === MISSING ? 0 : value * scale;
    i++;
  }

  return {
    grid: { nx, ny, values },
    geo: { nx, ny, lats, lons },
  };
}
