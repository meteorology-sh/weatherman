// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  coldestTopC,
  maxCellOver,
  maxOver,
  valuesOver,
} from "../lib/services/candidate/storm";
import { identify } from "../lib/services/mrms/objects";
import { CLEAR } from "../lib/services/goes/cloudtop";

// Types
import type { Grid, Geo } from "../lib/services/shared/contour";

function scene(
  rows: number[][],
  lat0 = 30,
  lon0 = -100,
  step = 0.01
): { grid: Grid; geo: Geo } {
  const ny = rows.length;
  const nx = rows[0].length;
  const values = new Float32Array(nx * ny);
  const lats = new Float32Array(nx * ny);
  const lons = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      values[k] = rows[j][i];
      lats[k] = lat0 + step * j;
      lons[k] = lon0 + step * i;
    }
  }
  return {
    grid: { nx, ny, values },
    geo: { nx, ny, lats, lons },
  };
}

describe("coldestTopC", () => {
  it("returns the coldest cloudy top as a temperature", () => {
    assert.equal(coldestTopC([5, 18, CLEAR]), -18);
  });

  it("is null when every pixel is clear", () => {
    assert.equal(coldestTopC([CLEAR, CLEAR]), null);
  });
});

describe("maxOver", () => {
  it("reads the highest 3 km value covering the storm's cells", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 30, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const liquid = new Float32Array(geo.lats.length);
    liquid[storm.cells[0]] = 42;
    assert.equal(maxOver(storm, geo, geo, liquid), 42);
  });

  it("skips empty cells rather than treating them as zero liquid", () => {
    const { grid, geo } = scene([
      [0, 40],
      [40, 40],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const liquid = new Float32Array(geo.lats.length).fill(Number.NaN);
    liquid[storm.cells[0]] = 12;
    assert.equal(maxOver(storm, geo, geo, liquid), 12);
    assert.ok(valuesOver(storm, geo, geo, { values: liquid }).includes(12));
  });
});

describe("maxCellOver", () => {
  it("returns the cell of the highest value covering the storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 30, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length);
    echo[storm.cells[0]] = 18000;
    const hit = maxCellOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.value, 18000);
    assert.equal(hit.cell, storm.cells[0]);
  });
});
