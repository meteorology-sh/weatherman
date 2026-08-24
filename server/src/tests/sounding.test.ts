// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  isothermFt,
  SCOUT_LADDER_MB,
  SOUNDING_LEVELS,
} from "../lib/services/hrrr/profile";
import {
  cellAt,
  clampBox,
  crop,
  inGrid,
  nearestCell,
  parseBox,
  perimeter,
} from "../lib/services/shared/grid";

// Types
import type { SoundingLevel } from "../lib/services/hrrr/profile";

/** A column, bottom up, the way the service assembles one. */
const column = (pairs: [number, number][]): SoundingLevel[] =>
  pairs.map(([heightFt, tempC], i) => ({ mb: 1000 - i * 50, tempC, heightFt }));

/** Kansas, 12 Aug 2026 04Z, from the live route — the numbers this was built on. */
const kansas = column([
  [139, 34.85],
  [1653, 31.81],
  [3252, 32.32],
  [4930, 29.02],
  [6686, 24.88],
  [8526, 20.11],
  [10463, 15.18],
  [12504, 9.98],
  [14665, 4.37],
  [16966, -1.32],
  [19434, -6.6],
  [22106, -12.08],
  [25025, -18.11],
]);

describe("isothermFt", () => {
  it("interpolates between the levels that bracket the temperature", () => {
    // Halfway in temperature between 10000 ft / 10 C and 12000 ft / 0 C.
    const profile = column([
      [10000, 10],
      [12000, 0],
    ]);

    assert.equal(isothermFt(profile, 5), 11000);
  });

  // Within a few feet, because the fixture's temperatures are the rounded ones
  // the route printed rather than the full floats it interpolated.
  const near = (got: number | null, want: number) =>
    assert.ok(got !== null && Math.abs(got - want) <= 5, `${got} vs ${want}`);

  it("reads the freezing level off a real column", () => {
    near(isothermFt(kansas, 0), 16433);
  });

  it("reads both edges of the seeding band off a real column", () => {
    near(isothermFt(kansas, -5), 18685);
    near(isothermFt(kansas, -12), 22066);
  });

  it("puts the band above the freezing level, which is what makes it seedable", () => {
    assert.ok(isothermFt(kansas, -5)! > isothermFt(kansas, 0)!);
    assert.ok(isothermFt(kansas, -12)! > isothermFt(kansas, -5)!);
  });

  it("returns the level itself when it sits exactly on the temperature", () => {
    const profile = column([
      [10000, 5],
      [12000, 0],
      [14000, -5],
    ]);

    assert.equal(isothermFt(profile, 0), 12000);
  });

  // An inversion can cross a temperature more than once. The altitude that
  // matters for flying into the band is the first one reached on the way up.
  it("takes the lowest crossing when an inversion makes two", () => {
    const profile = column([
      [1000, 2],
      [3000, -2],
      [5000, 3],
      [7000, -4],
    ]);

    assert.equal(isothermFt(profile, 0), 2000);
  });

  // "The whole column is colder than -12 C" is a real answer, and it is not the
  // same as "the band is at zero feet".
  it("has no answer when the column never reaches the temperature", () => {
    const profile = column([
      [10000, -20],
      [12000, -30],
    ]);

    assert.equal(isothermFt(profile, 0), null);
  });

  it("has no answer when the column is warmer than the temperature throughout", () => {
    assert.equal(isothermFt(kansas, -40), null);
  });
});

describe("nearestCell", () => {
  /** A 3x3 patch of a lat/lon grid, one degree apart. */
  const geo = {
    nx: 3,
    ny: 3,
    lats: Float32Array.from([39, 39, 39, 40, 40, 40, 41, 41, 41]),
    lons: Float32Array.from([-100, -99, -98, -100, -99, -98, -100, -99, -98]),
  };

  it("finds the cell containing the point", () => {
    assert.equal(nearestCell(geo, 40.1, -98.9), 4);
  });

  it("snaps a point between cells to the closer one", () => {
    assert.equal(nearestCell(geo, 40.6, -98.1), 8); // 41 N, -98
  });

  // A degree of longitude is ~40% shorter than a degree of latitude at 45 N, so
  // measuring in raw degrees would pick the wrong cell near the top of the grid.
  it("measures on the ground, not in degrees", () => {
    // 0.6 deg east but only 0.5 deg north of cell 4. In raw degrees the
    // northern cell wins; on the ground at 40 N, 0.6 deg of longitude is
    // ~0.46 deg worth of distance, so cell 4's eastern neighbour is closer.
    const cell = nearestCell(geo, 40.5, -98.4);

    assert.equal(geo.lats[cell], 40);
  });
});

/**
 * The cell a readout is about: the one whose footprint covers the point, which
 * is the same square the contours are traced from.
 *
 * The grid here is **rotated**, like the real one — HRRR's rows run along the
 * Lambert projection rather than along a parallel. That is what separates this
 * from `nearestCell`: on a rotated grid the nearest centre and the containing
 * footprint are different cells near a boundary, and a readout that answers
 * with the first can contradict a band drawn from the second.
 */
describe("cellAt", () => {
  const TURN = (30 * Math.PI) / 180;
  const nx = 3;
  const ny = 3;
  const lons = new Float32Array(nx * ny);
  const lats = new Float32Array(nx * ny);

  // One degree per cell, the whole lattice turned 30 degrees.
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      lons[j * nx + i] = -100 + i * Math.cos(TURN) - j * Math.sin(TURN);
      lats[j * nx + i] = 40 + i * Math.sin(TURN) + j * Math.cos(TURN);
    }
  }
  const geo = { nx, ny, lats, lons };

  /** The point `along` cells down the row and `across` the column from a cell. */
  const offset = (i: number, j: number, along: number, across: number) =>
    [
      lats[j * nx + i] + along * Math.sin(TURN) + across * Math.cos(TURN),
      lons[j * nx + i] + along * Math.cos(TURN) - across * Math.sin(TURN),
    ] as const;

  it("answers with the cell a point sits in", () => {
    const [lat, lon] = offset(1, 1, 0.1, 0.1);

    assert.equal(cellAt(geo, lat, lon), 4);
  });

  // The case the readout was getting wrong. Toward the corner of a rotated
  // cell, a neighbour's centre is closer on the ground while the point is still
  // inside this cell's own footprint — and the footprint is what was contoured.
  it("keeps a point in its own cell where a neighbour's centre is nearer", () => {
    const [lat, lon] = offset(1, 1, 0.45, 0.45);

    assert.notEqual(nearestCell(geo, lat, lon), 4);
    assert.equal(cellAt(geo, lat, lon), 4);
  });

  it("crosses to the neighbour once the point does", () => {
    const [lat, lon] = offset(1, 1, 0.55, 0);

    assert.equal(cellAt(geo, lat, lon), 5);
  });

  // The basis is read from a neighbour, and an edge cell has one on one side
  // only. Stepping backwards and negating has to give the same answer.
  it("resolves against the edge of the grid", () => {
    const [lat, lon] = offset(2, 2, -0.1, -0.1);

    assert.equal(cellAt(geo, lat, lon), 8);
  });
});

/**
 * The grid's own edge. `nearestCell` always answers, so these are the tests
 * that stop it answering about somewhere the model does not reach.
 */
describe("the edge of the grid", () => {
  /** A 3x3 patch of a lat/lon grid, one degree apart. */
  const geo = {
    nx: 3,
    ny: 3,
    lats: Float32Array.from([39, 39, 39, 40, 40, 40, 41, 41, 41]),
    lons: Float32Array.from([-100, -99, -98, -100, -99, -98, -100, -99, -98]),
  };

  it("covers a point inside the grid", () => {
    assert.equal(inGrid(geo, 40.001, -99.001), true);
  });

  // The bug this is here for: a click on the ocean used to snap to the nearest
  // edge cell and be reported as that cell's weather.
  it("does not cover a point far outside it", () => {
    assert.equal(inGrid(geo, 21, -158), false);
  });

  // Cells in this toy are a degree apart; SNAP_KM is half a 3 km diagonal.
  // A tenth of a degree past the edge is ~11 km — outside.
  it("does not cover a point just past the last cell", () => {
    assert.equal(inGrid(geo, 41.1, -99), false);
  });

  it("walks the edge as a closed ring", () => {
    const ring = perimeter(geo, 1);

    // Eight edge cells, and the first repeated to close it. The centre is not
    // on the edge and must not appear.
    assert.equal(ring.length, 9);
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    assert.equal(
      ring.some(([lon, lat]) => lon === -99 && lat === 40),
      false
    );
  });

  // Thinning the walk is what keeps the ring small enough to hold in the app.
  // It must still close, and still trace the same four corners.
  it("keeps every corner when the walk is thinned", () => {
    const ring = perimeter(geo, 2);

    assert.deepEqual(ring[0], ring[ring.length - 1]);
    for (const corner of [
      [-100, 39],
      [-98, 39],
      [-98, 41],
      [-100, 41],
    ]) {
      assert.equal(
        ring.some(([lon, lat]) => lon === corner[0] && lat === corner[1]),
        true
      );
    }
  });
});

describe("parseBox", () => {
  it("falls back to the Texas window when the query is empty", () => {
    const box = parseBox({});
    assert.equal(box.west, -107);
    assert.equal(box.east, -93);
  });

  it("reads a named window", () => {
    const box = parseBox({
      west: "-105",
      east: "-95",
      south: "28",
      north: "35",
    });
    assert.deepEqual(box, { west: -105, east: -95, south: 28, north: 35 });
  });

  it("shrinks a country-scale box around its centre", () => {
    const box = clampBox({
      west: -125,
      east: -70,
      south: 25,
      north: 50,
    });
    assert.ok(box.east - box.west <= 16);
    assert.ok(box.north - box.south <= 14);
  });
});

describe("crop", () => {
  const geo = {
    nx: 4,
    ny: 3,
    lats: Float32Array.from([30, 30, 30, 30, 31, 31, 31, 31, 32, 32, 32, 32]),
    lons: Float32Array.from([
      -102, -101, -100, -99, -102, -101, -100, -99, -102, -101, -100, -99,
    ]),
  };
  const grid = {
    nx: 4,
    ny: 3,
    values: Float32Array.from([0, 1, 2, 3, 10, 11, 12, 13, 20, 21, 22, 23]),
  };

  it("keeps the rectangle that covers the box", () => {
    const cut = crop(grid, geo, {
      west: -101.5,
      east: -99.5,
      south: 30.5,
      north: 31.5,
    });

    assert.equal(cut.grid.nx, 4);
    assert.equal(cut.grid.ny, 3);
    assert.deepEqual(Array.from(cut.grid.values), Array.from(grid.values));
  });

  it("drops rows and columns outside the box", () => {
    const cut = crop(grid, geo, {
      west: -101.1,
      east: -100.9,
      south: 30.9,
      north: 31.1,
    });

    // One cell, padded one on each side that exists.
    assert.equal(cut.grid.nx, 3);
    assert.equal(cut.grid.ny, 3);
    assert.equal(cut.grid.values[4], 11);
  });
});

/**
 * The read window is the only altitude-shaped assumption left in this service,
 * and it is the one that can turn "we did not look" into "there is nothing
 * here". These pin the two ends of it.
 */
describe("the column's read window", () => {
  // Winter, northern plains: the whole free-air column is colder than the band.
  // isothermFt is right to return null — there is no crossing — but the caller
  // must be able to tell this apart from a band above the ceiling, or the panel
  // reports "nothing to seed" for both.
  it("finds no crossing in a column colder than the band throughout", () => {
    const arctic = column([
      [400, -14],
      [1900, -16],
      [3500, -19],
      [5100, -22],
    ]);

    assert.equal(isothermFt(arctic, -5), null);
    assert.equal(isothermFt(arctic, -12), null);
    // What tells the two cases apart: the base is colder than the band.
    assert.ok(arctic[0].tempC < -12);
  });

  it("finds no crossing in a column warmer than the band throughout", () => {
    const hot = column([
      [19500, -2],
      [22100, -4],
    ]);

    assert.equal(isothermFt(hot, -5), null);
    // ...and here the base is *warmer*, which is the opposite diagnosis.
    assert.ok(hot[0].tempC > -5);
  });

  // Measured on a real August analysis: the warmest 12 km cell at 400 mb was
  // -13.4 C, only 1.4 C from the band's cold edge. A 400 mb ceiling was one hot
  // airmass away from clipping the top of the band, so the ladder starts higher.
  it("looks high enough to keep the band off the ceiling", () => {
    assert.ok(SCOUT_LADDER_MB[0] <= 300);
  });

  // In a winter airmass the band reaches the ground, and 1000 mb is not the
  // ground. HRRR's own lowest level is 1013.2 mb.
  it("reads down to HRRR's lowest level, not to 1000 mb", () => {
    assert.ok(SOUNDING_LEVELS.includes(1013.2));
  });

  it("still steps at 50 mb through the band's range", () => {
    assert.ok(SOUNDING_LEVELS.includes(500));
    assert.ok(SOUNDING_LEVELS.includes(550));
  });
});
