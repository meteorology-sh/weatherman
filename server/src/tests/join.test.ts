// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  emptyPoint,
  join,
  readPoint,
  sampleRadar,
  summarize,
  topHoldsLiquid,
} from "../lib/services/candidate/join";
import { CEILING_FT } from "../lib/services/shared/aircraft";
import { CELL_KM2 } from "../lib/services/shared/grid";
import { nativeGeo } from "../lib/services/mrms/radar";
import { PHASE } from "../lib/services/goes/phase";

// Types
import type { Inputs, Join } from "../lib/services/candidate/join";
import type { CloudPhase } from "../lib/services/goes/phase";
import type { Geo } from "../lib/services/shared/contour";

const RUN = new Date("2025-05-15T18:00:00.000Z");

/** No coverage and clear sky, as the two upstream services spell them. */
const NO_COVERAGE = -999;
const CLEAR = -999;

/**
 * One cell that passes every test, with any field overridden.
 *
 * Cloud base 6,000 ft, band cold edge 22,000 ft, an observed top at −14 °C, a
 * quiet radar and 120 g/m² of liquid: an ordinary rainy-season candidate. The
 * observed phase is separate because it is the one input that is a class rather
 * than a measurement, and `null` is the real case where no scene could be read.
 */
function cell(
  over: Partial<Record<Exclude<keyof Inputs, "topPhase">, number>> = {},
  phase: CloudPhase | null = "supercooled"
): Inputs {
  const one = (v: number) => new Float32Array([v]);
  return {
    slw: one(over.slw ?? 120),
    cloudBaseFt: one(over.cloudBaseFt ?? 6000),
    bandTopFt: one(over.bandTopFt ?? 22000),
    topColdnessC: one(over.topColdnessC ?? 14),
    dbz: one(over.dbz ?? 5),
    topPhase: phase === null ? null : one(PHASE[phase]),
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
      topPhase: null,
    };

    const out = join(inputs);
    const candidates = Array.from(out.values).filter((v) => v > 0).length;
    const rejections = Object.values(out.rejected).reduce((a, b) => a + b, 0);

    assert.equal(out.liquid, 5);
    assert.equal(candidates + rejections, out.liquid);
  });
});

/**
 * The observed cloud-top phase, which is counted and never acted on.
 *
 * The satellite sees the top of the cloud and the seeding band is inside it, so
 * an observation of a frozen top is evidence about a candidate rather than a
 * verdict on one — and under multi-layer cloud it is evidence about a different
 * cloud entirely. These pin that it stays evidence.
 */
describe("the observed cloud-top phase", () => {
  it("cannot turn a candidate into a rejection", () => {
    const glaciated = join(cell({}, "ice"));

    assert.equal(glaciated.values[0], 120);
    assert.equal(
      Object.values(glaciated.rejected).reduce((a, b) => a + b, 0),
      0
    );
  });

  it("cannot turn a rejection into a candidate", () => {
    const raining = join(cell({ dbz: 45 }, "supercooled"));

    assert.equal(raining.values[0], 0);
    assert.equal(raining.rejected.raining, 1);
  });

  it("confirms a candidate the satellite sees a supercooled top over", () => {
    assert.equal(join(cell({}, "supercooled")).phase.confirmed, 1);
  });

  // Glaciation in progress is the cloud still holding liquid, so it counts with
  // the confirmations rather than against them.
  it("confirms a candidate whose top is still glaciating", () => {
    assert.equal(join(cell({}, "mixed")).phase.confirmed, 1);
  });

  it("charges a candidate with an observed frozen top to glaciated", () => {
    const out = join(cell({}, "ice"));

    assert.equal(out.phase.glaciated, 1);
    assert.equal(out.phase.confirmed, 0);
  });

  // Neither confirmation nor contradiction. A candidate the observation cannot
  // settle has to be visible as that rather than folded into either side.
  it("leaves a candidate the satellite cannot classify unresolved", () => {
    assert.equal(join(cell({}, "unknown")).phase.unresolved, 1);
  });

  // The direction the plan does not name and the more expensive one: this cell
  // never reached the map to be rejected.
  it("counts a supercooled top the model puts no liquid under", () => {
    const out = join(cell({ slw: 4 }, "supercooled"));

    assert.equal(out.phase.missed, 1);
    assert.equal(out.liquid, 0);
  });

  it("does not count a frozen top over ground with no modelled liquid", () => {
    assert.equal(join(cell({ slw: 4 }, "ice")).phase.missed, 0);
  });

  // Every count partitions candidate ground, so a build with no scene reports
  // nothing rather than reporting zero of everything as though it had looked.
  it("counts nothing at all where no scene could be read", () => {
    const out = join(cell({}, null));

    assert.equal(out.values[0], 120);
    assert.deepEqual(out.phase, {
      confirmed: 0,
      glaciated: 0,
      unresolved: 0,
      missed: 0,
    });
  });

  /**
   * The same rule decides the count in the panel and the outline on the map, so
   * they cannot come to different answers about a cell.
   */
  describe("what counts as a liquid top", () => {
    it("counts supercooled and freezing-over tops", () => {
      const one = (name: CloudPhase) => new Float32Array([PHASE[name]]);

      assert.equal(topHoldsLiquid(one("supercooled"), 0), true);
      assert.equal(topHoldsLiquid(one("mixed"), 0), true);
      assert.equal(topHoldsLiquid(one("ice"), 0), false);
      assert.equal(topHoldsLiquid(one("liquid"), 0), false);
      assert.equal(topHoldsLiquid(one("clear"), 0), false);
    });

    // An unobserved cell is not a confirmed one. The panel says separately that
    // nothing was observed, so this must not quietly claim it was.
    it("confirms nothing where no scene could be read", () => {
      assert.equal(topHoldsLiquid(null, 0), false);
    });

    it("agrees with the count the panel reports", () => {
      const inputs = cell({}, "supercooled");

      assert.equal(join(inputs).phase.confirmed, 1);
      assert.equal(topHoldsLiquid(inputs.topPhase, 0), true);
    });
  });

  it("accounts for every candidate cell exactly once", () => {
    const inputs: Inputs = {
      slw: new Float32Array([120, 120, 120, 120, 120]),
      cloudBaseFt: new Float32Array([6000, 6000, 6000, 6000, 6000]),
      bandTopFt: new Float32Array([22000, 22000, 22000, 22000, 22000]),
      topColdnessC: new Float32Array([14, 14, 14, 14, 14]),
      // The last one is raining, so it is not candidate ground at all.
      dbz: new Float32Array([5, 5, 5, 5, 45]),
      topPhase: new Float32Array([
        PHASE.supercooled,
        PHASE.mixed,
        PHASE.ice,
        PHASE.liquid,
        PHASE.supercooled,
      ]),
    };

    const out = join(inputs);
    const { confirmed, glaciated, unresolved } = out.phase;

    assert.equal(confirmed, 2);
    assert.equal(glaciated, 1);
    assert.equal(unresolved, 1);
    assert.equal(confirmed + glaciated + unresolved, 4);
  });
});

describe("sampleRadar", () => {
  /** Two HRRR cells placed on known mosaic cell centres. */
  const geo = (points: [number, number][]): Geo => ({
    nx: points.length,
    ny: 1,
    lats: new Float32Array(points.map((p) => p[0])),
    lons: new Float32Array(points.map((p) => p[1])),
  });

  it("reads the 1 km cell a centre falls in", () => {
    const mosaic = nativeGeo(12, 12);
    const values = new Float32Array(mosaic.nx * mosaic.ny).fill(-99);
    values[5] = 42;

    const sampled = sampleRadar(
      { nx: mosaic.nx, ny: mosaic.ny, values },
      geo([[mosaic.lats[5], mosaic.lons[5]]])
    );

    assert.equal(sampled[0], 42);
  });

  // The HRRR domain runs past the mosaic's box, and off the edge is not a
  // report of clear air.
  it("reads a cell outside the mosaic's box as no coverage", () => {
    const mosaic = nativeGeo(12, 12);
    const values = new Float32Array(mosaic.nx * mosaic.ny).fill(30);

    const sampled = sampleRadar(
      { nx: mosaic.nx, ny: mosaic.ny, values },
      geo([[10, -100]])
    );

    assert.equal(sampled[0], NO_COVERAGE);
  });

  // MRMS scans north to south and the native grid is stored south-up. Sampling
  // against the wrong convention mirrors the country without erroring.
  it("agrees with the mosaic's own geometry at both ends", () => {
    const mosaic = nativeGeo(12, 12);
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
    phaseTime: "2025-05-15T18:01:17.900Z",
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
    phase: { confirmed: 0, glaciated: 0, unresolved: 0, missed: 0 },
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

  it("reports the observed cross-check in km², like every other area", () => {
    const stats = summarize(
      joined({
        phase: { confirmed: 2, glaciated: 1, unresolved: 0, missed: 3 },
      }),
      context()
    );

    assert.equal(stats.phase.confirmedKm2, 2 * CELL_KM2);
    assert.equal(stats.phase.glaciatedKm2, 1 * CELL_KM2);
    assert.equal(stats.phase.unresolvedKm2, 0);
    assert.equal(stats.phase.missedKm2, 3 * CELL_KM2);
  });

  // A missing scene has to read as missing. Zeroes with a time on them would
  // say the satellite looked and confirmed nothing, which is a different claim.
  it("has no phase scan time where no scene could be read", () => {
    const stats = summarize(joined(), context({ phaseTime: null }));

    assert.equal(stats.phase.sceneTime, null);
  });

  it("names the phase scan it was checked against", () => {
    assert.equal(
      summarize(joined(), context()).phase.sceneTime,
      "2025-05-15T18:01:17.900Z"
    );
  });
});

describe("readPoint", () => {
  const where = {
    run: "2025-05-15T18:00:00.000Z",
    validTime: "2025-05-15T18:00:00.000Z",
    sceneTime: "2025-05-15T18:01:17.900Z",
    radarTime: "2025-05-15T18:00:39.000Z",
    phaseTime: "2025-05-15T18:01:17.900Z",
    lat: 32.1,
    lon: -101.4,
  };

  /** A covered block the radar reports clear air over, as the mosaic spells it. */
  const NO_ECHO = -99;

  it("reports what is in the cell, not what it is a fraction of", () => {
    const point = readPoint(cell(), 0, where);

    assert.equal(point.verdict, "candidate");
    assert.equal(point.slwGM2, 120);
    assert.equal(point.cloudBaseFt, 6000);
    assert.equal(point.cloudTopC, -14);
    assert.equal(point.dbz, 5);
  });

  // The same arithmetic the map is drawn from, so green ground and a green
  // readout cannot disagree about a cell.
  it("agrees with the join about every cell", () => {
    const inputs: Inputs = {
      slw: new Float32Array([120, 120, 120, 120, 4]),
      cloudBaseFt: new Float32Array([6000, NaN, 6000, 6000, 6000]),
      bandTopFt: new Float32Array([22000, 22000, 22000, 22000, 22000]),
      topColdnessC: new Float32Array([14, 14, CLEAR, 14, 14]),
      dbz: new Float32Array([5, 5, 5, 45, 5]),
      topPhase: null,
    };
    const out = join(inputs);

    for (let i = 0; i < inputs.slw.length; i++) {
      const drawn = out.values[i] > 0;
      assert.equal(readPoint(inputs, i, where).verdict === "candidate", drawn);
    }
  });

  it("names the test that ruled the cell out", () => {
    assert.equal(readPoint(cell({ dbz: 45 }), 0, where).verdict, "raining");
    assert.equal(
      readPoint(cell({ cloudBaseFt: NaN }), 0, where).verdict,
      "noCloudBase"
    );
    assert.equal(readPoint(cell({ slw: 4 }), 0, where).verdict, "noLiquid");
  });

  // Stored as degrees below zero, which is the cloud-top layer's convention and
  // nobody else's. Printing it raw would report a −40 °C top as +40 °C.
  it("turns cloud-top coldness back into a temperature", () => {
    assert.equal(
      readPoint(cell({ topColdnessC: 40 }), 0, where).cloudTopC,
      -40
    );
  });

  it("reports no cloud top where the satellite sees clear sky", () => {
    assert.equal(
      readPoint(cell({ topColdnessC: CLEAR }), 0, where).cloudTopC,
      null
    );
  });

  it("reports no cloud base where the model has no cloud", () => {
    assert.equal(
      readPoint(cell({ cloudBaseFt: NaN }), 0, where).cloudBaseFt,
      null
    );
  });

  // The two ways a cell has no reflectivity mean opposite things: a radar
  // watching clear air, and no radar looking at all.
  it("separates a quiet radar from no radar", () => {
    const quiet = readPoint(cell({ dbz: NO_ECHO }), 0, where);
    const unwatched = readPoint(cell({ dbz: NO_COVERAGE }), 0, where);

    assert.equal(quiet.dbz, null);
    assert.equal(quiet.radarCovered, true);
    assert.equal(unwatched.dbz, null);
    assert.equal(unwatched.radarCovered, false);
  });

  // Unchecked is not cleared, so the cell is still a candidate.
  it("keeps an uncovered cell a candidate", () => {
    assert.equal(
      readPoint(cell({ dbz: NO_COVERAGE }), 0, where).verdict,
      "candidate"
    );
  });

  it("reports the cell it read and all three source times", () => {
    const point = readPoint(cell(), 0, where);

    assert.equal(point.lat, 32.1);
    assert.equal(point.lon, -101.4);
    assert.equal(point.run, "2025-05-15T18:00:00.000Z");
    assert.equal(point.sceneTime, "2025-05-15T18:01:17.900Z");
    assert.equal(point.radarTime, "2025-05-15T18:00:39.000Z");
  });

  it("reports the observed phase as a name, not as the code it rode on", () => {
    assert.equal(
      readPoint(cell({}, "supercooled"), 0, where).topPhase,
      "supercooled"
    );
    assert.equal(readPoint(cell({}, "ice"), 0, where).topPhase, "ice");
  });

  it("reports no phase where no scene could be read", () => {
    assert.equal(readPoint(cell({}, null), 0, where).topPhase, null);
  });

  // The readout says what the satellite saw even where the model found nothing,
  // because that disagreement is the reason to carry the observation at all.
  it("reports an observed phase over a cell with nothing to seed", () => {
    const point = readPoint(cell({ slw: 4 }, "supercooled"), 0, where);

    assert.equal(point.verdict, "noLiquid");
    assert.equal(point.topPhase, "supercooled");
  });

  it("has nothing to seed where the domain holds no seeding band", () => {
    const point = emptyPoint(where);

    assert.equal(point.verdict, "noLiquid");
    assert.equal(point.slwGM2, 0);
    assert.equal(point.cloudTopC, null);
    assert.equal(point.lat, 32.1);
  });
});
