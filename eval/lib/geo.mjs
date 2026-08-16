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
