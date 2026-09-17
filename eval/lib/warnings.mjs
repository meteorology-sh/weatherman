/**
 * The NWS warnings in force at an analysis, as the eval map stores them.
 *
 * The same route the replay map reads, `/warnings/severe`, kept whole per
 * warning so the map can draw each polygon and the panel can count each kind.
 * Nothing is scored against these: no seeding test reads the layer.
 */

/** Three decimals is about 100 m, the precision every other mark is stored at. */
const round = (value) => Math.round(value * 1000) / 1000;

/** A warning's outer and inner rings, whether it came as one polygon or many. */
function ringsOf(geometry) {
  if (!geometry) return [];
  const polygons =
    geometry.type === "MultiPolygon"
      ? geometry.coordinates
      : geometry.type === "Polygon"
        ? [geometry.coordinates]
        : [];
  return polygons.flatMap((polygon) =>
    polygon
      .map((ring) => ring.map(([lon, lat]) => [round(lon), round(lat)]))
      .filter((ring) => ring.length >= 4)
  );
}

/** A `/warnings/severe` frame, as `marks[hour].warnings`. */
export function warningsOf(frame) {
  return {
    validTime: frame.validTime ?? null,
    warnings: (frame.features ?? [])
      .map((feature) => ({
        phenomenon: feature.properties?.phenomenon,
        event: feature.properties?.event,
        office: feature.properties?.office,
        eventId: feature.properties?.eventId,
        rings: ringsOf(feature.geometry),
      }))
      .filter((warning) => warning.rings.length > 0),
  };
}

/** The route, for one analysis and one program's window. */
export function warningsPath(at, window) {
  return (
    `/warnings/severe?at=${encodeURIComponent(at)}` +
    `&west=${window.west}&east=${window.east}` +
    `&south=${window.south}&north=${window.north}`
  );
}
