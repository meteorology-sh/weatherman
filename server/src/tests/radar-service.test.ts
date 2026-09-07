// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  coarsenReflectivity,
  nativeGeo,
  nativeGrid,
  sceneTime,
  summarize,
} from "../lib/services/mrms/radar";
import { polygons } from "../lib/services/shared/contour";

/** MRMS's own sentinels, which the coarsened grid keeps. */
const NO_ECHO = -99;
const NO_COVERAGE = -999;

describe("coarsenReflectivity", () => {
  it("averages a crop in Z, without flipping rows", () => {
    const grid = {
      nx: 4,
      ny: 4,
      values: Float32Array.from([
        20, 20, 20, 20, 20, 20, 20, 20, 50, 50, 50, 50, 50, 50, 50, 50,
      ]),
    };
    const geo = {
      nx: 4,
      ny: 4,
      lats: Float32Array.from([
        30, 30, 30, 30, 31, 31, 31, 31, 32, 32, 32, 32, 33, 33, 33, 33,
      ]),
      lons: Float32Array.from([
        -100, -99, -98, -97, -100, -99, -98, -97, -100, -99, -98, -97, -100,
        -99, -98, -97,
      ]),
    };
    const out = coarsenReflectivity(grid, geo, 2);
    assert.equal(out.grid.nx, 2);
    assert.equal(out.grid.ny, 2);
    assert.equal(Math.round(out.grid.values[0]), 20);
    assert.equal(Math.round(out.grid.values[2]), 50);
    assert.ok(out.geo.lats[2] > out.geo.lats[0]);
  });

  it("means in reflectivity factor, not in dBZ", () => {
    const grid = {
      nx: 2,
      ny: 2,
      values: Float32Array.from([20, 50, 20, 50]),
    };
    const geo = {
      nx: 2,
      ny: 2,
      lats: Float32Array.from([30, 30, 31, 31]),
      lons: Float32Array.from([-100, -99, -100, -99]),
    };
    const got = coarsenReflectivity(grid, geo, 2).grid.values[0];
    assert.ok(got > 46 && got < 48, `${got}`);
  });
});

describe("nativeGrid orientation", () => {
  it("flips north-up rows into the south-up grid the contourer expects", () => {
    const values = new Float32Array(12 * 2).fill(NO_ECHO);
    for (let i = 0; i < 12; i++) values[i] = 40; // northern row

    const grid = nativeGrid(values, 12, 2);

    assert.equal(grid.ny, 2);
    assert.equal(grid.values[12], 40); // last row is the north one
    assert.equal(grid.values[0], NO_ECHO);
  });

  it("contours a blob rather than dropping it as an inverted ring", () => {
    const values = new Float32Array(12 * 12).fill(NO_ECHO);
    for (let col = 4; col < 8; col++) values[col] = 40; // northern row

    const rings = polygons(nativeGrid(values, 12, 12), nativeGeo(12, 12), 20);

    assert.equal(rings.length, 1);
  });
});

describe("nativeGeo", () => {
  it("places the northern row at the mosaic's north-west corner", () => {
    const geo = nativeGeo(12, 12);
    const north = geo.lats[(geo.ny - 1) * geo.nx];
    assert.ok(Math.abs(north - 54.995) < 1e-4, `${north}`);
    assert.ok(Math.abs(geo.lons[0] - -129.995) < 1e-4, `${geo.lons[0]}`);
  });

  it("steps a point at a time", () => {
    const geo = nativeGeo(12, 12);
    assert.ok(Math.abs(geo.lons[1] - geo.lons[0] - 0.01) < 1e-4);
  });
});

describe("summarize", () => {
  const VALID = "2026-08-12T04:10:00.000Z";

  /** A one-row grid of `values`, with the geo the mosaic would give it. */
  const grid = (values: number[]) => ({
    nx: values.length,
    ny: 1,
    values: Float32Array.from(values),
  });
  const geo = (n: number) => ({
    nx: n,
    ny: 1,
    lats: new Float32Array(n).fill(40),
    lons: Float32Array.from({ length: n }, (_, i) => -100 + i * 0.12),
  });
  const sum = (values: number[]) =>
    summarize(grid(values), geo(values.length), VALID);

  it("reports how much of the map any radar can see", () => {
    const stats = sum([NO_COVERAGE, NO_COVERAGE, NO_ECHO, 30]);

    assert.equal(stats.radarCoveragePct, 50);
  });

  // The number that keeps the panel honest: 1 echoing cell in 2 covered ones is
  // 50%, not the 25% a whole-map denominator would report.
  it("measures echo against covered ground, not the whole map", () => {
    const stats = sum([NO_COVERAGE, NO_COVERAGE, NO_ECHO, 30]);

    assert.equal(stats.echoPct, 50);
  });

  it("counts only cells that reach the lowest contour", () => {
    const stats = sum([19, 20, 21]);

    assert.equal(stats.echoPct, 66.67);
  });

  it("reports the strongest cell", () => {
    assert.equal(sum([20, 47, 30]).peakDbz, 47);
  });

  // "Nothing is raining" and "the peak is -99 dBZ" are different sentences, and
  // only one of them is true of an empty scene.
  it("has no peak when nothing reaches the lowest contour", () => {
    const stats = sum([NO_ECHO, NO_ECHO, NO_COVERAGE]);

    assert.equal(stats.peakDbz, null);
    assert.equal(stats.echoKm2, 0);
  });

  it("carries the scene's own time, not the fetch time", () => {
    assert.equal(sum([30]).validTime, VALID);
  });

  // A 0.01 degree cell is ~1.11 km tall everywhere and ~0.85 km wide at 40 N.
  // A fixed figure would overstate everything north of the Gulf.
  it("shrinks a cell's area with the cosine of its latitude", () => {
    const many = (lat: number) => {
      const n = 100;
      return summarize(
        {
          nx: n,
          ny: 1,
          values: new Float32Array(n).fill(30),
        },
        {
          nx: n,
          ny: 1,
          lats: new Float32Array(n).fill(lat),
          lons: new Float32Array(n).fill(-100),
        },
        VALID
      ).echoKm2;
    };

    assert.ok(many(50) < many(25), `${many(50)} !< ${many(25)}`);
    const side = 0.01 * 111.32;
    assert.ok(
      Math.abs(many(40) - 100 * side * side * Math.cos((40 * Math.PI) / 180)) <
        2
    );
  });

  it("says nothing is covered rather than dividing by zero", () => {
    const stats = sum([NO_COVERAGE, NO_COVERAGE]);

    assert.equal(stats.radarCoveragePct, 0);
    assert.equal(stats.echoPct, 0);
  });
});

describe("sceneTime", () => {
  it("reads the scene's own validity, not the wall clock", () => {
    assert.equal(sceneTime("20260812", "1430"), "2026-08-12T14:30:00.000Z");
  });

  // eccodes prints the time as an integer, so 04:02 arrives as "402" and
  // midnight as "0". Slicing without padding reports the wrong hour.
  it("pads a time that lost its leading zero", () => {
    assert.equal(sceneTime("20260812", "402"), "2026-08-12T04:02:00.000Z");
  });

  it("reads a midnight scene", () => {
    assert.equal(sceneTime("20260812", "0"), "2026-08-12T00:00:00.000Z");
  });

  it("refuses a date it cannot read rather than inventing one", () => {
    assert.throws(() => sceneTime("not-a-date", "1200"), /unreadable/);
  });
});
