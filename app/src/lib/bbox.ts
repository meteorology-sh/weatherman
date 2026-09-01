/**
 * The map window a GeoJSON layer asks the server to contour.
 *
 * The server still builds the national grid; each request names the
 * window to trace. The field stays native. The map holds a padded
 * covering window and does not replace it while the view sits inside,
 * so zooming does not refetch or restyle the rings.
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

const MAX_M = 20037508.342789244;

function mercatorToLonLat(x: number, y: number): [number, number] {
  const lon = (x / MAX_M) * 180;
  const lat =
    (Math.atan(Math.exp((y / MAX_M) * Math.PI)) * 360) / Math.PI - 90;
  return [lon, lat];
}

function lonLatExtent(extent: {
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
  return { west, east, south, north };
}

/**
 * The visible window, rounded out to 0.1°. Used only to test whether
 * the held request still covers what is on screen.
 */
export function viewFromExtent(extent: {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}): MapBox {
  const { west, east, south, north } = lonLatExtent(extent);
  return {
    west: Math.floor(west * 10) / 10,
    east: Math.ceil(east * 10) / 10,
    south: Math.floor(south * 10) / 10,
    north: Math.ceil(north * 10) / 10,
  };
}

/**
 * The window to ask the server for: 80% pad each side, rounded to 1°,
 * so two zoom steps in still sit inside it.
 */
export function requestFromExtent(extent: {
  xmin: number;
  ymin: number;
  xmax: number;
  ymax: number;
}): MapBox {
  const { west, east, south, north } = lonLatExtent(extent);
  const padX = (east - west) * 0.8;
  const padY = (north - south) * 0.8;
  return {
    west: Math.floor(west - padX),
    east: Math.ceil(east + padX),
    south: Math.floor(south - padY),
    north: Math.ceil(north + padY),
  };
}

export function covers(held: MapBox, view: MapBox): boolean {
  return (
    view.west >= held.west &&
    view.east <= held.east &&
    view.south >= held.south &&
    view.north <= held.north
  );
}

/**
 * Keep `held` while it covers the view. Otherwise ask for a new padded
 * window. Same object identity when nothing changes, so React can skip.
 */
export function heldBox(
  held: MapBox,
  extent: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  }
): MapBox {
  if (covers(held, viewFromExtent(extent))) return held;
  return requestFromExtent(extent);
}

export function boxParams(box: MapBox): Record<string, string> {
  return {
    west: String(box.west),
    east: String(box.east),
    south: String(box.south),
    north: String(box.north),
  };
}
