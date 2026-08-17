// Types
import type { Nearness } from "~/lib/types";

/**
 * How a distance is coloured, and where the steps fall.
 *
 * **The steps are grid cells, not opinions about seeding.** The layers are
 * contoured on a 12 km grid, so the map cannot resolve anything finer: a release
 * within one cell of the paint is inside it as far as this map can tell, and two
 * cells is the next honest step out. Neither says how near an aircraft ought to
 * be — that is a question for someone with the operator's reasoning, not for a
 * colour ramp. The cell size is carried in from the painted file rather than
 * written here, so it follows the grid if the grid moves.
 */
export type Tone = { fill: string; stroke: string; label: string };

const INSIDE: Tone = {
  fill: "fill-success",
  stroke: "stroke-success",
  label: "Inside the paint",
};
const ONE_CELL: Tone = {
  fill: "fill-info",
  stroke: "stroke-info",
  label: "Within one cell",
};
const TWO_CELLS: Tone = {
  fill: "fill-warning",
  stroke: "stroke-warning",
  label: "Within two cells",
};
const BEYOND: Tone = {
  fill: "fill-error",
  stroke: "stroke-error",
  label: "Further out",
};
const UNMEASURED: Tone = {
  fill: "fill-base-content",
  stroke: "stroke-base-content",
  label: "Nothing painted at this hour",
};

export const TONES = [INSIDE, ONE_CELL, TWO_CELLS, BEYOND] as const;

export function toneFor(near: Nearness | null, cellKm: number): Tone {
  if (!near || near.km === null) return UNMEASURED;
  if (near.inside) return INSIDE;
  if (near.km <= cellKm) return ONE_CELL;
  if (near.km <= 2 * cellKm) return TWO_CELLS;
  return BEYOND;
}
