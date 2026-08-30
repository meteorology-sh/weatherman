// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  bearingDeg,
  identify,
  km,
  matchTracks,
  near,
  quietRing,
} from "../lib/services/mrms/objects";

// Types
import type { Grid, Geo } from "../lib/services/shared/contour";

/** A south-up regular grid. j = 0 is the southern row. */
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

const TIME = "2025-08-11T18:00:00.000Z";
const LATER = "2025-08-11T18:02:00.000Z";

describe("identify", () => {
  it("finds nothing on a quiet grid", () => {
    const { grid, geo } = scene([
      [0, 0],
      [0, 0],
    ]);
    assert.equal(identify(grid, geo, 20, TIME).length, 0);
  });

  it("treats a single echoing cell as one storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 41, 0],
      [0, 0, 0],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 1);
    assert.equal(storms[0].nCells, 1);
    assert.equal(storms[0].maxDbz, 41);
    assert.ok(Math.abs(storms[0].coreLon - -99.99) < 1e-4);
    assert.ok(Math.abs(storms[0].coreLat - 30.01) < 1e-4);
    assert.ok(storms[0].geometry.length >= 1);
  });

  it("joins diagonal neighbours (8-connected)", () => {
    const { grid, geo } = scene([
      [30, 0, 0],
      [0, 30, 0],
      [0, 0, 30],
    ]);
    assert.equal(identify(grid, geo, 20, TIME).length, 1);
  });

  it("keeps two separated blobs as two storms", () => {
    const { grid, geo } = scene([
      [35, 0, 0, 40],
      [35, 0, 0, 40],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 2);
    const peaks = storms.map((s) => s.maxDbz).sort((a, b) => a - b);
    assert.deepEqual(peaks, [35, 40]);
  });

  it("does not wrap the west edge onto the east edge", () => {
    const { grid, geo } = scene([
      [45, 0, 0, 45],
      [45, 0, 0, 45],
    ]);
    assert.equal(identify(grid, geo, 20, TIME).length, 2);
  });

  it("puts the core on the strongest cell, not the centroid", () => {
    const { grid, geo } = scene([
      [20, 20, 55],
      [20, 20, 20],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    assert.equal(storm.maxDbz, 55);
    assert.ok(Math.abs(storm.coreLon - -99.98) < 1e-4);
    assert.ok(Math.abs(storm.coreLat - 30) < 1e-4);
    assert.ok(storm.centroidLon < storm.coreLon);
  });

  it("ignores no-echo sentinels the way a contour does", () => {
    const { grid, geo } = scene([
      [-99, -99, 33],
      [-999, 33, 33],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 1);
    assert.equal(storms[0].nCells, 3);
  });
});

describe("matchTracks", () => {
  it("keeps the id when the centroid has not jumped", () => {
    const first = scene([
      [0, 40, 0],
      [0, 0, 0],
    ]);
    const second = scene([
      [0, 0, 0],
      [0, 40, 0],
    ]);
    const prev = identify(first.grid, first.geo, 20, TIME);
    const next = identify(second.grid, second.geo, 20, LATER);
    const nextId = { value: 10 };
    const tracked = matchTracks(prev, next, TIME, LATER, nextId);
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0].id, prev[0].id);
    assert.equal(tracked[0].firstSeen, TIME);
    assert.equal(tracked[0].ageMin, 2);
    assert.equal(tracked[0].motionTowardDeg, 0);
    assert.ok((tracked[0].motionKmh ?? 0) > 0);
  });

  it("issues a new id when the jump is farther than a storm moves in two minutes", () => {
    const first = scene([[40, 0, 0, 0, 0, 0]], 30, -100, 0.1);
    const far = scene([[0, 0, 0, 0, 0, 40]], 30, -100, 0.1);
    const prev = identify(first.grid, first.geo, 20, TIME);
    const next = identify(far.grid, far.geo, 20, LATER);
    const nextId = { value: 10 };
    const tracked = matchTracks(prev, next, TIME, LATER, nextId);
    assert.equal(tracked[0].id, 10);
    assert.equal(tracked[0].ageMin, null);
    assert.equal(nextId.value, 11);
  });
});

describe("near", () => {
  const { grid, geo } = scene([
    [0, 0, 0, 0, 0],
    [0, 25, 25, 50, 0],
    [0, 25, 25, 25, 0],
    [0, 0, 0, 0, 0],
  ]);
  const storms = identify(grid, geo, 20, TIME);

  it("counts the raining cell centre as inside a one-cell storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 22, 0],
      [0, 0, 0],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    const reading = near(30.01, -99.99, storms, grid, geo, 20, TIME);
    assert.ok(reading);
    assert.equal(reading.inside, true);
    assert.equal(reading.object.nCells, 1);
  });

  it("counts a click inside the drawn outline as inside", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 22, 0],
      [0, 0, 0],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.ok(storms[0].geometry.length > 0);
    const [lon, lat] = storms[0].geometry[0][0][0];
    const midLon = (lon + storms[0].coreLon) / 2;
    const midLat = (lat + storms[0].coreLat) / 2;
    const reading = near(midLat, midLon, storms, grid, geo, 20, TIME);
    assert.ok(reading);
    assert.equal(reading.inside, true);
  });

  it("says a point in an echoing cell is inside", () => {
    const reading = near(30.01, -99.99, storms, grid, geo, 20, TIME);
    assert.ok(reading);
    assert.equal(reading.inside, true);
    assert.equal(reading.object.maxDbz, 50);
  });

  it("is closer to the edge than to the core on a flank cell", () => {
    const reading = near(30.01, -99.99, storms, grid, geo, 20, TIME);
    assert.ok(reading);
    assert.ok(
      reading.edgeKm < reading.coreKm,
      `edge ${reading.edgeKm} core ${reading.coreKm}`
    );
  });

  it("still names the object from a quiet cell next to it", () => {
    const reading = near(30.01, -100, storms, grid, geo, 20, TIME);
    assert.ok(reading);
    assert.equal(reading.inside, false);
    assert.equal(reading.object.maxDbz, 50);
  });

  it("measures the upwind edge when the storm has a motion", () => {
    storms[0].motionTowardDeg = 90;
    const reading = near(30.01, -99.99, storms, grid, geo, 20, TIME);
    assert.ok(reading);
    assert.ok(reading.upwindEdgeKm !== null);
  });
});

describe("quietRing", () => {
  it("is the clear cells that touch the rain, not the raining cells", () => {
    const { grid, geo } = scene([
      [0, 0, 0, 0, 0],
      [0, 0, 30, 0, 0],
      [0, 30, 50, 30, 0],
      [0, 0, 30, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    const ring = quietRing(storm, grid, 20);
    assert.ok(ring.length > 0);
    for (const k of ring) {
      assert.ok(grid.values[k] < 20);
      assert.ok(!storm.cells.includes(k));
    }
  });

  it("does not treat uncovered ground as a place to fly", () => {
    const { grid, geo } = scene([
      [-999, -999, -999],
      [-999, 40, -999],
      [-999, -999, -999],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    assert.equal(quietRing(storm, grid, 20).length, 0);
  });
});

describe("km and bearing", () => {
  it("is about 1.1 km for 0.01 deg of latitude", () => {
    assert.ok(Math.abs(km(30, -100, 30.01, -100) - 1.113) < 0.01);
  });

  it("reads due east as 90", () => {
    assert.equal(Math.round(bearingDeg(30, -100, 30, -99.9)), 90);
  });
});
