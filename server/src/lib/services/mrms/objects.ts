/**
 * Contiguous ≥20 dBZ regions on the MRMS mosaic, as objects with a track.
 *
 * Not TITAN: the mosaic is a 2D composite, so these have area, a max, a
 * centroid, and an age, not volume or precipitation mass. The polygon is the
 * same averaged 20 dBZ ring the map fills; a click is inside that ring,
 * not a 1 km cell. Nothing is interpolated.
 */

// Services
import { MAP_STYLE, polygons, SIMPLIFY_CELL } from "../shared/contour";

// Types
import type { Grid, Geo, ContourRing, RingStyle } from "../shared/contour";

/** Degrees of latitude to kilometres. */
const KM_PER_DEG = 111.32;

/** How far an object may move between scans and still be the same storm, km. */
const MATCH_KM = 20;

/**
 * A storm on one mosaic. `cells` index the grid this was identified on, so
 * they are not sent on the wire.
 */
export type StormObject = {
  id: number;
  /** First mosaic this id was seen on, ISO 8601. */
  firstSeen: string;
  nCells: number;
  areaKm2: number;
  maxDbz: number;
  coreLon: number;
  coreLat: number;
  centroidLon: number;
  centroidLat: number;
  /** Minutes since `firstSeen`. Null when this mosaic has no previous scan. */
  ageMin: number | null;
  /**
   * True when `firstSeen` is the oldest scan we looked at, so `ageMin` is
   * a lower bound rather than the storm's first appearance.
   */
  ageFloor: boolean;
  /** Direction the centroid is moving toward, degrees. Null if still or new. */
  motionTowardDeg: number | null;
  motionKmh: number | null;
  /**
   * Change in raining area from the previous scan, km². Null when this
   * mosaic has no previous scan. Positive is more rain than two minutes ago.
   */
  areaDeltaKm2: number | null;
  cells: Uint32Array;
  geometry: ContourRing[][];
};

export type StormFeature = {
  type: "Feature";
  properties: {
    stormId: number;
    maxDbz: number;
    areaKm2: number;
    ageMin: number | null;
    motionTowardDeg: number | null;
    motionKmh: number | null;
    areaDeltaKm2: number | null;
    coreLon: number;
    coreLat: number;
  };
  geometry: { type: "MultiPolygon"; coordinates: ContourRing[][] };
};

export type StormFrame = {
  type: "FeatureCollection";
  validTime: string;
  features: StormFeature[];
};

/** The object nearest a point, and where that point sits in it. */
export type StormNear = {
  validTime: string;
  object: StormObject;
  /** Kilometres from the point to the storm's strongest cell. */
  coreKm: number;
  /** True when the point is inside the outline drawn for this storm. */
  inside: boolean;
  /**
   * Kilometres from the point to the nearest edge of that outline, measured
   * the same from either side of it. Null when the storm has no ring.
   */
  edgeKm: number | null;
};

export function km(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const mid = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dlat = (lat2 - lat1) * KM_PER_DEG;
  const dlon = (lon2 - lon1) * KM_PER_DEG * Math.cos(mid);
  return Math.hypot(dlat, dlon);
}

/** Direction from A toward B, degrees clockwise from north. */
export function bearingDeg(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const mid = ((lat1 + lat2) / 2) * (Math.PI / 180);
  const dlat = lat2 - lat1;
  const dlon = (lon2 - lon1) * Math.cos(mid);
  const deg = (Math.atan2(dlon, dlat) * 180) / Math.PI;
  return deg < 0 ? deg + 360 : deg;
}

function cellKm2(lat: number, dlat: number, dlon: number): number {
  return dlat * KM_PER_DEG * (dlon * KM_PER_DEG * Math.cos(lat * (Math.PI / 180)));
}

function steps(geo: Geo): { dlat: number; dlon: number } {
  const dlon = geo.nx > 1 ? Math.abs(geo.lons[1] - geo.lons[0]) : 0.01;
  const dlat =
    geo.ny > 1 ? Math.abs(geo.lats[geo.nx] - geo.lats[0]) : 0.01;
  return { dlat, dlon };
}

function find(parent: Int32Array, x: number): number {
  while (parent[x] !== x) {
    parent[x] = parent[parent[x]];
    x = parent[x];
  }
  return x;
}

/** Map click: the fill's ring. Eval: keep a one-cell echo, no rounding. */
export function stormStyle(fine: boolean): RingStyle {
  return fine
    ? { epsilon: SIMPLIFY_CELL, minArea: 0, round: 0 }
    : MAP_STYLE;
}

/**
 * 8-connected regions at or above `threshold`. The domain does not wrap: a
 * cell on the west edge does not see the east edge.
 */
export function identify(
  grid: Grid,
  geo: Geo,
  threshold: number,
  validTime: string,
  style: RingStyle = MAP_STYLE
): StormObject[] {
  const { nx, ny, values } = grid;
  const n = nx * ny;
  const parent = new Int32Array(n).fill(-1);

  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (values[k] < threshold) continue;
      parent[k] = k;
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (di === 0 && dj === 0) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || ni >= nx || nj < 0 || nj >= ny) continue;
          const nk = nj * nx + ni;
          if (values[nk] < threshold) continue;
          if (parent[nk] < 0) parent[nk] = nk;
          const a = find(parent, k);
          const b = find(parent, nk);
          if (a !== b) parent[b] = a;
        }
      }
    }
  }

  const groups = new Map<number, number[]>();
  for (let k = 0; k < n; k++) {
    if (parent[k] < 0) continue;
    const root = find(parent, k);
    const list = groups.get(root);
    if (list) list.push(k);
    else groups.set(root, [k]);
  }

  const { dlat, dlon } = steps(geo);
  const objects: StormObject[] = [];
  let id = 1;
  for (const cells of groups.values()) {
    let maxDbz = -Infinity;
    let maxK = cells[0];
    let sumLat = 0;
    let sumLon = 0;
    let area = 0;
    for (const k of cells) {
      const v = values[k];
      if (v > maxDbz) {
        maxDbz = v;
        maxK = k;
      }
      sumLat += geo.lats[k];
      sumLon += geo.lons[k];
      area += cellKm2(geo.lats[k], dlat, dlon);
    }
    const centroidLat = sumLat / cells.length;
    const centroidLon = sumLon / cells.length;
    objects.push({
      id: id++,
      firstSeen: validTime,
      nCells: cells.length,
      areaKm2: Math.round(area * 10) / 10,
      maxDbz: Math.round(maxDbz * 10) / 10,
      coreLon: geo.lons[maxK],
      coreLat: geo.lats[maxK],
      centroidLon,
      centroidLat,
      ageMin: null,
      ageFloor: false,
      motionTowardDeg: null,
      motionKmh: null,
      areaDeltaKm2: null,
      cells: Uint32Array.from(cells),
      geometry: objectPolygon(cells, grid, geo, style),
    });
  }
  return objects;
}

/**
 * Smallest raining area the candidate map draws a core and a heading for,
 * km². One cell of the 4 km grid this map used to paint the country with.
 * A click uses the same averaged ring as the fill; the evaluation harness
 * asks for the native ring.
 */
export const MIN_DRAWN_STORM_KM2 = 16;

/**
 * Nearby specks within this many kilometres of a larger echo belong to
 * that shower. Two storms both above {@link MIN_DRAWN_STORM_KM2} stay
 * two storms even if they sit this close.
 */
export const MERGE_STORM_KM = 10;

function absorb(host: StormObject, extra: StormObject): StormObject {
  const n = host.nCells + extra.nCells;
  const cells = new Uint32Array(n);
  cells.set(host.cells);
  cells.set(extra.cells, host.nCells);
  const hostHeavier = host.maxDbz >= extra.maxDbz;
  const firstSeen =
    Date.parse(extra.firstSeen) < Date.parse(host.firstSeen)
      ? extra.firstSeen
      : host.firstSeen;
  const areaDelta =
    host.areaDeltaKm2 == null && extra.areaDeltaKm2 == null
      ? null
      : Math.round(
          ((host.areaDeltaKm2 ?? 0) + (extra.areaDeltaKm2 ?? 0)) * 10
        ) / 10;
  return {
    ...host,
    nCells: n,
    areaKm2: Math.round((host.areaKm2 + extra.areaKm2) * 10) / 10,
    maxDbz: hostHeavier ? host.maxDbz : extra.maxDbz,
    coreLon: hostHeavier ? host.coreLon : extra.coreLon,
    coreLat: hostHeavier ? host.coreLat : extra.coreLat,
    centroidLon:
      (host.centroidLon * host.nCells + extra.centroidLon * extra.nCells) / n,
    centroidLat:
      (host.centroidLat * host.nCells + extra.centroidLat * extra.nCells) / n,
    firstSeen,
    ageMin:
      host.ageMin == null && extra.ageMin == null
        ? null
        : Math.max(host.ageMin ?? 0, extra.ageMin ?? 0),
    ageFloor: host.ageFloor || extra.ageFloor,
    motionTowardDeg: host.motionTowardDeg ?? extra.motionTowardDeg,
    motionKmh:
      host.motionTowardDeg != null ? host.motionKmh : extra.motionKmh,
    areaDeltaKm2: areaDelta,
    cells,
    geometry: host.geometry.concat(extra.geometry),
  };
}

/**
 * Storms the candidate map draws a core and a heading for.
 *
 * Isolated echoes under {@link MIN_DRAWN_STORM_KM2} are dropped. Specks
 * that sit within {@link MERGE_STORM_KM} of a larger echo are absorbed
 * into it. A cluster of specks that together clear the floor is kept as
 * one storm. Identify itself is unchanged, so a click still reports the
 * 1 km object under the point.
 */
export function drawnStorms(storms: StormObject[]): StormObject[] {
  const n = storms.length;
  if (n === 0) return [];
  const parent = new Int32Array(n);
  for (let i = 0; i < n; i++) parent[i] = i;
  const findRoot = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  const unite = (a: number, b: number) => {
    const ra = findRoot(a);
    const rb = findRoot(b);
    if (ra !== rb) parent[rb] = ra;
  };

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = storms[i];
      const b = storms[j];
      const small =
        a.areaKm2 < MIN_DRAWN_STORM_KM2 || b.areaKm2 < MIN_DRAWN_STORM_KM2;
      if (!small) continue;
      if (
        km(a.centroidLat, a.centroidLon, b.centroidLat, b.centroidLon) <=
        MERGE_STORM_KM
      ) {
        unite(i, j);
      }
    }
  }

  const groups = new Map<number, StormObject[]>();
  for (let i = 0; i < n; i++) {
    const root = findRoot(i);
    const list = groups.get(root);
    if (list) list.push(storms[i]);
    else groups.set(root, [storms[i]]);
  }

  const out: StormObject[] = [];
  for (const group of groups.values()) {
    group.sort((a, b) => b.areaKm2 - a.areaKm2);
    const merged = group.reduce(absorb);
    if (merged.areaKm2 >= MIN_DRAWN_STORM_KM2) out.push(merged);
  }
  return out;
}

function objectPolygon(
  cells: number[],
  grid: Grid,
  geo: Geo,
  style: RingStyle = MAP_STYLE
): ContourRing[][] {
  const { nx, ny } = grid;
  let i0 = nx;
  let i1 = -1;
  let j0 = ny;
  let j1 = -1;
  const set = new Set(cells);
  for (const k of cells) {
    const i = k % nx;
    const j = Math.floor(k / nx);
    if (i < i0) i0 = i;
    if (i > i1) i1 = i;
    if (j < j0) j0 = j;
    if (j > j1) j1 = j;
  }
  i0 = Math.max(0, i0 - 1);
  j0 = Math.max(0, j0 - 1);
  i1 = Math.min(nx - 1, i1 + 1);
  j1 = Math.min(ny - 1, j1 + 1);
  const ox = i1 - i0 + 1;
  const oy = j1 - j0 + 1;
  const mask = new Float32Array(ox * oy);
  const lats = new Float32Array(ox * oy);
  const lons = new Float32Array(ox * oy);
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) {
      const k = j * nx + i;
      const o = (j - j0) * ox + (i - i0);
      mask[o] = set.has(k) ? 1 : 0;
      lats[o] = geo.lats[k];
      lons[o] = geo.lons[k];
    }
  }
  return polygons(
    { nx: ox, ny: oy, values: mask },
    { nx: ox, ny: oy, lats, lons },
    1,
    style
  );
}

/**
 * Give `next` the ids of `prev` when the centroid has not jumped more than
 * `MATCH_KM`. Unmatched storms get new ids from `nextId`.
 */
export function matchTracks(
  prev: StormObject[],
  next: StormObject[],
  prevTime: string,
  nextTime: string,
  nextId: { value: number }
): StormObject[] {
  const dtH =
    (Date.parse(nextTime) - Date.parse(prevTime)) / 3_600_000;
  const used = new Set<number>();
  const out: StormObject[] = [];
  for (const storm of next) {
    let best: { prev: StormObject; dist: number } | null = null;
    for (const was of prev) {
      if (used.has(was.id)) continue;
      const dist = km(
        storm.centroidLat,
        storm.centroidLon,
        was.centroidLat,
        was.centroidLon
      );
      if (dist > MATCH_KM) continue;
      if (!best || dist < best.dist) best = { prev: was, dist };
    }
    if (!best) {
      out.push({ ...storm, id: nextId.value++ });
      continue;
    }
    used.add(best.prev.id);
    const ageMin = Math.round(
      (Date.parse(nextTime) - Date.parse(best.prev.firstSeen)) / 60_000
    );
    const moving = best.dist > 0.1 && dtH > 0;
    out.push({
      ...storm,
      id: best.prev.id,
      firstSeen: best.prev.firstSeen,
      ageMin,
      ageFloor: best.prev.ageFloor,
      motionTowardDeg: moving
        ? Math.round(
            bearingDeg(
              best.prev.centroidLat,
              best.prev.centroidLon,
              storm.centroidLat,
              storm.centroidLon
            )
          )
        : null,
      motionKmh: moving ? Math.round(best.dist / dtH) : null,
      areaDeltaKm2:
        Math.round((storm.areaKm2 - best.prev.areaKm2) * 10) / 10,
    });
  }
  return out;
}

/** True when B sits on the side A is moving away from. */
export function upwindOf(
  fromLat: number,
  fromLon: number,
  toLat: number,
  toLon: number,
  motionTowardDeg: number
): boolean {
  const upwind = (motionTowardDeg + 180) % 360;
  const deg = bearingDeg(fromLat, fromLon, toLat, toLon);
  let delta = Math.abs(deg - upwind);
  if (delta > 180) delta = 360 - delta;
  return delta <= 90;
}

function boundaryCells(
  storm: StormObject,
  grid: Grid,
  threshold: number
): number[] {
  const { nx, ny, values } = grid;
  const member = new Set(storm.cells);
  const quiet = (k: number) =>
    !member.has(k) && values[k] < threshold && values[k] > -900;
  const edge: number[] = [];
  for (const k of storm.cells) {
    const i = k % nx;
    const j = Math.floor(k / nx);
    if (i === 0 || i === nx - 1 || j === 0 || j === ny - 1) continue;
    if (quiet(k - 1) || quiet(k + 1) || quiet(k - nx) || quiet(k + nx)) {
      edge.push(k);
    }
  }
  return edge;
}

function nearestKm(
  lat: number,
  lon: number,
  keys: ArrayLike<number>,
  geo: Geo
): number {
  let best = Infinity;
  for (let n = 0; n < keys.length; n++) {
    const k = keys[n];
    const d = km(lat, lon, geo.lats[k], geo.lons[k]);
    if (d < best) best = d;
  }
  return best;
}

/** Shortest distance from a point to a segment, all in kilometres. */
function segmentKm(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const span = dx * dx + dy * dy;
  // A zero-length segment is a repeated vertex, which rounding can produce.
  const t =
    span === 0
      ? 0
      : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / span));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Whether a point sits inside a closed ring, lon/lat, even-odd. */
function inRing(ring: ContourRing, lon: number, lat: number): boolean {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    ) {
      odd = !odd;
    }
  }
  return odd;
}

/**
 * Inside the exterior ring and not inside a hole — GeoJSON ring order, so the
 * first ring is the exterior and the rest are holes. A click in the hole of a
 * ring of rain is outside the rain, and its distance is to the hole's edge.
 */
function inPolygon(rings: ContourRing[], lon: number, lat: number): boolean {
  if (rings.length === 0) return false;
  if (!inRing(rings[0], lon, lat)) return false;
  for (let k = 1; k < rings.length; k++) {
    if (inRing(rings[k], lon, lat)) return false;
  }
  return true;
}

/**
 * How far a point is from the nearest edge of a drawn shape, in kilometres,
 * and which side of that edge it is on. Null when the shape has no ring.
 *
 * Measured against the ring itself rather than against the cells behind it,
 * so the number is the distance to the boundary the map painted. Flat earth,
 * on a plane tangent at the point being measured from, like {@link km}: over
 * the tens of kilometres this is asked about, the curvature is metres.
 */
export function edgeDistance(
  geometry: ContourRing[][],
  lat: number,
  lon: number
): { inside: boolean; km: number } | null {
  const squeeze = Math.cos((lat * Math.PI) / 180);
  const x = (lon: number) => lon * KM_PER_DEG * squeeze;
  const y = (lat: number) => lat * KM_PER_DEG;
  const px = x(lon);
  const py = y(lat);

  let inside = false;
  let best = Infinity;
  for (const rings of geometry) {
    if (inPolygon(rings, lon, lat)) inside = true;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const d = segmentKm(
          px,
          py,
          x(ring[j][0]),
          y(ring[j][1]),
          x(ring[i][0]),
          y(ring[i][1])
        );
        if (d < best) best = d;
      }
    }
  }
  return Number.isFinite(best) ? { inside, km: best } : null;
}

/** How far from the rain a click may land and still be given that storm. */
export const NEAR_LIMIT_KM = 40;

/**
 * The nearest drawn storm to `lat`/`lon`, and where on that storm the click
 * landed. Null when no drawn storm has rain within {@link NEAR_LIMIT_KM}.
 *
 * Nearest is measured to the storm's raining cells, not to its centroid. A
 * centroid is a point a long squall line does not pass through, so measuring
 * to it hands a click on the edge of the line to a round shower 30 km away.
 * A click inside the rain is nought kilometres from a cell of the storm it is
 * in, so the same rule picks that storm without a separate test for it.
 *
 * Where the click sits on that storm is `edgeKm`: how far it is from the
 * nearest edge of the ring the radar layer draws, with `inside` saying which
 * side of the ring it is on. Texas seeds the flank, so the reading an
 * operator wants is a short distance to the boundary, not a long one from
 * the heaviest rain. It is measured against the drawn ring itself, so it
 * cannot disagree with the outline on the screen. The distance to the
 * strongest cell rides along beside it, unjudged.
 */
export function near(
  lat: number,
  lon: number,
  storms: StormObject[],
  geo: Geo,
  validTime: string
): StormNear | null {
  const drawn = storms.filter((storm) => storm.geometry.length > 0);
  let chosen: StormObject | null = null;
  let best = Infinity;
  for (const storm of drawn) {
    const d = nearestKm(lat, lon, storm.cells, geo);
    if (d < best) {
      best = d;
      chosen = storm;
    }
  }
  if (!chosen || best > NEAR_LIMIT_KM) return null;

  const edge = edgeDistance(chosen.geometry, lat, lon);
  return {
    validTime,
    object: chosen,
    coreKm: km(lat, lon, chosen.coreLat, chosen.coreLon),
    inside: edge?.inside ?? false,
    edgeKm: edge ? edge.km : null,
  };
}

/**
 * Cells that touch this storm and are below `threshold`, but that a radar
 * actually looked at. No-coverage sentinels stay out: nobody saw those.
 */
export function quietRing(
  storm: StormObject,
  grid: Grid,
  threshold: number
): number[] {
  const { nx, ny, values } = grid;
  const member = new Set(storm.cells);
  const ring = new Set<number>();
  const step = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];
  for (const k of storm.cells) {
    const i = k % nx;
    const j = Math.floor(k / nx);
    for (const [di, dj] of step) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || ni >= nx || nj < 0 || nj >= ny) continue;
      const nk = nj * nx + ni;
      if (member.has(nk)) continue;
      // Below rain, but not "no radar": −999 is uncovered ground.
      if (values[nk] < threshold && values[nk] > -900) ring.add(nk);
    }
  }
  return [...ring];
}

/**
 * The quiet, covered cells on the side this storm is moving away from.
 * Empty when the storm has no motion: we do not guess an inflow side.
 */
export function upwindRing(
  storm: StormObject,
  grid: Grid,
  geo: Geo,
  threshold: number
): number[] {
  if (storm.motionTowardDeg === null) return [];
  const toward = storm.motionTowardDeg;
  return quietRing(storm, grid, threshold).filter((k) =>
    upwindOf(storm.coreLat, storm.coreLon, geo.lats[k], geo.lons[k], toward)
  );
}

/**
 * Raining cells on the upwind edge of this storm. The flank, still ≥20 dBZ,
 * not the no-rain ground outside it. Empty when the storm has no motion.
 */
export function upwindBoundary(
  storm: StormObject,
  grid: Grid,
  geo: Geo,
  threshold: number
): number[] {
  if (storm.motionTowardDeg === null) return [];
  const toward = storm.motionTowardDeg;
  return boundaryCells(storm, grid, threshold).filter((k) =>
    upwindOf(storm.coreLat, storm.coreLon, geo.lats[k], geo.lons[k], toward)
  );
}

export function coresFrame(
  validTime: string,
  storms: StormObject[]
): {
  type: "FeatureCollection";
  validTime: string;
  features: {
    type: "Feature";
    properties: { stormId: number; maxDbz: number };
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
} {
  return {
    type: "FeatureCollection",
    validTime,
    features: storms.map((storm) => ({
      type: "Feature" as const,
      properties: { stormId: storm.id, maxDbz: storm.maxDbz },
      geometry: {
        type: "Point" as const,
        coordinates: [storm.coreLon, storm.coreLat],
      },
    })),
  };
}

export function flankFrame(
  validTime: string,
  storms: StormObject[],
  grid: Grid,
  geo: Geo,
  threshold: number
): StormFrame {
  return {
    type: "FeatureCollection",
    validTime,
    features: storms.flatMap((storm) => {
      const cells = upwindBoundary(storm, grid, geo, threshold);
      if (cells.length === 0) return [];
      const geometry = objectPolygon(cells, grid, geo);
      if (geometry.length === 0) return [];
      return [
        {
          type: "Feature" as const,
          properties: {
            stormId: storm.id,
            maxDbz: storm.maxDbz,
            areaKm2: storm.areaKm2,
            ageMin: storm.ageMin,
            motionTowardDeg: storm.motionTowardDeg,
            motionKmh: storm.motionKmh,
            areaDeltaKm2: storm.areaDeltaKm2,
            coreLon: storm.coreLon,
            coreLat: storm.coreLat,
          },
          geometry: { type: "MultiPolygon" as const, coordinates: geometry },
        },
      ];
    }),
  };
}

export function frame(validTime: string, storms: StormObject[]): StormFrame {
  return {
    type: "FeatureCollection",
    validTime,
    features: storms
      .filter((storm) => storm.geometry.length > 0)
      .map((storm) => ({
        type: "Feature" as const,
        properties: {
          stormId: storm.id,
          maxDbz: storm.maxDbz,
          areaKm2: storm.areaKm2,
          ageMin: storm.ageMin,
          motionTowardDeg: storm.motionTowardDeg,
          motionKmh: storm.motionKmh,
          areaDeltaKm2: storm.areaDeltaKm2,
          coreLon: storm.coreLon,
          coreLat: storm.coreLat,
        },
        geometry: { type: "MultiPolygon" as const, coordinates: storm.geometry },
      })),
  };
}

/**
 * Point `km` along `towardDeg` from a lat/lon. Bearing is clockwise from
 * north, the same as `motionTowardDeg`.
 */
export function destPoint(
  lat: number,
  lon: number,
  towardDeg: number,
  km: number
): [number, number] {
  const rad = (towardDeg * Math.PI) / 180;
  const dlat = (km * Math.cos(rad)) / KM_PER_DEG;
  const dlon =
    (km * Math.sin(rad)) /
    (KM_PER_DEG * Math.cos((lat * Math.PI) / 180));
  return [lon + dlon, lat + dlat];
}

/** Heading-tick length, km. Follows speed; clamped so a crawl is still drawn. */
export function motionLengthKm(motionKmh: number): number {
  return Math.min(12, Math.max(3, motionKmh / 10));
}

/**
 * Shaft and head widths, km. Constant, so only the tick's length follows
 * speed. Scaling the width with the length made fast storms look fatter,
 * not just longer.
 */
export const MOTION_SHAFT_HALF_KM = 0.35;
export const MOTION_HEAD_HALF_KM = 1.1;
/** Head length along the tick, km. Capped so a short tick is still a dart. */
export const MOTION_HEAD_KM = 2;

/**
 * A filled dart from the core along the heading, in lon/lat. Length
 * follows speed. Width does not.
 */
export function motionArrow(
  lat: number,
  lon: number,
  towardDeg: number,
  km: number
): [number, number][] {
  const headKm = Math.min(MOTION_HEAD_KM, km * 0.4);
  const shaftKm = km - headKm;
  const left = towardDeg - 90;
  const right = towardDeg + 90;
  const neck = destPoint(lat, lon, towardDeg, shaftKm);
  const tip = destPoint(lat, lon, towardDeg, km);
  const neckLat = neck[1];
  const neckLon = neck[0];
  const startL = destPoint(lat, lon, left, MOTION_SHAFT_HALF_KM);
  const startR = destPoint(lat, lon, right, MOTION_SHAFT_HALF_KM);
  const neckL = destPoint(neckLat, neckLon, left, MOTION_SHAFT_HALF_KM);
  const neckR = destPoint(neckLat, neckLon, right, MOTION_SHAFT_HALF_KM);
  const wingL = destPoint(neckLat, neckLon, left, MOTION_HEAD_HALF_KM);
  const wingR = destPoint(neckLat, neckLon, right, MOTION_HEAD_HALF_KM);
  return [startL, neckL, wingL, tip, wingR, neckR, startR, startL];
}

/**
 * Match storms forward through a chain of mosaics, oldest first, so
 * `firstSeen` is the earliest scan the centroid still matches.
 */
export function foldTracks(
  scans: { time: string; storms: StormObject[] }[]
): StormObject[] {
  if (scans.length === 0) return [];
  let storms = scans[0].storms;
  let time = scans[0].time;
  const nextId = {
    value: storms.reduce((max, s) => Math.max(max, s.id), 0) + 1,
  };
  for (let i = 1; i < scans.length; i++) {
    storms = matchTracks(
      storms,
      scans[i].storms,
      time,
      scans[i].time,
      nextId
    );
    time = scans[i].time;
  }
  if (scans.length === 1) return storms;
  const oldest = scans[0].time;
  return storms.map((storm) =>
    storm.firstSeen === oldest ? { ...storm, ageFloor: true } : storm
  );
}

/**
 * The same tick as {@link motionArrow}, as a two-point line: the core and
 * the point `km` along the heading.
 *
 * The dart carries its width in kilometres, which is what a painted map
 * wants — it stays the same width against the storm at any scale. A screen
 * wants the opposite: a line drawn a fixed number of pixels wide, so the
 * tick reads as a tick zoomed in on one cell and not as a wedge. Both are
 * the same tick, and the caller says which it is drawing on.
 */
export function motionSegment(
  lat: number,
  lon: number,
  towardDeg: number,
  km: number
): [number, number][] {
  return [[lon, lat], destPoint(lat, lon, towardDeg, km)];
}

export type MotionShape = "dart" | "line";

export function motionFrame(
  validTime: string,
  storms: StormObject[],
  shape: MotionShape = "dart"
): {
  type: "FeatureCollection";
  validTime: string;
  features: {
    type: "Feature";
    properties: {
      stormId: number;
      motionTowardDeg: number;
      motionKmh: number;
    };
    geometry:
      | { type: "Polygon"; coordinates: [number, number][][] }
      | { type: "LineString"; coordinates: [number, number][] };
  }[];
} {
  return {
    type: "FeatureCollection",
    validTime,
    features: storms.flatMap((storm) => {
      if (storm.motionTowardDeg === null || storm.motionKmh === null) {
        return [];
      }
      if (storm.motionKmh < 1) return [];
      const km = motionLengthKm(storm.motionKmh);
      return [
        {
          type: "Feature" as const,
          properties: {
            stormId: storm.id,
            motionTowardDeg: storm.motionTowardDeg,
            motionKmh: storm.motionKmh,
          },
          geometry:
            shape === "line"
              ? {
                  type: "LineString" as const,
                  coordinates: motionSegment(
                    storm.coreLat,
                    storm.coreLon,
                    storm.motionTowardDeg,
                    km
                  ),
                }
              : {
                  type: "Polygon" as const,
                  coordinates: [
                    motionArrow(
                      storm.coreLat,
                      storm.coreLon,
                      storm.motionTowardDeg,
                      km
                    ),
                  ],
                },
        },
      ];
    }),
  };
}

/** JSON for one nearby object, without the cell list. */
export function nearJson(reading: StormNear) {
  const { object, ...rest } = reading;
  return {
    ...rest,
    object: {
      id: object.id,
      firstSeen: object.firstSeen,
      nCells: object.nCells,
      areaKm2: object.areaKm2,
      maxDbz: object.maxDbz,
      coreLon: object.coreLon,
      coreLat: object.coreLat,
      centroidLon: object.centroidLon,
      centroidLat: object.centroidLat,
      ageMin: object.ageMin,
      ageFloor: object.ageFloor,
      motionTowardDeg: object.motionTowardDeg,
      motionKmh: object.motionKmh,
      areaDeltaKm2: object.areaDeltaKm2,
      geometry: object.geometry,
    },
  };
}
