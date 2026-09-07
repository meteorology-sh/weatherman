export type Extent = {
  west: number;
  east: number;
  south: number;
  north: number;
};

export type Fitted = { extent: Extent; width: number; height: number };

/**
 * Grow an extent until it fills the width it is given.
 *
 * **The shape of a day's flying should not decide how much screen it gets.** A
 * program working one county produces a tall, narrow extent, and drawing it
 * at its own aspect left the map a sliver down one side of the page — the same
 * thirteen releases, a sixth of the area, and far harder to read than a day
 * whose releases happened to spread east to west.
 *
 * So the extent is padded to the aspect the page can show, and **only ever
 * padded**. Cropping to fit would drop ground that releases or contours sit in,
 * which on a page about where things are is not a cosmetic difference. Padding
 * costs nothing but context: a small target area ends up with more of the
 * surrounding counties visible, which is the right trade for a map whose job is
 * to say where something happened.
 *
 * Longitude is squeezed by the cosine of the middle latitude throughout, so the
 * aspect being matched is ground shape rather than degrees.
 */
export function fitExtent(
  extent: Extent,
  width: number,
  minHeight: number,
  maxHeight: number
): Fitted {
  const midLat = (extent.south + extent.north) / 2;
  const squeeze = Math.cos((midLat * Math.PI) / 180);

  const dLon = extent.east - extent.west;
  const dLat = extent.north - extent.south;
  const midLon = (extent.west + extent.east) / 2;

  // Ground width over ground height. This is what the pixel box has to match.
  const aspect = (dLon * squeeze) / dLat;
  const height = width / aspect;

  // Too tall for the page: widen the ground until the box is short enough.
  if (height > maxHeight) {
    const wanted = (width / maxHeight) * dLat;
    const grown = wanted / squeeze;
    return {
      extent: {
        west: midLon - grown / 2,
        east: midLon + grown / 2,
        south: extent.south,
        north: extent.north,
      },
      width,
      height: maxHeight,
    };
  }

  // Too short to read: deepen the ground until the box has some height to it.
  if (height < minHeight) {
    const grown = (dLon * squeeze * minHeight) / width;
    return {
      extent: {
        west: extent.west,
        east: extent.east,
        south: midLat - grown / 2,
        north: midLat + grown / 2,
      },
      width,
      height: minHeight,
    };
  }

  return { extent, width, height };
}
