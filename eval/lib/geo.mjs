/**
 * The two pieces of geometry these scripts need, and nothing more.
 *
 * Projecting a bearing and a range onto the globe, because two programs
 * position their releases that way and never print a coordinate. And the
 * distance from a point to the nearest edge of a painted region, because that
 * is the whole measurement this evaluation makes.
 *
 * Clipping contour polygons to county boundaries properly would want a real
 * geometry library, and it is the wrong shape of answer anyway: the seeding
 * opportunity is a decision per 3 km cell, and a clipped polygon area would
 * report the smoothed edge of a band rather than the cells it was traced from.
 */

const KM_PER_NM = 1.852;
const EARTH_KM = 6371;

/**
 * Where a bearing and a range put a release.
 *
 * Great-circle rather than flat: at 50 nm a flat projection is off by a few
 * hundred meters, which is nothing against a 3 km cell, but the spherical form
 * is no harder and does not have to be explained.
 *
 * **The bearing is used as printed.** Two programs position their releases
 * this way and neither states whether the display was set to true or magnetic
 * north. The county each row names is not sharp enough to settle it either —
 * about six degrees of eastward rotation fits both records better, which is
 * what a magnetic display would look like and is also what a slightly wrong
 * origin would look like. So no rotation is applied, and the few kilometers
 * that question is worth stay in the number rather than being silently
 * corrected. `positions.mjs` is what measures the cost.
 */
export function project([lat0, lon0], bearingDeg, rangeNm) {
  const angular = (rangeNm * KM_PER_NM) / EARTH_KM;
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat0 * Math.PI) / 180;
  const lon1 = (lon0 * Math.PI) / 180;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing)
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2)
    );

  const round = (value) => Math.round(value * 10000) / 10000;
  return [round((lat2 * 180) / Math.PI), round((lon2 * 180) / Math.PI)];
}

/* ---------- how far a point is from a painted region ---------- */

const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LON = 111.32;

/**
 * Degrees to kilometers on a plane tangent at the point being measured from.
 *
 * Flat earth, like the grid module's own separation maths, and for the same
 * reason: the distances that matter here are tens of kilometers over west Texas,
 * where the error from ignoring curvature is meters. Anchoring the projection at
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

/** Whether a point sits inside a closed ring, lon/lat, even-odd. */
function inRing(ring, lon, lat) {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > lat !== yj > lat &&
      lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    )
      odd = !odd;
  }
  return odd;
}

/**
 * Inside the outer ring and not inside a hole — GeoJSON order, so the first
 * ring is the exterior and the rest are holes.
 */
function inPolygon(rings, lon, lat) {
  if (!rings.length) return false;
  if (!inRing(rings[0], lon, lat)) return false;
  for (let k = 1; k < rings.length; k++) {
    if (inRing(rings[k], lon, lat)) return false;
  }
  return true;
}

/**
 * Is a point inside a GeoJSON Polygon or MultiPolygon feature?
 *
 * The county boundaries are the only features asked this, and the question
 * they answer is whether a release landed in the county its own row named —
 * a check on the report's position that involves none of Weatherman's layers.
 */
export function inFeature(feature, lon, lat) {
  const { type, coordinates } = feature.geometry;
  const polygons = type === "Polygon" ? [coordinates] : coordinates;
  return polygons.some((rings) => inPolygon(rings, lon, lat));
}

/** Shortest distance from a point to a segment, all in kilometers. */
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
 * How far a point is from a set of polygons, in kilometers, and whether it is
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

/**
 * How much ground a painted level covers, km².
 *
 * The coverage cost of a rule, which is the number that decides whether a
 * change to the join selected better or just painted more. A fill that grows
 * until it covers the whole target area has stopped selecting, and the flare
 * counts alone cannot see that happen — every release is inside a fill that
 * covers everything.
 *
 * Spherical rather than projected: the painted window is 10° of longitude and
 * 8.5° of latitude, wide enough that a single flat projection would be several
 * percent wrong at its edges. This is the exact area of the polygon on the
 * sphere, so the figure does not depend on where in the window the paint sits.
 *
 * The first ring of a polygon is its outer boundary and the rest are holes,
 * which are subtracted. `polygons` is the shape a painted level carries.
 */
export function polygonsAreaKm2(polygons) {
  let total = 0;
  for (const rings of polygons) {
    rings.forEach((ring, index) => {
      const area = ringAreaKm2(ring);
      total += index === 0 ? area : -area;
    });
  }
  return total;
}

/** Area enclosed by one ring on the sphere, km², always positive. */
function ringAreaKm2(ring) {
  if (ring.length < 3) return 0;
  const rad = Math.PI / 180;
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [lonA, latA] = ring[j];
    const [lonB, latB] = ring[i];
    sum +=
      (lonB - lonA) * rad * (2 + Math.sin(latA * rad) + Math.sin(latB * rad));
  }
  return Math.abs((sum * EARTH_KM * EARTH_KM) / 2);
}

/** Area of a lon/lat box on the sphere, km² — the ground a paint was asked about. */
export function boxAreaKm2({ west, east, south, north }) {
  return ringAreaKm2([
    [west, south],
    [east, south],
    [east, north],
    [west, north],
    [west, south],
  ]);
}
