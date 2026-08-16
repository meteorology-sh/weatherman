// Types
import type { DomainRing } from "./types";

/**
 * Whether a point falls inside a closed ring.
 *
 * The standard ray cast: count the ring's edges that cross a horizontal line
 * east of the point, and an odd count means inside. Pure arithmetic on
 * [lon, lat] pairs — no projection, no ArcGIS — so it is testable on a square
 * you can read.
 *
 * Degrees are compared directly, which is exact here for the same reason the
 * server's edge test is: the ring is HRRR's grid boundary and the question is
 * only ever which side of it a click landed on, not how far.
 */
export function insideRing(
  ring: DomainRing,
  lon: number,
  lat: number
): boolean {
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
