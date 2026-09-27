/**
 * The map window a GeoJSON layer asks the server to contour.
 *
 * The server still builds the national grid; each request names the
 * window to trace. The map holds a padded covering window and does not
 * replace it while the view sits inside, so zooming does not refetch.
 *
 * How finely that window is traced is a separate question from how much
 * of it is asked for, and `tracesNative` answers it.
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

/** HRRR's native cell, km. The finest ring there is to trace. */
export const CELL_KM = 3;

/** Ground a degree of longitude covers at the equator, km. */
const KM_PER_DEGREE_LON = 111.32;

/**
 * Whether this view is zoomed in far enough for native rings to be worth
 * tracing.
 *
 * A native cell earns its own ring only while it covers at least a screen
 * pixel. Wider than that the 4×4 average is not a compromise — it is the
 * finest thing the display can resolve, and native rings would be structure
 * below one pixel, fetched on every pan and never seen.
 *
 * The seeding opportunity is the layer that needs this. It is a gate, so
 * averaging it changes the decision rather than smoothing a gradient, and a
 * click reads the native cell whatever the map drew. Every zoom a program
 * actually works at sits well inside the native side of this; the coarse side
 * is the whole-country view, which is for finding weather rather than for
 * deciding where to fly.
 */
export function tracesNative(
  extent: { xmin: number; ymin: number; xmax: number; ymax: number },
  widthPixels: number
): boolean {
  if (!(widthPixels > 0)) return false;
  const { west, east, south, north } = lonLatExtent(extent);
  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180);
  const km = (east - west) * KM_PER_DEGREE_LON * squeeze;
  return km / widthPixels <= CELL_KM;
}

export function boxParams(box: MapBox): Record<string, string> {
  return {
    west: String(box.west),
    east: String(box.east),
    south: String(box.south),
    north: String(box.north),
  };
}
