/**
 * Marching squares over a scalar grid, stitched into GeoJSON-ready polygons.
 *
 * Pure geometry: no network, no eccodes, no HRRR. Everything here is driven by
 * a `Grid` of values and a `Geo` of matching lat/lons, so it is testable on
 * hand-built grids you can read.
 */

export type Grid = { nx: number; ny: number; values: Float32Array };

/** Lat/lon of each grid cell. Identical for every HRRR run, so computed once. */
export type Geo = {
  nx: number;
  ny: number;
  lats: Float32Array;
  lons: Float32Array;
};

export type ContourRing = [number, number][];

export type ContourFeature = {
  type: "Feature";
  /** One entry, keyed by the field's `property` and set to the contour level. */
  properties: Record<string, number>;
  geometry: { type: "MultiPolygon"; coordinates: ContourRing[][] };
};

/**
 * One contoured field on the wire: the features plus the times they are true
 * of. Every layer this server draws is one of these, so the shape lives with
 * the contourer rather than with any one source.
 */
export type ContourFrame = {
  type: "FeatureCollection";
  run: string;
  /** Valid time of this frame, ISO 8601. */
  validTime: string;
  hour: number;
  features: ContourFeature[];
};

/** A frame for one run and hour. The valid time follows from the two. */
export function frame(
  run: Date,
  hour: number,
  features: ContourFeature[]
): ContourFrame {
  return {
    type: "FeatureCollection",
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    features,
  };
}

type Pt = readonly [number, number];

/**
 * How a traced ring is thinned before it is projected.
 *
 * The field is already at the cell the map asked for — native on eval,
 * four native cells averaged on the candidate map. These numbers are in
 * **cells of that field**. Stair-steps closer than `epsilon` become a
 * diagonal; rings smaller than `minArea` are not drawn. `round` is Chaikin
 * passes after that: each pass cuts corners, so the fill is a blob rather
 * than a triangle. Eval skips it and keeps the stairs.
 */
export type RingStyle = {
  epsilon: number;
  minArea: number;
  /** Chaikin passes after RDP. Omit or 0 to leave the ring faceted. */
  round?: number;
  /**
   * Put each vertex where the field actually reaches the level, rather than
   * at the middle of the cell edge it crosses.
   *
   * **Continuous fields only.** On a 0/1 mask every crossing lands exactly on
   * the inside corner, which collapses a one-cell feature to a point — so the
   * storm-object rings and the two gate fills leave this off and keep the
   * midpoints. A corner sitting exactly on the level falls back to the
   * midpoint for the same reason.
   */
  interpolate?: boolean;
};

/** RDP tolerance that keeps a one-cell protrusion and flattens stairs. */
export const SIMPLIFY_CELL = 0.4;

/** Drop drawn islands and holes smaller than one cell of the drawn grid. */
export const MIN_RING_AREA = 1;

/** Two Chaikin passes: quadratic B-spline of the ring. */
export const MAP_ROUND = 2;

export const FINE_STYLE: RingStyle = {
  epsilon: SIMPLIFY_CELL,
  minArea: MIN_RING_AREA,
};

export const MAP_STYLE: RingStyle = {
  epsilon: SIMPLIFY_CELL,
  minArea: MIN_RING_AREA,
  round: MAP_ROUND,
};

/**
 * The drawn style for a field whose values vary smoothly.
 *
 * The map traces a field that has been averaged into blocks, so a ring pinned
 * to cell-edge midpoints is a staircase four times coarser than the model —
 * and rounding a staircase gives blobs. Interpolating puts the vertex where
 * the values say the level is, inside the cell, which is detail the block
 * average already carries rather than detail invented by the smoother.
 */
export const SMOOTH_STYLE: RingStyle = { ...MAP_STYLE, interpolate: true };

export function styleFor(fine: boolean): RingStyle {
  return fine ? FINE_STYLE : MAP_STYLE;
}

/** {@link styleFor} for a continuous field. Evaluation is unchanged. */
export function smoothFor(fine: boolean): RingStyle {
  return fine ? FINE_STYLE : SMOOTH_STYLE;
}

const DRAWN_STYLE: RingStyle = MAP_STYLE;

/**
 * One nested MultiPolygon per level, dropping levels nothing in the grid
 * reaches. Every contoured layer in this server — HRRR's fields and MRMS
 * reflectivity alike — is built by this, so they nest and stack identically.
 */
export function features(
  grid: Grid,
  geo: Geo,
  property: string,
  levels: readonly number[],
  style: RingStyle = DRAWN_STYLE
): ContourFeature[] {
  return levels
    .map((level) => ({
      type: "Feature" as const,
      properties: { [property]: level },
      geometry: {
        type: "MultiPolygon" as const,
        coordinates: polygons(grid, geo, level, style),
      },
    }))
    .filter((f) => f.geometry.coordinates.length > 0);
}

/**
 * One MultiPolygon per half-open interval `[edges[i], edges[i+1])`, the last one
 * open-ended — **disjoint bands, not nested contours.**
 *
 * `features()` above is the right shape for a field whose extremes are rare and
 * whose "more" nests naturally: cloud cover, precipitation rate, reflectivity,
 * liquid water. Cloud-top temperature is not that field — it is bimodal, warm
 * low cloud or very cold cirrus with little in between, so nested levels all
 * cover a similar share of the grid and land almost exactly on top of each
 * other. Stacking those paints a third of the map at full opacity and tells the
 * operator nothing about which third is interesting.
 *
 * Disjoint bands let each interval carry its own weight instead: exactly one
 * band applies to a cell, so the legend reads them straight rather than
 * compositing them.
 *
 * Each feature's `property` is set to the band's lower edge, which is what the
 * renderer matches on.
 */
export function bandFeatures(
  grid: Grid,
  geo: Geo,
  property: string,
  edges: readonly number[],
  style: RingStyle = DRAWN_STYLE
): ContourFeature[] {
  // A ring that is neither rounded nor interpolated sits on the cell-edge
  // midpoints whichever way it was traced, so two neighbouring bands cannot
  // disagree about the boundary they share and there is nothing to fix: the
  // evaluation harness keeps the mask trace it has always been checked on.
  const rings =
    style.interpolate || (style.round ?? 0) > 0
      ? edges.map((level) => levelRings(grid, geo, level, style))
      : null;

  return edges
    .map((lo, i) => ({
      type: "Feature" as const,
      properties: { [property]: lo },
      geometry: {
        type: "MultiPolygon" as const,
        coordinates: rings
          ? // {value >= lo} minus {value >= edges[i + 1]}, which is exactly
            // the half-open band.
            assemble(band(rings[i], rings[i + 1] ?? []))
          : maskPolygons(grid, geo, lo, edges[i + 1] ?? Infinity, style),
      },
    }))
    .filter((f) => f.geometry.coordinates.length > 0);
}

/** One band traced from its own 0/1 mask, each band on its own. */
function maskPolygons(
  grid: Grid,
  geo: Geo,
  lo: number,
  hi: number,
  style: RingStyle
): ContourRing[][] {
  // polygons() thresholds internally, so a 0/1 mask contoured at 1 is
  // exactly a marching-squares pass over {lo <= value < hi}.
  const mask = new Float32Array(grid.values.length);
  for (let k = 0; k < grid.values.length; k++) {
    const v = grid.values[k];
    mask[k] = v >= lo && v < hi ? 1 : 0;
  }
  return polygons({ ...grid, values: mask }, geo, 1, style);
}

/**
 * The rings of one half-open band: everything bounding {value >= lo} that the
 * next edge does not also bound, plus the next edge's own rings turned inside
 * out to cut it away.
 *
 * A ring the two edges have in common is a plateau — ground the band's floor
 * and its ceiling both sit under — and there the band has no area at all, so
 * the pair cancels rather than drawing an outline around nothing. Both come
 * out of the same tracer over the same grid, so an identical shape is an
 * identical array of coordinates and the comparison is exact.
 */
function band(outer: SignedRing[], inner: SignedRing[]): SignedRing[] {
  const key = (r: SignedRing) => r.ring.map((p) => `${p[0]} ${p[1]}`).join(",");
  const outerKeys = new Set(outer.map(key));
  const innerKeys = new Set(inner.map(key));
  return outer
    .filter((r) => !innerKeys.has(key(r)))
    .concat(
      inner
        .filter((r) => !outerKeys.has(key(r)))
        .map((r) => ({ ...r, exterior: !r.exterior }))
    );
}

/**
 * Marching squares over {value >= level}, stitched into closed rings and
 * nested so each hole sits inside the exterior that contains it.
 */
export function polygons(
  grid: Grid,
  geo: Geo,
  level: number,
  style: RingStyle = { epsilon: SIMPLIFY_CELL, minArea: 0 }
): ContourRing[][] {
  return assemble(levelRings(grid, geo, level, style));
}

/** One traced, thinned, projected ring, and which way round it came out. */
type SignedRing = {
  ring: ContourRing;
  /** Unsigned, so a flipped ring still nests by size. */
  area: number;
  exterior: boolean;
};

/**
 * Every ring of {value >= level}, thinned in grid space and then projected.
 *
 * Thinning before projecting is deliberate: projecting first would curve the
 * Lambert rows and hide the collinear runs. Storm object polygons pass
 * `minArea: 0` so a one-cell echo still has a ring; drawn layers drop specks.
 * Eval passes no `round`, so the stairs stay.
 */
function levelRings(
  grid: Grid,
  geo: Geo,
  level: number,
  style: RingStyle
): SignedRing[] {
  const out: SignedRing[] = [];
  for (const traced of trace(grid, level, style.interpolate === true)) {
    const simple = simplifyRing(traced, style);
    if (simple.length < 4) continue;
    if (Math.abs(signedArea(simple as ContourRing)) < style.minArea) continue;
    const ring = simple.map(([fi, fj]) => project(fi, fj, geo));
    const a = signedArea(ring);
    if (a === 0) continue;
    out.push({ ring, area: Math.abs(a), exterior: a > 0 });
  }
  return out;
}

/**
 * Rings into GeoJSON polygons, each hole inside the smallest exterior that
 * contains it — GeoJSON needs [exterior, ...holes] or a clear patch inside a
 * cloud mass renders as cloud, and the smallest container is what lands a hole
 * right inside nested shapes.
 */
function assemble(rings: readonly SignedRing[]): ContourRing[][] {
  const exteriors: { ring: ContourRing; area: number; holes: ContourRing[] }[] =
    [];
  const holes: ContourRing[] = [];
  for (const r of rings) {
    if (r.exterior) exteriors.push({ ring: r.ring, area: r.area, holes: [] });
    else holes.push(r.ring);
  }

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

/** Marching-squares cases, directed so the region is on the left of each segment. */
const CASES: Record<number, [Side, Side][]> = {
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

type Side = "T" | "R" | "B" | "L";

/** Closed rings in padded grid coordinates. */
function trace(grid: Grid, level: number, interpolate: boolean): Pt[][] {
  const { nx, ny, values } = grid;
  // Pad by one cell so regions touching the domain edge still close.
  const w = nx + 2;
  const h = ny + 2;
  const mask = new Uint8Array(w * h);
  // The same values, padded to match, so a crossing can be placed by where the
  // field reaches the level. The pad ring stays NaN and falls back to the
  // midpoint, which is what the whole grid used to do.
  const vals = new Float32Array(w * h).fill(Number.NaN);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const v = values[j * nx + i];
      vals[(j + 1) * w + (i + 1)] = v;
      if (v >= level) mask[(j + 1) * w + (i + 1)] = 1;
    }
  }

  /**
   * How far along an edge the field reaches `level`, as a fraction from the
   * first corner to the second.
   *
   * The two cells either side of an edge read the same pair of corners in the
   * same order, so both land on the same coordinate and the segments still
   * stitch on an exact key match.
   */
  const at = (va: number, vb: number): number => {
    if (!interpolate) return 0.5;
    if (!Number.isFinite(va) || !Number.isFinite(vb)) return 0.5;
    const span = vb - va;
    if (span === 0) return 0.5;
    const t = (level - va) / span;
    // Exactly on the level means a 0/1 mask rather than a gradient: putting
    // the vertex on the corner would collapse a one-cell feature to a point.
    return t > 0 && t < 1 ? t : 0.5;
  };

  /** Crossing on the horizontal edge from (i, j) to (i + 1, j). */
  const hx = (i: number, j: number) =>
    i + at(vals[j * w + i], vals[j * w + i + 1]);
  /** Crossing on the vertical edge from (i, j) to (i, j + 1). */
  const vy = (i: number, j: number) =>
    j + at(vals[j * w + i], vals[(j + 1) * w + i]);

  const side = (s: Side, i: number, j: number): Pt => {
    switch (s) {
      case "T":
        return [hx(i, j), j];
      case "R":
        return [i + 1, vy(i + 1, j)];
      case "B":
        return [hx(i, j + 1), j + 1];
      default:
        return [i, vy(i, j)];
    }
  };

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
        const a = side(from, i, j);
        const b = side(to, i, j);
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

/**
 * Drop collinear vertices, then Ramer–Douglas–Peucker, then optional
 * Chaikin, in grid coordinates. Projecting first would curve Lambert
 * rows and hide the collinear runs.
 */
function simplifyRing(ring: Pt[], style: RingStyle): Pt[] {
  const collapsed = collapseCollinear(ring);
  if (collapsed.length < 4) return collapsed;
  const thinned =
    style.epsilon > 0 ? rdpClosed(collapsed, style.epsilon) : collapsed;
  const passes = style.round ?? 0;
  return passes > 0 ? chaikinClosed(thinned, passes) : thinned;
}

/**
 * Cut each corner to the quarter-points of its two edges. Two passes
 * is the quadratic B-spline of the RDP ring: the fill follows the
 * storm, not the cell stairs and not a box.
 */
function chaikinClosed(ring: Pt[], passes: number): Pt[] {
  let pts = same(ring[0], ring[ring.length - 1])
    ? ring.slice(0, -1)
    : ring.slice();
  if (pts.length < 3 || passes <= 0) return ring;
  for (let n = 0; n < passes; n++) {
    const next: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]]);
      next.push([0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    pts = next;
  }
  const out: Pt[] = pts.concat([pts[0]]);
  return out.length >= 4 ? out : ring;
}

function same(a: Pt, b: Pt): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

function collapseCollinear(ring: Pt[]): Pt[] {
  if (ring.length < 4) return ring;
  const pts =
    same(ring[0], ring[ring.length - 1]) ? ring.slice(0, -1) : ring.slice();
  const n = pts.length;
  if (n < 3) return ring;
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const cross =
      (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (cross !== 0) out.push(b);
  }
  if (out.length < 3) return ring;
  out.push(out[0]);
  return out;
}

function distToSeg(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = Math.max(
    0,
    Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)
  );
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function rdpOpen(pts: Pt[], epsilon: number): Pt[] {
  if (pts.length <= 2) return pts;
  const a = pts[0];
  const b = pts[pts.length - 1];
  let dmax = -1;
  let idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = distToSeg(pts[i], a, b);
    if (d > dmax) {
      dmax = d;
      idx = i;
    }
  }
  if (dmax > epsilon) {
    const left = rdpOpen(pts.slice(0, idx + 1), epsilon);
    const right = rdpOpen(pts.slice(idx), epsilon);
    return left.slice(0, -1).concat(right);
  }
  return [a, b];
}

function rdpClosed(ring: Pt[], epsilon: number): Pt[] {
  const pts = same(ring[0], ring[ring.length - 1])
    ? ring.slice(0, -1)
    : ring.slice();
  if (pts.length <= 3) return ring;
  let k = 1;
  let farthest = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > farthest) {
      farthest = d;
      k = i;
    }
  }
  const first = rdpOpen(pts.slice(0, k + 1), epsilon);
  const second = rdpOpen(pts.slice(k).concat([pts[0]]), epsilon);
  const out = first.concat(second.slice(1));
  if (out.length < 3) return ring;
  if (!same(out[0], out[out.length - 1])) out.push(out[0]);
  return out.length >= 4 ? out : ring;
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
