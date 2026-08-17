/**
 * The two pieces of geometry the harness needs, and nothing more.
 *
 * Clipping contour polygons to county boundaries properly would want a real
 * geometry library. It is also the wrong shape of answer: the candidate field
 * is a decision per 12 km cell, and a clipped polygon area would report the
 * smoothed edge of a band rather than the cells it was traced from.
 *
 * So the target area is measured by sampling instead — a lattice of points
 * inside the counties, each asked of the join, deduplicated by the cell the
 * join answered from. That counts cells, which is what the field is made of.
 */

/** Ray casting, on one ring. Longitude is x, latitude is y. */
function inRing(ring, lon, lat) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const straddles = yi > lat !== yj > lat;
    if (straddles && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** A GeoJSON polygon: outer ring minus its holes. */
function inPolygon(rings, lon, lat) {
  if (!inRing(rings[0], lon, lat)) return false;
  return rings.slice(1).every((hole) => !inRing(hole, lon, lat));
}

/** Point in a `Polygon` or `MultiPolygon` feature. */
export function inFeature(feature, lon, lat) {
  const { type, coordinates } = feature.geometry;
  if (type === "Polygon") return inPolygon(coordinates, lon, lat);
  if (type === "MultiPolygon") {
    return coordinates.some((rings) => inPolygon(rings, lon, lat));
  }
  throw new Error(`cannot test a ${type}`);
}

/** The first feature containing the point, or null. */
export function locate(features, lon, lat) {
  return features.find((feature) => inFeature(feature, lon, lat)) ?? null;
}

/* ---------- how far a point is from a painted region ---------- */

const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LON = 111.32;

/**
 * Degrees to kilometres on a plane tangent at the point being measured from.
 *
 * Flat earth, like the grid module's own separation maths, and for the same
 * reason: the distances that matter here are tens of kilometres over west Texas,
 * where the error from ignoring curvature is metres. Anchoring the projection at
 * the query point rather than at a fixed origin keeps it that way however far
 * the ring extends.
 */
function planeAt(lat0) {
  const squeeze = Math.cos((lat0 * Math.PI) / 180);
  return (lon, lat) => [
    lon * KM_PER_DEGREE_LON * squeeze,
    lat * KM_PER_DEGREE_LAT,
  ];
}

/** Shortest distance from a point to a segment, all in kilometres. */
function toSegment(px, py, ax, ay, bx, by) {
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

/**
 * How far a point is from a set of polygons, in kilometres, and whether it is
 * inside one.
 *
 * **Zero when inside, and the distance to the nearest edge when not.** This is
 * the whole reorientation: asking whether a flare landed in the paint gives one
 * bit and throws away how badly it missed, and a release 3 km outside a contour
 * is a different result from one 80 km away. Only the distance can tell them
 * apart.
 *
 * `polygons` is the shape a painted level carries — a list of polygons, each a
 * list of rings, the first the outer boundary and the rest holes. A point in a
 * hole is outside the region and is measured to the hole's edge, which is what
 * makes a donut read as a donut.
 */
export function distanceToPolygonsKm(polygons, lon, lat) {
  const project = planeAt(lat);
  const [px, py] = project(lon, lat);

  let inside = false;
  let best = Infinity;

  for (const rings of polygons) {
    if (inPolygon(rings, lon, lat)) inside = true;
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = project(ring[j][0], ring[j][1]);
        const [bx, by] = project(ring[i][0], ring[i][1]);
        const d = toSegment(px, py, ax, ay, bx, by);
        if (d < best) best = d;
      }
    }
  }

  if (best === Infinity) return { inside: false, km: null };
  return {
    inside,
    km: inside ? 0 : Math.round(best * 10) / 10,
    edgeKm: Math.round(best * 10) / 10,
  };
}

/** `[west, south, east, north]` over a FeatureCollection. */
export function bbox(features) {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (coordinates) => {
    if (typeof coordinates[0] === "number") {
      const [lon, lat] = coordinates;
      if (lon < west) west = lon;
      if (lon > east) east = lon;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      return;
    }
    for (const child of coordinates) visit(child);
  };

  for (const feature of features) visit(feature.geometry.coordinates);
  return [west, south, east, north];
}

/**
 * A lattice of sample points inside the given features.
 *
 * `stepDeg` should be finer than the 12 km grid so no cell is missed; the
 * caller deduplicates by the cell each point resolves to, so oversampling
 * costs cache-warm requests and nothing else.
 */
export function lattice(features, stepDeg) {
  const [west, south, east, north] = bbox(features);
  const points = [];

  for (let lat = south; lat <= north; lat += stepDeg) {
    for (let lon = west; lon <= east; lon += stepDeg) {
      const feature = locate(features, lon, lat);
      if (feature) {
        points.push({
          lat: Number(lat.toFixed(4)),
          lon: Number(lon.toFixed(4)),
          county: feature.properties.BASENAME,
        });
      }
    }
  }

  return points;
}
