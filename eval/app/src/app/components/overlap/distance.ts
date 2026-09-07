// Types
import type { Nearness } from "~/lib/types";

/**
 * How a distance is colored, and where the steps fall.
 *
 * **The steps are grid cells, not opinions about seeding.** Inside is inside
 * the contour after that layer's own drift. One cell is the next honest step
 * out, at that layer's native spacing, and two cells is the step after that.
 * Neither says how near an aircraft ought to be. The cell size is carried in
 * from the painted file rather than written here, so it follows the grid if
 * the grid moves.
 */
export type Tone = {
  fill: string;
  stroke: string;
  text: string;
  label: string;
};

const INSIDE: Tone = {
  fill: "fill-success",
  stroke: "stroke-success",
  text: "text-success",
  label: "Inside the layer",
};
const ONE_CELL: Tone = {
  fill: "fill-info",
  stroke: "stroke-info",
  text: "text-info",
  label: "Within one cell",
};
const TWO_CELLS: Tone = {
  fill: "fill-warning",
  stroke: "stroke-warning",
  text: "text-warning",
  label: "Within two cells",
};
const BEYOND: Tone = {
  fill: "fill-error",
  stroke: "stroke-error",
  text: "text-error",
  label: "Further out",
};
const UNMEASURED: Tone = {
  fill: "fill-base-content",
  stroke: "stroke-base-content",
  text: "text-base-content",
  label: "Nothing painted at this hour",
};

/** Native cell size for a layer, accepting the old single-number files. */
export function cellSize(
  cellKm: number | Record<string, number> | undefined,
  key: string
): number {
  if (cellKm && typeof cellKm === "object") return cellKm[key] ?? 3;
  if (typeof cellKm === "number") return cellKm;
  return 3;
}

export function toneFor(near: Nearness | null, cellKm: number): Tone {
  if (!near || near.km === null) return UNMEASURED;
  if (near.inside) return INSIDE;
  if (near.km <= cellKm) return ONE_CELL;
  if (near.km <= 2 * cellKm) return TWO_CELLS;
  return BEYOND;
}

/** Inside, a distance, or an em dash when that layer had no frame. */
export function distanceLabel(near: Nearness | null): string {
  if (!near || near.km === null) return "—";
  if (near.inside) return "inside";
  return `${near.km} km`;
}
