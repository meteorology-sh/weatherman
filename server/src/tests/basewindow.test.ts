// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { SEEDABLE_BASE_FT } from "../lib/services/hrrr/diagnostics";
import {
  baseLowEnough,
  windowValues,
} from "../lib/services/hrrr/basewindow";

describe("baseLowEnough", () => {
  it("rejects a base at the bound — the interval is half-open", () => {
    assert.equal(baseLowEnough(SEEDABLE_BASE_FT), false);
    assert.equal(baseLowEnough(SEEDABLE_BASE_FT - 1), true);
  });

  it("keeps a 3,000 ft AGL base — there is no lower bound", () => {
    assert.equal(baseLowEnough(3000), true);
  });

  it("keeps a base on the deck", () => {
    assert.equal(baseLowEnough(0), true);
  });
});

describe("windowValues", () => {
  it("marks a column whose AGL base is under the bound", () => {
    const values = windowValues(
      new Float32Array([8000]),
      new Float32Array([2000])
    );
    assert.equal(values[0], 1);
  });

  it("applies the bound in AGL, not MSL", () => {
    // Same 13,000 ft MSL base: seedable over 2,000 ft ground, too high
    // over 500 ft ground.
    const values = windowValues(
      new Float32Array([13000, 13000]),
      new Float32Array([2000, 500])
    );
    assert.equal(values[0], 1);
    assert.ok(Number.isNaN(values[1]));
  });

  it("draws a base below 4,000 ft above the ground", () => {
    // The state's published 4,000-12,000 ft figure describes where Texas
    // bases usually sit. It is not a test, so a 1,000 ft AGL base is drawn.
    const values = windowValues(
      new Float32Array([3000]),
      new Float32Array([2000])
    );
    assert.equal(values[0], 1);
  });

  it("leaves a column with no cloud blank", () => {
    const values = windowValues(
      new Float32Array([Number.NaN, 8000]),
      new Float32Array([2000, 2000])
    );
    assert.ok(Number.isNaN(values[0]));
    assert.equal(values[1], 1);
  });

  it("draws a column under the bound outside Texas", () => {
    // Denver-height terrain, 8,000 ft MSL base → 6,000 ft AGL.
    const values = windowValues(
      new Float32Array([8000]),
      new Float32Array([2000])
    );
    assert.equal(values[0], 1);
  });
});
