/**
 * The five Texas rain-enhancement permit areas this map is for.
 *
 * Bounding boxes from the 2025 evaluation windows — the ground those
 * programmes fly, not the whole HRRR domain. A cell is in the permits
 * if it sits in any one box. The boxes overlap; that is fine.
 *
 * Cited from the TDLR programme list, not from a coverage table.
 */

import { inBox } from "./grid";
import type { LonLatBox } from "./grid";

export const PERMIT_BOXES: readonly LonLatBox[] = [
  // West Texas Weather Modification Association
  { west: -106, east: -96, south: 27.5, north: 36 },
  // Trans Pecos Weather Modification Association
  { west: -106, east: -100.8, south: 28.8, north: 32.4 },
  // Panhandle Groundwater Conservation District
  { west: -102.9, east: -99.9, south: 34.5, north: 36.2 },
  // South Texas Weather Modification Association
  { west: -100.5, east: -97.2, south: 28.0, north: 30.2 },
  // Rolling Plains Water Enhancement Project
  { west: -101.9, east: -98.9, south: 31.9, north: 34.0 },
];

/** True if the point sits in any of the five permit boxes. */
export function inPermits(
  lat: number,
  lon: number,
  boxes: readonly LonLatBox[] = PERMIT_BOXES
): boolean {
  return boxes.some((box) => inBox(lat, lon, box));
}
