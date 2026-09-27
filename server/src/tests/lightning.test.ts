// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  countOver,
  flashesInBox,
  flashFrame,
  readFlashes,
} from "../lib/services/goes/lightning";
import { identify } from "../lib/services/mrms/objects";
import type { H5File } from "../lib/services/goes/scene";
import type { Grid, Geo } from "../lib/services/shared/contour";

function fileOf(lats: number[], lons: number[]): H5File {
  return {
    get(name: string) {
      if (name === "flash_lat") return { value: lats, shape: [lats.length], attrs: {} };
      if (name === "flash_lon") return { value: lons, shape: [lons.length], attrs: {} };
      throw new Error(name);
    },
    close() {},
  };
}

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

describe("readFlashes", () => {
  it("pairs flash_lat with flash_lon", () => {
    const flashes = readFlashes(fileOf([32.1, 10], [-101.4, -90]));
    assert.equal(flashes.length, 2);
    assert.equal(flashes[0].lat, 32.1);
    assert.equal(flashes[0].lon, -101.4);
  });
});

describe("flashesInBox", () => {
  it("drops flashes outside the window", () => {
    const kept = flashesInBox(
      [
        { lat: 32, lon: -101 },
        { lat: 10, lon: -90 },
      ],
      { west: -102, east: -100, south: 31, north: 33 }
    );
    assert.equal(kept.length, 1);
    assert.equal(kept[0].lat, 32);
  });
});

describe("countOver", () => {
  it("counts a flash on a raining cell and ignores one off the storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 40, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const on = { lat: geo.lats[storm.cells[0]], lon: geo.lons[storm.cells[0]] };
    const off = { lat: 30, lon: -100 };
    assert.equal(countOver([on, off], storm, geo), 1);
  });
});

describe("flashFrame", () => {
  it("emits a point per flash", () => {
    const frame = flashFrame("2025-08-11T18:00:00.000Z", [
      { lat: 32.1, lon: -101.4 },
    ]);
    assert.equal(frame.features.length, 1);
    assert.deepEqual(frame.features[0].geometry.coordinates, [-101.4, 32.1]);
  });
});
