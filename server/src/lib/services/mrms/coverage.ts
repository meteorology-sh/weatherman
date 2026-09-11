/**
 * The basic check that a live MRMS mosaic looks wrong.
 *
 * Every quarter of the country has radars in it, so a quarter of the mosaic
 * with no coverage in any cell is data that did not arrive rather than a
 * reading. Nothing finer is attempted: a single radar down for maintenance is
 * the network as it is, not a broken file.
 */

// Services
import { BLOCK_NO_COVERAGE, BLOCK_NO_ECHO } from "./radar";

// Types
import type { Grid } from "../shared/contour";

/**
 * A radar looked at this reflectivity cell. Anything above the midpoint of the
 * two sentinels, so the native mosaic's and the block grid's both land on
 * their own side.
 */
export const reflectivityCovered = (dbz: number) =>
  dbz > (BLOCK_NO_ECHO + BLOCK_NO_COVERAGE) / 2;

/** Does any quarter of the grid, split at its middle row and column, have no covered cell? */
export function hasEmptyQuarter(
  grid: Grid,
  covered: (value: number) => boolean
): boolean {
  const { nx, ny, values } = grid;
  const midX = Math.floor(nx / 2);
  const midY = Math.floor(ny / 2);
  const seen = [false, false, false, false];
  for (let j = 0; j < ny; j++) {
    const row = j < midY ? 0 : 2;
    for (let i = 0; i < nx; i++) {
      if (covered(values[j * nx + i])) seen[row + (i < midX ? 0 : 1)] = true;
    }
  }
  return seen.includes(false);
}
