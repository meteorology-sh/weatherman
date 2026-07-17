/**
 * Marching squares over a scalar grid, stitched into GeoJSON-ready polygons.
 *
 * Pure geometry: no network, no eccodes, no HRRR. Everything here is driven by
 * a `Grid` of values and a `Geo` of matching lat/lons, so it is testable on
 * hand-built grids you can read.
 */

export type Grid = { nx: number; ny: number; values: Float32Array };

/** Lat/lon of each grid cell. Identical for every HRRR run, so computed once. */
export type Geo = { nx: number; ny: number; lats: Float32Array; lons: Float32Array };

export type ContourRing = [number, number][];

type Pt = readonly [number, number];

/**
 * Marching squares over {value >= level}, stitched into closed rings, with
 * holes nested inside the exterior that contains them (GeoJSON needs
 * [exterior, ...holes] or a clear patch inside a cloud mass renders as cloud).
 */
export function polygons(grid: Grid, geo: Geo, level: number): ContourRing[][] {
  const rings = trace(grid, level).map((ring) =>
    ring.map(([fi, fj]) => project(fi, fj, geo))
  );

  const exteriors: { ring: ContourRing; area: number; holes: ContourRing[] }[] = [];
  const holes: ContourRing[] = [];

  for (const ring of rings) {
    const a = signedArea(ring);
    if (a > 0) exteriors.push({ ring, area: a, holes: [] });
    else if (a < 0) holes.push(ring);
  }

  // Smallest containing exterior wins, so holes inside nested shapes land right.
  for (const hole of holes) {
    let best: (typeof exteriors)[number] | null = null;
    for (const ext of exteriors) {
      if (!contains(ext.ring, hole[0])) continue;
      if (!best || ext.area < best.area) best = ext;
    }
    if (best) best.holes.push(hole);
  }

  return exteriors.map((e) => [e.ring, ...e.holes]);
}

/** Grid coords (in the 1-cell padded space) -> lat/lon, bilinear on eccodes' own arrays. */
function project(fi: number, fj: number, geo: Geo): [number, number] {
  const gi = Math.min(Math.max(fi - 1, 0), geo.nx - 1.001);
  const gj = Math.min(Math.max(fj - 1, 0), geo.ny - 1.001);
  const i0 = Math.floor(gi);
  const j0 = Math.floor(gj);
  const di = gi - i0;
  const dj = gj - j0;
  const i1 = Math.min(i0 + 1, geo.nx - 1);
  const j1 = Math.min(j0 + 1, geo.ny - 1);

  const bil = (a: Float32Array) =>
    a[j0 * geo.nx + i0] * (1 - di) * (1 - dj) +
    a[j0 * geo.nx + i1] * di * (1 - dj) +
    a[j1 * geo.nx + i0] * (1 - di) * dj +
    a[j1 * geo.nx + i1] * di * dj;

  return [round(bil(geo.lons)), round(bil(geo.lats))];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

const SIDES = {
  T: (i: number, j: number) => [i + 0.5, j] as Pt,
  R: (i: number, j: number) => [i + 1, j + 0.5] as Pt,
  B: (i: number, j: number) => [i + 0.5, j + 1] as Pt,
  L: (i: number, j: number) => [i, j + 0.5] as Pt,
};

/** Marching-squares cases, directed so the region is on the left of each segment. */
const CASES: Record<number, [keyof typeof SIDES, keyof typeof SIDES][]> = {
  1: [["B", "L"]],
  2: [["R", "B"]],
  3: [["R", "L"]],
  4: [["T", "R"]],
  5: [
    ["T", "L"],
    ["B", "R"],
  ],
  6: [["T", "B"]],
  7: [["T", "L"]],
  8: [["L", "T"]],
  9: [["B", "T"]],
  10: [
    ["L", "B"],
    ["R", "T"],
  ],
  11: [["R", "T"]],
  12: [["L", "R"]],
  13: [["B", "R"]],
  14: [["L", "B"]],
};

/** Closed rings in padded grid coordinates. */
function trace(grid: Grid, level: number): Pt[][] {
  const { nx, ny, values } = grid;
  // Pad by one cell so regions touching the domain edge still close.
  const w = nx + 2;
  const h = ny + 2;
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (values[j * nx + i] >= level) mask[(j + 1) * w + (i + 1)] = 1;
    }
  }

  const next = new Map<string, Pt[]>();
  const key = (p: Pt) => `${p[0]},${p[1]}`;

  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const tl = mask[j * w + i];
      const tr = mask[j * w + i + 1];
      const br = mask[(j + 1) * w + i + 1];
      const bl = mask[(j + 1) * w + i];
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
      const segs = CASES[c];
      if (!segs) continue;
      for (const [from, to] of segs) {
        const a = SIDES[from](i, j);
        const b = SIDES[to](i, j);
        const k = key(a);
        const list = next.get(k);
        if (list) list.push(b);
        else next.set(k, [b]);
      }
    }
  }

  const rings: Pt[][] = [];
  for (const start of Array.from(next.keys())) {
    while (next.get(start)?.length) {
      const ring: Pt[] = [];
      let cur: Pt = start.split(",").map(Number) as unknown as Pt;
      for (;;) {
        const outs = next.get(key(cur));
        if (!outs || outs.length === 0) break;
        const step = outs.pop()!;
        ring.push(cur);
        cur = step;
        if (key(cur) === start) {
          ring.push(cur);
          break;
        }
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  return rings;
}

function signedArea(ring: ContourRing): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    s += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  }
  return s / 2;
}

/** Ray casting; ring is closed (first === last). */
function contains(ring: ContourRing, p: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1]) {
      const x = ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}
