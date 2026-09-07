// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { BASE_WINDOW_FT } from "../lib/services/hrrr/diagnostics";
import {
  inBaseWindow,
  windowValues,
} from "../lib/services/hrrr/basewindow";

const [WINDOW_LOW, WINDOW_HIGH] = BASE_WINDOW_FT;

describe("inBaseWindow", () => {
  it("keeps a base on the lower edge of the window", () => {
    assert.equal(inBaseWindow(WINDOW_LOW), true);
  });

  it("rejects a base at the top of the window — the interval is half-open", () => {
    assert.equal(inBaseWindow(WINDOW_HIGH), false);
  });

  it("rejects a 3,000 ft AGL base", () => {
    assert.equal(inBaseWindow(3000), false);
  });
});

describe("windowValues", () => {
  it("marks a column whose AGL base sits in the window", () => {
    const values = windowValues(
      new Float32Array([8000]),
      new Float32Array([2000])
    );
    assert.equal(values[0], 1);
  });

  it("applies the window in AGL, not MSL", () => {
    // Same 8,000 ft MSL base: in the window over low ground, out of it
    // over high ground.
    const values = windowValues(
      new Float32Array([8000, 8000]),
      new Float32Array([500, 5000])
    );
    assert.equal(values[0], 1);
    assert.ok(Number.isNaN(values[1]));
  });

  it("leaves a column with no cloud blank", () => {
    const values = windowValues(
      new Float32Array([Number.NaN, 8000]),
      new Float32Array([2000, 2000])
    );
    assert.ok(Number.isNaN(values[0]));
    assert.equal(values[1], 1);
  });

  it("draws a column in the window outside Texas", () => {
    // Denver-height terrain, 8,000 ft MSL base → 6,000 ft AGL.
    const values = windowValues(
      new Float32Array([8000]),
      new Float32Array([2000])
    );
    assert.equal(values[0], 1);
  });
});
