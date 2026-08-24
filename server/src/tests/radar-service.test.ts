// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  blockAverage,
  blockGeo,
  nativeGeo,
  nativeGrid,
  sceneTime,
  summarize,
} from "../lib/services/mrms/radar";
import { polygons } from "../lib/services/shared/contour";

/** MRMS's own sentinels, which the block grid keeps. */
const NO_ECHO = -99;
const NO_COVERAGE = -999;

/** dBZ -> reflectivity factor, so tests can state the answer in Z. */
const z = (dbz: number) => Math.pow(10, dbz / 10);
const dbz = (Z: number) => 10 * Math.log10(Z);

/**
 * A grid of `BLOCK` x `BLOCK` points that averages to exactly one output cell.
 * `fill` is the value everywhere; `some` overwrites the first `n` points.
 */
const oneBlock = (fill: number, some: number[] = []) => {
  const values = new Float32Array(12 * 12).fill(fill);
  some.forEach((v, i) => (values[i] = v));
  return values;
};

const only = (grid: { values: Float32Array }) => grid.values[0];

describe("blockAverage (reflectivity)", () => {
  it("averages in reflectivity factor, not in dBZ", () => {
    // 72 points at 20 dBZ and 72 at 50 dBZ. The dBZ mean would be 35; the
    // physical answer is the mean of Z, which is ~47 dBZ.
    const values = oneBlock(50, new Array(72).fill(20));

    const got = only(blockAverage(values, 12, 12));

    assert.equal(
      Math.round(got),
      Math.round(dbz((72 * z(20) + 72 * z(50)) / 144))
    );
    assert.ok(got > 46 && got < 48, `${got}`);
  });

  it("keeps a single value unchanged", () => {
    assert.equal(Math.round(only(blockAverage(oneBlock(35), 12, 12))), 35);
  });

  // The radar looked and found nothing. That is data, and it must dilute the
  // cell it shares with an echo rather than being skipped.
  it("counts no-echo points as zero water, not as absent", () => {
    const values = oneBlock(NO_ECHO, new Array(72).fill(40));

    const got = only(blockAverage(values, 12, 12));

    assert.equal(Math.round(got), Math.round(dbz((72 * z(40)) / 144)));
  });

  // The opposite case, and the one that would lie: no radar sees these points,
  // so they cannot be evidence that it is not raining there.
  it("drops no-coverage points from the denominator", () => {
    const values = oneBlock(NO_COVERAGE, new Array(72).fill(40));

    const got = only(blockAverage(values, 12, 12));

    assert.equal(Math.round(got), 40);
  });

  it("marks a block nothing covers as no coverage", () => {
    assert.equal(
      only(blockAverage(oneBlock(NO_COVERAGE), 12, 12)),
      NO_COVERAGE
    );
  });

  it("marks a covered block with no echo as no echo, not as no coverage", () => {
    assert.equal(only(blockAverage(oneBlock(NO_ECHO), 12, 12)), NO_ECHO);
  });

  it("puts both sentinels below every contour level", () => {
    assert.ok(NO_ECHO < 20);
    assert.ok(NO_COVERAGE < 20);
  });
});

describe("blockAverage orientation", () => {
  /**
   * MRMS scans north to south and the contourer reads ring orientation from
   * signed area, so a north-up grid inverts every ring and the polygons are
   * silently dropped. This is the assertion that catches that: the echo is in
   * the *first* source row, which is the northernmost, and must come out in the
   * *last* grid row.
   */
  it("flips north-up rows into the south-up grid the contourer expects", () => {
    const values = new Float32Array(12 * 24).fill(NO_ECHO);
    for (let i = 0; i < 12 * 12; i++) values[i] = 40; // northern block

    const grid = blockAverage(values, 12, 24);

    assert.equal(grid.ny, 2);
    assert.equal(Math.round(grid.values[1]), 40); // row 1 is the north one
    assert.equal(grid.values[0], NO_ECHO);
  });

  it("gives the northern block the higher latitude", () => {
    const geo = blockGeo(12, 24);

    assert.ok(geo.lats[1] > geo.lats[0]);
  });

  // The bug this pair exists for: with the rows the other way up every ring's
  // signed area flips, exteriors are read as holes, and a solid blob contours to
  // nothing at all.
  it("contours a blob rather than dropping it as an inverted ring", () => {
    // 3x3 blocks; the echo is the middle block of the northernmost row.
    const values = new Float32Array(36 * 36).fill(NO_ECHO);
    for (let row = 0; row < 12; row++) {
      for (let col = 12; col < 24; col++) values[row * 36 + col] = 40;
    }

    const rings = polygons(blockAverage(values, 36, 36), blockGeo(36, 36), 20);

    assert.equal(rings.length, 1);
  });

  it("draws that blob in the north, where the radar saw it", () => {
    const values = new Float32Array(36 * 36).fill(NO_ECHO);
    for (let row = 0; row < 12; row++) {
      for (let col = 12; col < 24; col++) values[row * 36 + col] = 40;
    }
    const geo = blockGeo(36, 36);

    const [exterior] = polygons(blockAverage(values, 36, 36), geo, 20)[0];
    const lats = exterior.map(([, lat]) => lat);

    assert.ok(Math.min(...lats) > geo.lats[geo.nx], `${Math.min(...lats)}`);
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

describe("blockGeo", () => {
  it("places the first block at the mosaic's north-west corner", () => {
    const geo = blockGeo();

    // 583 x 291 blocks of 12, centred half a block in from 54.995 N, 129.995 W.
    const north = geo.lats[(geo.ny - 1) * geo.nx];
    assert.ok(Math.abs(north - 54.94) < 0.01, `${north}`);
    assert.ok(Math.abs(geo.lons[0] - -129.94) < 0.01, `${geo.lons[0]}`);
  });

  it("steps a block at a time, not a point at a time", () => {
    const geo = blockGeo();

    assert.ok(Math.abs(geo.lons[1] - geo.lons[0] - 0.12) < 1e-4);
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
