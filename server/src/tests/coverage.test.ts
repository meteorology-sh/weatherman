// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  hasEmptyQuarter,
  reflectivityCovered,
} from "../lib/services/mrms/coverage";
import {
  BLOCK_NO_COVERAGE,
  BLOCK_NO_ECHO,
} from "../lib/services/mrms/radar";

// Types
import type { Grid } from "../lib/services/shared/contour";

/** A 4×2 grid, every cell covered with no echo. */
function grid(): Grid {
  return { nx: 4, ny: 2, values: new Float32Array(8).fill(BLOCK_NO_ECHO) };
}

describe("hasEmptyQuarter", () => {
  it("is false when every quarter has coverage", () => {
    assert.equal(hasEmptyQuarter(grid(), reflectivityCovered), false);
  });

  it("is true when one quarter has no covered cell", () => {
    const g = grid();
    g.values[0] = BLOCK_NO_COVERAGE;
    g.values[1] = BLOCK_NO_COVERAGE;
    assert.equal(hasEmptyQuarter(g, reflectivityCovered), true);
  });

  it("counts one covered cell as coverage for its quarter", () => {
    const g = grid();
    g.values[0] = BLOCK_NO_COVERAGE;
    assert.equal(hasEmptyQuarter(g, reflectivityCovered), false);
  });
});

describe("reflectivityCovered", () => {
  // No echo is a radar that looked and saw nothing.
  it("counts no echo and real echo as covered, and no coverage as not", () => {
    assert.equal(reflectivityCovered(BLOCK_NO_ECHO), true);
    assert.equal(reflectivityCovered(35), true);
    assert.equal(reflectivityCovered(BLOCK_NO_COVERAGE), false);
  });
});
