// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  heightFt,
  tallestOver,
  KM_TO_FT,
  NO_COVERAGE_KM,
  NO_ECHO_KM,
} from "../lib/services/mrms/echotop";
import { identify } from "../lib/services/mrms/objects";

// Types
import type { Grid, Geo } from "../lib/services/shared/contour";

function scene(rows: number[][]) {
  const ny = rows.length;
  const nx = rows[0].length;
  const values = new Float32Array(nx * ny);
  const lats = new Float32Array(nx * ny);
  const lons = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      values[k] = rows[j][i];
      lats[k] = 30 + 0.01 * j;
      lons[k] = -100 + 0.01 * i;
    }
  }
  return {
    grid: { nx, ny, values } as Grid,
    geo: { nx, ny, lats, lons } as Geo,
  };
}

describe("heightFt", () => {
  it("converts kilometres MSL to feet", () => {
    assert.equal(heightFt(10), Math.round(10 * KM_TO_FT));
  });

  it("is null for no echo and for no coverage", () => {
    assert.equal(heightFt(NO_ECHO_KM), null);
    assert.equal(heightFt(NO_COVERAGE_KM), null);
    assert.equal(heightFt(0), null);
  });
});

describe("tallestOver", () => {
  it("returns the highest 18 dBZ top on the storm, in feet", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 30, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_ECHO_KM);
    echo[storm.cells[0]] = 8.5;
    const hit = tallestOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.echoTopFt, Math.round(8.5 * KM_TO_FT));
    assert.equal(hit.lat, geo.lats[storm.cells[0]]);
    assert.equal(hit.lon, geo.lons[storm.cells[0]]);
  });

  it("ignores no-echo sentinels rather than treating them as a height", () => {
    const { grid, geo } = scene([
      [0, 40],
      [40, 40],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_ECHO_KM);
    echo[storm.cells[0]] = 6;
    const hit = tallestOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.echoTopFt, Math.round(6 * KM_TO_FT));
  });

  it("does not take a taller top off the storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 30, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_ECHO_KM);
    echo[0] = 16;
    echo[storm.cells[0]] = 7;
    const hit = tallestOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.echoTopFt, Math.round(7 * KM_TO_FT));
  });

  it("is null when every storm cell has no 18 dBZ top", () => {
    const { grid, geo } = scene([
      [0, 30],
      [30, 30],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_COVERAGE_KM);
    assert.equal(tallestOver(storm, geo, geo, echo), null);
  });
});
