/**
 * Geolocation for the GOES-R ABI fixed grid.
 *
 * Pure trigonometry: no network, no HDF5, no GOES file. Everything here is
 * driven by the projection constants a scene carries in its
 * `goes_imager_projection` variable, so it is testable against hand-computed
 * points the way `contour.ts` is testable on hand-built grids.
 *
 * The one job is turning a geodetic lat/lon into the row and column of the
 * pixel that sees it. ABI does not publish a lat/lon per pixel — it publishes
 * two scan angles and the geometry to reconstruct them — so this is the
 * counterpart to the geo iterator we pay eccodes for on HRRR's Lambert grid.
 *
 * Formulas are the GOES-R Product Definition and User's Guide (PUG) Vol. 3
 * §5.1.2.8, "Navigating from geodetic latitude and longitude to ABI fixed grid".
 */

/** Projection constants, read from the scene rather than hardcoded. */
export type AbiGrid = {
  /** Longitude of the sub-satellite point, radians. */
  lon0: number;
  /** Distance from the earth's centre to the satellite, metres. */
  H: number;
  /** Equatorial and polar radii, metres. */
  rEq: number;
  rPol: number;
  /** First eccentricity squared, derived from the two radii. */
  e2: number;
  /** `x` (E/W scan angle) index -> radians: `raw * scale + offset`. */
  xScale: number;
  xOffset: number;
  /** `y` (N/S elevation angle) index -> radians. `yScale` is negative. */
  yScale: number;
  yOffset: number;
  /** Image dimensions, pixels. */
  nx: number;
  ny: number;
};

const DEG = Math.PI / 180;

/**
 * Build the grid from a scene's raw attribute values.
 *
 * `sweep` is asserted rather than assumed. ABI sweeps its x axis; Meteosat's
 * SEVIRI sweeps y, and the two conventions exchange the roles of the scan
 * angles. Reading a y-sweep image with these formulas would not fail, it would
 * silently transpose the sky.
 */
export function abiGrid(p: {
  lonOriginDeg: number;
  perspectiveHeight: number;
  semiMajor: number;
  semiMinor: number;
  sweep: string;
  xScale: number;
  xOffset: number;
  yScale: number;
  yOffset: number;
  nx: number;
  ny: number;
}): AbiGrid {
  if (p.sweep !== "x") {
    throw new Error(`ABI grid expects sweep_angle_axis "x", got "${p.sweep}"`);
  }
  return {
    lon0: p.lonOriginDeg * DEG,
    // The attribute is height above the ellipsoid; the formulas want distance
    // from the centre.
    H: p.perspectiveHeight + p.semiMajor,
    rEq: p.semiMajor,
    rPol: p.semiMinor,
    e2: (p.semiMajor ** 2 - p.semiMinor ** 2) / p.semiMajor ** 2,
    xScale: p.xScale,
    xOffset: p.xOffset,
    yScale: p.yScale,
    yOffset: p.yOffset,
    nx: p.nx,
    ny: p.ny,
  };
}

/**
 * Scan angles (x, y) in radians for a geodetic point, or null when the point is
 * over the earth's horizon from the satellite.
 *
 * The visibility test is not decoration. Without it the arithmetic still
 * returns a finite pair of angles for points on the far side of the planet,
 * which would fold Asia onto the edge of a CONUS scene.
 */
export function scanAngles(
  grid: AbiGrid,
  latDeg: number,
  lonDeg: number
): [number, number] | null {
  const lat = latDeg * DEG;
  const lon = lonDeg * DEG;

  // Geocentric latitude: the ellipsoid means the local vertical does not pass
  // through the earth's centre, and at 45 N the difference is ~11 arcminutes.
  const latC = Math.atan((grid.rPol ** 2 / grid.rEq ** 2) * Math.tan(lat));
  const cosLatC = Math.cos(latC);
  const rc = grid.rPol / Math.sqrt(1 - grid.e2 * cosLatC ** 2);

  const dLon = lon - grid.lon0;
  const sx = grid.H - rc * cosLatC * Math.cos(dLon);
  const sy = -rc * cosLatC * Math.sin(dLon);
  const sz = rc * Math.sin(latC);

  // Over the horizon: the line of sight would leave through the far side.
  if (
    grid.H * (grid.H - sx) <
    sy ** 2 + (grid.rEq ** 2 / grid.rPol ** 2) * sz ** 2
  ) {
    return null;
  }

  return [
    Math.asin(-sy / Math.sqrt(sx ** 2 + sy ** 2 + sz ** 2)),
    Math.atan(sz / sx),
  ];
}

/**
 * Pixel (col, row) for a geodetic point, or null when it is over the horizon or
 * outside this sector's image.
 *
 * The sector bound matters as much as the horizon one: CONUS is a crop of the
 * full disk, so a point in Alaska is perfectly visible to the satellite and
 * still absent from the file.
 */
export function pixelAt(
  grid: AbiGrid,
  latDeg: number,
  lonDeg: number
): [number, number] | null {
  const angles = scanAngles(grid, latDeg, lonDeg);
  if (!angles) return null;
  const [x, y] = angles;

  // The x and y coordinate arrays are exactly linear in the index, so this
  // inverts them rather than searching.
  const col = Math.round((x - grid.xOffset) / grid.xScale);
  const row = Math.round((y - grid.yOffset) / grid.yScale);

  if (col < 0 || col >= grid.nx || row < 0 || row >= grid.ny) return null;
  return [col, row];
}
