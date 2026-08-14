// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  CEILING_FT,
  join,
  sampleRadar,
  summarize,
} from "../lib/services/candidate/join";
import { blockGeo } from "../lib/services/mrms/radar";

// Types
import type { Inputs, Join } from "../lib/services/candidate/join";
import type { Geo } from "../lib/services/shared/contour";

const RUN = new Date("2025-05-15T18:00:00.000Z");
const CELL_KM2 = 144;

/** No coverage and clear sky, as the two upstream services spell them. */
const NO_COVERAGE = -999;
const CLEAR = -999;

/**
 * One cell that passes every test, with any field overridden.
 *
 * Cloud base 6,000 ft, band cold edge 22,000 ft, an observed top at −14 °C, a
 * quiet radar and 120 g/m² of liquid: an ordinary rainy-season candidate.
 */
function cell(over: Partial<Record<keyof Inputs, number>> = {}): Inputs {
  const one = (v: number) => new Float32Array([v]);
  return {
    slw: one(over.slw ?? 120),
    cloudBaseFt: one(over.cloudBaseFt ?? 6000),
    bandTopFt: one(over.bandTopFt ?? 22000),
    topColdnessC: one(over.topColdnessC ?? 14),
    dbz: one(over.dbz ?? 5),
  };
}

describe("join", () => {
  it("keeps a cell that passes every test, carrying its liquid through", () => {
    const out = join(cell());

    assert.equal(out.values[0], 120);
    assert.equal(out.liquid, 1);
  });

  // The candidate field is the liquid field with the other tests applied, so
  // the value it carries has to be the liquid itself — the two layers are read
  // against each other on the same ramp.
  it("carries the liquid water path as the value, not a score", () => {
    const out = join(cell({ slw: 47 }));

    assert.equal(out.values[0], 47);
  });

  it("ignores a cell below the lowest liquid contour entirely", () => {
    const out = join(cell({ slw: 4 }));

    assert.equal(out.values[0], 0);
    // Not liquid, so not rejected either — it was never a candidate to lose.
    assert.equal(out.liquid, 0);
    assert.equal(out.rejected.noCloudBase, 0);
  });

  it("takes the lowest liquid contour as the threshold", () => {
    assert.equal(join(cell({ slw: 10 })).values[0], 10);
    assert.equal(join(cell({ slw: 9.9 })).values[0], 0);
  });

  describe("a base to climb through", () => {
    it("rejects a cell the model gives no cloud base", () => {
      const out = join(cell({ cloudBaseFt: NaN }));

      assert.equal(out.values[0], 0);
      assert.equal(out.rejected.noCloudBase, 1);
    });

    // The cloud and the band are two intervals, and they overlap only if each
    // starts below where the other ends. A base above the band's cold edge is a
    // cloud entirely colder than the band.
    it("rejects a base above the band's cold edge", () => {
      const out = join(cell({ cloudBaseFt: 24000, bandTopFt: 22000 }));

      assert.equal(out.values[0], 0);
      assert.equal(out.rejected.baseAboveBand, 1);
    });

    // The half of this test that catches the *other* mistake: comparing against
    // the band's warm edge would throw this cell away, and it is a cloud with
    // the band inside it from the bottom up.
    it("keeps a base above the band's warm edge but below its cold edge", () => {
      const out = join(cell({ cloudBaseFt: 19000, bandTopFt: 22000 }));

      assert.equal(out.values[0], 120);
      assert.equal(out.rejected.baseAboveBand, 0);
    });

    it("rejects a cell whose column never reaches the band's cold edge", () => {
      const out = join(cell({ bandTopFt: NaN }));

      assert.equal(out.values[0], 0);
      assert.equal(out.rejected.baseAboveBand, 1);
    });
  });

  describe("an observed cloud reaching the band", () => {
    it("rejects a cell the satellite sees no cloud over", () => {
      const out = join(cell({ topColdnessC: CLEAR }));

      assert.equal(out.values[0], 0);
      assert.equal(out.rejected.noCloudSeen, 1);
      // Distinct from a warm top: this one contradicts the model outright.
      assert.equal(out.rejected.topTooWarm, 0);
    });

    it("rejects a top warmer than the band's warm edge", () => {
      // 3 stored means −3 °C, which is warmer than −5 °C.
      const out = join(cell({ topColdnessC: 3 }));

      assert.equal(out.values[0], 0);
      assert.equal(out.rejected.topTooWarm, 1);
      assert.equal(out.rejected.noCloudSeen, 0);
    });

    it("keeps a top exactly on the band's warm edge", () => {
      const out = join(cell({ topColdnessC: 5 }));

      assert.equal(out.values[0], 120);
    });

    // A colder top means the band is more fully enclosed by cloud, which is
    // better rather than worse. There is no cold cutoff anywhere in this app.
    it("keeps a very cold top", () => {
      assert.equal(join(cell({ topColdnessC: 60 })).values[0], 120);
    });
  });

  describe("not already raining", () => {
    it("rejects a cell the radar is watching precipitate", () => {
      const out = join(cell({ dbz: 35 }));

      assert.equal(out.values[0], 0);
      assert.equal(out.rejected.raining, 1);
    });

    it("takes the lowest radar contour as the threshold", () => {
      assert.equal(join(cell({ dbz: 20 })).values[0], 0);
      assert.equal(join(cell({ dbz: 19 })).values[0], 120);
    });

    // Absence of coverage is not evidence of rain. Vetoing on it would delete
    // every candidate over the third of the box no radar sees.
    it("does not let missing radar coverage veto a candidate", () => {
      const out = join(cell({ dbz: NO_COVERAGE }));

      assert.equal(out.values[0], 120);
      assert.equal(out.rejected.raining, 0);
    });

    it("counts an uncovered candidate as unchecked rather than cleared", () => {
      assert.equal(join(cell({ dbz: NO_COVERAGE })).blind, 1);
      assert.equal(join(cell({ dbz: 5 })).blind, 0);
    });
  });

  // A cell usually fails more than one test. Counting each failure separately
  // would report more rejected ground than there was liquid to reject.
  it("charges a cell to exactly one test", () => {
    const out = join(cell({ cloudBaseFt: NaN, topColdnessC: CLEAR, dbz: 45 }));

    const counts = Object.values(out.rejected);
    assert.equal(
      counts.reduce((a, b) => a + b, 0),
      1
    );
    assert.equal(out.rejected.noCloudBase, 1);
  });

  it("accounts for every liquid cell as either a candidate or a rejection", () => {
    const inputs: Inputs = {
      slw: new Float32Array([120, 120, 120, 120, 120, 4]),
      cloudBaseFt: new Float32Array([6000, NaN, 6000, 6000, 6000, 6000]),
      bandTopFt: new Float32Array([22000, 22000, 22000, 22000, 22000, 22000]),
      topColdnessC: new Float32Array([14, 14, CLEAR, 3, 14, 14]),
      dbz: new Float32Array([5, 5, 5, 5, 45, 5]),
    };

    const out = join(inputs);
    const candidates = Array.from(out.values).filter((v) => v > 0).length;
    const rejections = Object.values(out.rejected).reduce((a, b) => a + b, 0);

    assert.equal(out.liquid, 5);
    assert.equal(candidates + rejections, out.liquid);
  });
});

describe("sampleRadar", () => {
  /** Two HRRR cells placed on known mosaic block centres. */
  const geo = (points: [number, number][]): Geo => ({
    nx: points.length,
    ny: 1,
    lats: new Float32Array(points.map((p) => p[0])),
    lons: new Float32Array(points.map((p) => p[1])),
  });

  it("reads the block a cell's centre falls in", () => {
    const mosaic = blockGeo();
    const values = new Float32Array(mosaic.nx * mosaic.ny).fill(-99);
    values[5000] = 42;

    const sampled = sampleRadar(
      { nx: mosaic.nx, ny: mosaic.ny, values },
      geo([[mosaic.lats[5000], mosaic.lons[5000]]])
    );

    assert.equal(sampled[0], 42);
  });

  // The HRRR domain runs past the mosaic's box, and off the edge is not a
  // report of clear air.
  it("reads a cell outside the mosaic's box as no coverage", () => {
    const mosaic = blockGeo();
    const values = new Float32Array(mosaic.nx * mosaic.ny).fill(30);

    const sampled = sampleRadar(
      { nx: mosaic.nx, ny: mosaic.ny, values },
      geo([[10, -100]])
    );

    assert.equal(sampled[0], NO_COVERAGE);
  });

  // MRMS scans north to south and the block grid is stored south-up. Sampling
  // against the wrong convention mirrors the country without erroring.
  it("agrees with the block grid's own geometry at both ends", () => {
    const mosaic = blockGeo();
    const values = new Float32Array(mosaic.nx * mosaic.ny);
    const first = 0;
    const last = mosaic.nx * mosaic.ny - 1;
    values[first] = 11;
    values[last] = 22;

    const sampled = sampleRadar(
      { nx: mosaic.nx, ny: mosaic.ny, values },
      geo([
        [mosaic.lats[first], mosaic.lons[first]],
        [mosaic.lats[last], mosaic.lons[last]],
      ])
    );

    assert.equal(sampled[0], 11);
    assert.equal(sampled[1], 22);
  });
});

describe("summarize", () => {
  const context = (over: Partial<Parameters<typeof summarize>[1]> = {}) => ({
    run: RUN,
    validTime: "2025-05-15T18:00:00.000Z",
    sceneTime: "2025-05-15T18:01:17.900Z",
    radarTime: "2025-05-15T18:00:39.000Z",
    cloudBaseFt: new Float32Array([6000]),
    bandBaseFt: new Float32Array([16000]),
    mixedCape: new Float32Array([1800]),
    vil: new Float32Array([2.5]),
    stormU: new Float32Array([10]),
    stormV: new Float32Array([0]),
    ...over,
  });

  const joined = (over: Partial<Join> = {}): Join => ({
    values: new Float32Array([120]),
    liquid: 1,
    rejected: {
      noCloudBase: 0,
      baseAboveBand: 0,
      noCloudSeen: 0,
      topTooWarm: 0,
      raining: 0,
    },
    blind: 0,
    ...over,
  });

  it("reports candidate ground against the whole domain", () => {
    const stats = summarize(
      joined({ values: new Float32Array([120, 0, 0, 0]) }),
      context({
        cloudBaseFt: new Float32Array([6000, NaN, NaN, NaN]),
        bandBaseFt: new Float32Array([16000, NaN, NaN, NaN]),
        mixedCape: new Float32Array([1800, 0, 0, 0]),
        vil: new Float32Array([2.5, 0, 0, 0]),
        stormU: new Float32Array([10, 0, 0, 0]),
        stormV: new Float32Array([0, 0, 0, 0]),
      })
    );

    assert.equal(stats.coveragePct, 25);
    assert.equal(stats.candidateKm2, CELL_KM2);
  });

  // A blank candidate layer over an amber liquid layer reads as a bug unless
  // the panel can say which test emptied it.
  it("reports what each test removed, in the same units", () => {
    const stats = summarize(
      joined({
        values: new Float32Array([0]),
        liquid: 4,
        rejected: {
          noCloudBase: 1,
          baseAboveBand: 1,
          noCloudSeen: 1,
          topTooWarm: 1,
          raining: 0,
        },
      }),
      context()
    );

    assert.equal(stats.liquidKm2, 4 * CELL_KM2);
    assert.equal(stats.rejected.noCloudBase, CELL_KM2);
    assert.equal(stats.rejected.raining, 0);
  });

  it("reports the richest candidate cell", () => {
    const stats = summarize(
      joined({ values: new Float32Array([40, 380, 10]) }),
      context({
        cloudBaseFt: new Float32Array([6000, 6000, 6000]),
        bandBaseFt: new Float32Array([16000, 16000, 16000]),
        mixedCape: new Float32Array([100, 1800, 100]),
        vil: new Float32Array([1, 2.5, 1]),
        stormU: new Float32Array([0, 10, 0]),
        stormV: new Float32Array([0, 0, 0]),
      })
    );

    assert.equal(stats.peak, 380);
    // Storm motion is read at that cell, not domain-wide.
    assert.equal(stats.stormMotionKt, 19);
    assert.equal(stats.stormMotionTowardDeg, 90);
  });

  // A domain-wide peak would be a number about a thunderstorm somewhere else.
  it("reads the attributes over candidate ground only", () => {
    const stats = summarize(
      joined({ values: new Float32Array([120, 0]) }),
      context({
        cloudBaseFt: new Float32Array([6000, 6000]),
        bandBaseFt: new Float32Array([16000, 16000]),
        mixedCape: new Float32Array([1800, 6000]),
        vil: new Float32Array([2.5, 40]),
        stormU: new Float32Array([10, 90]),
        stormV: new Float32Array([0, 0]),
      })
    );

    assert.equal(stats.peakMixedCapeJKg, 1800);
    assert.equal(stats.peakVilKgM2, 2.5);
  });

  it("reports the operational window as a share of candidate ground", () => {
    const stats = summarize(
      joined({ values: new Float32Array([120, 120]) }),
      context({
        cloudBaseFt: new Float32Array([6000, 30000]),
        bandBaseFt: new Float32Array([16000, 16000]),
        mixedCape: new Float32Array([0, 0]),
        vil: new Float32Array([0, 0]),
        stormU: new Float32Array([0, 0]),
        stormV: new Float32Array([0, 0]),
      })
    );

    assert.equal(stats.windowPct, 50);
    assert.equal(stats.medianBaseFt, 6000);
  });

  // Reachability is reported, never a filter — a band above the ceiling in July
  // is correct output, not a warning.
  it("reports reachability against the ceiling without filtering on it", () => {
    const stats = summarize(
      joined({ values: new Float32Array([120, 120]) }),
      context({
        cloudBaseFt: new Float32Array([6000, 6000]),
        bandBaseFt: new Float32Array([16000, 21000]),
        mixedCape: new Float32Array([0, 0]),
        vil: new Float32Array([0, 0]),
        stormU: new Float32Array([0, 0]),
        stormV: new Float32Array([0, 0]),
      })
    );

    assert.equal(stats.ceilingFt, CEILING_FT);
    assert.equal(stats.reachablePct, 50);
    // Both cells are still candidates.
    assert.equal(stats.coveragePct, 100);
  });

  it("has no median where nothing is a candidate", () => {
    const stats = summarize(
      joined({ values: new Float32Array([0]) }),
      context()
    );

    assert.equal(stats.medianBaseFt, null);
    assert.equal(stats.medianBandBaseFt, null);
    assert.equal(stats.coveragePct, 0);
  });

  // atan2(0, 0) is 0, which would print "toward north" for still air.
  it("has no storm direction when nothing is moving", () => {
    const stats = summarize(
      joined(),
      context({ stormU: new Float32Array([0]), stormV: new Float32Array([0]) })
    );

    assert.equal(stats.stormMotionTowardDeg, null);
  });

  it("names all three source times, since the join is only as current as its slowest", () => {
    const stats = summarize(joined(), context());

    assert.equal(stats.run, "2025-05-15T18:00:00.000Z");
    assert.equal(stats.sceneTime, "2025-05-15T18:01:17.900Z");
    assert.equal(stats.radarTime, "2025-05-15T18:00:39.000Z");
  });
});
