/**
 * The map window a GeoJSON layer asks the server to contour.
 *
 * Native CONUS polygons at 1–3 km overload the browser. The server still
 * builds the national grid; each request names the window to trace. This is
 * that window, as the view sees it.
 */

export type MapBox = {
  west: number;
  east: number;
  south: number;
  north: number;
};

/** Opening view: Texas plus a little padding. */
export const INITIAL_BOX: MapBox = {
  west: -107,
  east: -93,
  south: 25.5,
  north: 37,
};

/**
 * Layers draw at this zoom and closer. Further out the country is still on
 * the basemap; the weather is not painted, so a CONUS view cannot fetch a
 * native national frame.
 */
export const LAYER_MIN_ZOOM = 5;

const MAX_M = 20037508.342789244;

function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x / MAX_M) * 180;
  const lat =
    (Math.atan(Math.exp((y / MAX_M) * Math.PI)) * 360) / Math.PI - 90;
  return [lon, lat];
}

const round = (n: number) => Math.round(n * 10) / 10;

/**
 * The view's visible window, padded and rounded so a small pan does not
 * refetch. Null when the view has no extent yet.
 */
export function boxFromExtent(extent: {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}): MapBox {
  let west = extent.xmin;
  let east = extent.xmax;
  let south = extent.ymin;
  let north = extent.ymax;
  if (Math.abs(west) > 180 || Math.abs(east) > 180) {
    [west, south] = mercatorToLonLat(extent.xmin, extent.ymin);
    [east, north] = mercatorToLonLat(extent.xmax, extent.ymax);
  }
  const padX = (east - west) * 0.15;
  const padY = (north - south) * 0.15;
  return {
    west: round(west - padX),
    east: round(east + padX),
    south: round(south - padY),
    north: round(north + padY),
  };
}

export function boxParams(box: MapBox): Record<string, string> {
  return {
    west: String(box.west),
    east: String(box.east),
    south: String(box.south),
    north: String(box.north),
  };
}
