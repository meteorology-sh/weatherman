// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  isothermFt,
  SCOUT_LADDER_MB,
  SOUNDING_LEVELS,
} from "../lib/services/hrrr/profile";
import { inGrid, nearestCell, perimeter } from "../lib/services/shared/grid";

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
    assert.equal(inGrid(geo, 40.02, -99.02), true);
  });

  // The bug this is here for: a click on the ocean used to snap to the nearest
  // edge cell and be reported as that cell's weather.
  it("does not cover a point far outside it", () => {
    assert.equal(inGrid(geo, 21, -158), false);
  });

  // Cells are 12 km apart, so a point half a cell's diagonal out is the
  // farthest one inside can be. A degree of latitude is ~111 km, so a tenth of
  // a degree past the edge is ~11 km — outside.
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
