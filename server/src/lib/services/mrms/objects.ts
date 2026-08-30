/**
 * Contiguous ≥20 dBZ regions on the MRMS mosaic, as objects with a track.
 *
 * Not TITAN: the mosaic is a 2D composite, so these have area, a max, a
 * centroid, and an age, not volume or precipitation mass. The polygon is the
 * mosaic cells that belonged to the cluster. Nothing is interpolated.
 */

// Services
import { polygons } from "../shared/contour";
import { nearestCell } from "../shared/grid";

// Types
import type { Grid, Geo, ContourRing } from "../shared/contour";

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
  /** Direction the centroid is moving toward, degrees. Null if still or new. */
  motionTowardDeg: number | null;
  motionKmh: number | null;
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
  /** The point falls in a cell that belongs to the object. */
  inside: boolean;
  /** Kilometres from the point to the strongest cell. */
  coreKm: number;
  /** Kilometres from the point to the nearest quiet-side edge. */
  edgeKm: number;
  /**
   * Kilometres to the edge on the upwind side, when the object has a motion.
   * Null if it is still or new.
   */
  upwindEdgeKm: number | null;
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

/**
 * 8-connected regions at or above `threshold`. The domain does not wrap: a
 * cell on the west edge does not see the east edge.
 */
export function identify(
  grid: Grid,
  geo: Geo,
  threshold: number,
  validTime: string
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
      motionTowardDeg: null,
      motionKmh: null,
      cells: Uint32Array.from(cells),
      geometry: objectPolygon(cells, grid, geo),
    });
  }
  return objects;
}

function objectPolygon(
  cells: number[],
  grid: Grid,
  geo: Geo
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
    1
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
    });
  }
  return out;
}

/** Even-odd test on one ring. Same rule the contourer uses to nest holes. */
function containsRing(ring: ContourRing, p: [number, number]): boolean {
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

/** True when the click sits in the polygon the map draws for this storm. */
export function pointInStorm(
  lon: number,
  lat: number,
  geometry: ContourRing[][]
): boolean {
  const p: [number, number] = [lon, lat];
  for (const polygon of geometry) {
    if (polygon.length === 0) continue;
    if (!containsRing(polygon[0], p)) continue;
    let hole = false;
    for (let h = 1; h < polygon.length; h++) {
      if (containsRing(polygon[h], p)) hole = true;
    }
    if (!hole) return true;
  }
  return false;
}

function boundaryCells(
  storm: StormObject,
  grid: Grid,
  threshold: number
): number[] {
  const { nx, ny, values } = grid;
  const member = new Set(storm.cells);
  const edge: number[] = [];
  for (const k of storm.cells) {
    const i = k % nx;
    const j = Math.floor(k / nx);
    const quiet =
      (i === 0 || values[k - 1] < threshold || !member.has(k - 1)) ||
      (i === nx - 1 || values[k + 1] < threshold || !member.has(k + 1)) ||
      (j === 0 || values[k - nx] < threshold || !member.has(k - nx)) ||
      (j === ny - 1 || values[k + nx] < threshold || !member.has(k + nx));
    if (quiet) edge.push(k);
  }
  return edge;
}

function nearestKm(
  lat: number,
  lon: number,
  keys: number[],
  geo: Geo
): number {
  let best = Infinity;
  for (const k of keys) {
    const d = km(lat, lon, geo.lats[k], geo.lons[k]);
    if (d < best) best = d;
  }
  return best;
}

/**
 * The object that contains `lat`/`lon`, or the nearest one. Null if the
 * cropped grid has no echo.
 */
export function near(
  lat: number,
  lon: number,
  storms: StormObject[],
  grid: Grid,
  geo: Geo,
  threshold: number,
  validTime: string
): StormNear | null {
  if (storms.length === 0) return null;
  const cell = nearestCell(geo, lat, lon);
  let inside: StormObject | null = null;
  for (const storm of storms) {
    if (
      storm.cells.includes(cell) ||
      pointInStorm(lon, lat, storm.geometry)
    ) {
      inside = storm;
      break;
    }
  }
  let chosen = inside;
  if (!chosen) {
    let best = Infinity;
    for (const storm of storms) {
      const d = km(lat, lon, storm.centroidLat, storm.centroidLon);
      if (d < best) {
        best = d;
        chosen = storm;
      }
    }
  }
  if (!chosen) return null;

  const edge = boundaryCells(chosen, grid, threshold);
  const edgeKm = nearestKm(lat, lon, edge, geo);
  let upwindEdgeKm: number | null = null;
  if (chosen.motionTowardDeg !== null && edge.length) {
    const upwind = (chosen.motionTowardDeg + 180) % 360;
    const upwindCells = edge.filter((k) => {
      const deg = bearingDeg(
        chosen.coreLat,
        chosen.coreLon,
        geo.lats[k],
        geo.lons[k]
      );
      let delta = Math.abs(deg - upwind);
      if (delta > 180) delta = 360 - delta;
      return delta <= 90;
    });
    if (upwindCells.length) {
      upwindEdgeKm = nearestKm(lat, lon, upwindCells, geo);
    }
  }

  return {
    validTime,
    object: chosen,
    inside: inside !== null,
    coreKm: km(lat, lon, chosen.coreLat, chosen.coreLon),
    edgeKm,
    upwindEdgeKm,
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
      const cells = quietRing(storm, grid, threshold);
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
          coreLon: storm.coreLon,
          coreLat: storm.coreLat,
        },
        geometry: { type: "MultiPolygon" as const, coordinates: storm.geometry },
      })),
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
      motionTowardDeg: object.motionTowardDeg,
      motionKmh: object.motionKmh,
      geometry: object.geometry,
    },
  };
}
