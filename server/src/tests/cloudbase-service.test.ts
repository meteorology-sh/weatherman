// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  SEEDABLE_BASE_FT,
  baseStats,
  bearing,
  diagnostics,
  recordsAt,
} from "../lib/services/hrrr/diagnostics";
import { CEILING_FT } from "../lib/services/shared/aircraft";

// Types
import type { Fields } from "../lib/services/hrrr/diagnostics";
import type { Grid } from "../lib/services/shared/contour";

const RUN = new Date("2025-05-15T18:00:00.000Z");

describe("recordsAt", () => {
  // The same fact PRATE has, verified the same way: LTNG at f00 is a 188-byte
  // constant field of zeros, so the analysis hour must not download it.
  it("skips lightning at the analysis hour", () => {
    assert.equal(recordsAt(0).includes("lightning"), false);
    assert.equal(recordsAt(1).includes("lightning"), true);
  });

  // Everything else is a state the analysis holds, so the candidate map's own
  // hour is not a degraded one.
  it("reads every other diagnostic at the analysis hour", () => {
    const analysis = recordsAt(0);

    for (const id of recordsAt(1)) {
      if (id === "lightning") continue;
      assert.ok(analysis.includes(id), `${id} missing at f00`);
    }
  });

  it("reads cloud base at every hour, since the layer is drawn from it", () => {
    for (const hour of [0, 1, 18]) {
      assert.ok(recordsAt(hour).includes("cloudBase"));
    }
  });
});

describe("baseStats", () => {
  /** One row of cells, so the percentages are easy to read off. */
  const grid = (values: number[]): Grid => ({
    nx: values.length,
    ny: 1,
    values: new Float32Array(values),
  });

  it("counts only cells that have a base at all", () => {
    const stats = baseStats(RUN, 0, grid([3000, NaN, NaN, NaN]));

    assert.equal(stats.basePct, 25);
  });

  it("counts reachable cloud against the whole domain, not against the cloud", () => {
    const stats = baseStats(RUN, 0, grid([5000, 25000, NaN, NaN]));

    assert.equal(stats.reachablePct, 25);
  });

  // Half-open, matching the bands the map is drawn with: a base exactly on the
  // ceiling belongs to the band above it, and must not be counted twice.
  it("puts a base exactly on the ceiling out of reach", () => {
    const stats = baseStats(RUN, 0, grid([CEILING_FT - 1, CEILING_FT]));

    assert.equal(stats.reachablePct, 50);
  });

  // The seeding criterion is reported elsewhere; this figure is the
  // aircraft's limit. A base above the 12,000 ft seeding bound but under the
  // ceiling is still reachable, which is what this measures and all it does.
  it("measures against the ceiling, not the seeding criterion", () => {
    const stats = baseStats(
      RUN,
      0,
      grid([SEEDABLE_BASE_FT + 1000, SEEDABLE_BASE_FT + 2000])
    );

    assert.equal(stats.reachablePct, 100);
  });

  it("reports the median of the cells that have a base", () => {
    const stats = baseStats(RUN, 0, grid([1000, 5000, 9000, NaN]));

    assert.equal(stats.medianFt, 5000);
  });

  // A clear domain is a real answer, not a zero-foot cloud base.
  it("reports no median when nothing has a base", () => {
    const stats = baseStats(RUN, 0, grid([NaN, NaN]));

    assert.equal(stats.medianFt, null);
    assert.equal(stats.basePct, 0);
  });

  it("carries the run's valid time for the hour asked for", () => {
    const stats = baseStats(RUN, 6, grid([3000]));

    assert.equal(stats.validTime, "2025-05-16T00:00:00.000Z");
  });
});

describe("diagnostics", () => {
  /** One cell, with only the fields a case is making a claim about. */
  const fields = (over: Record<string, number>): Fields => {
    const out: Fields = new Map();
    for (const [id, value] of Object.entries(over)) {
      out.set(id as never, new Float32Array([value]));
    }
    return out;
  };

  const surfaceFt = 2500;

  it("reports the base above the ground as well as above the sea", () => {
    const d = diagnostics(fields({ cloudBase: 6000 }), 0, surfaceFt, null);

    assert.equal(d.cloudBaseFt, 6000);
    assert.equal(d.cloudBaseAglFt, 3500);
  });

  it("has no base where the model has no cloud over the cell", () => {
    const d = diagnostics(fields({ cloudBase: NaN }), 0, surfaceFt, null);

    assert.equal(d.cloudBaseFt, null);
    assert.equal(d.cloudBaseAglFt, null);
  });

  it("computes depth from base to top", () => {
    const d = diagnostics(
      fields({ cloudBase: 4000, cloudTop: 30000 }),
      0,
      surfaceFt,
      null
    );

    assert.equal(d.depthFt, 26000);
  });

  // HGT:cloud top reports one deck rather than the highest, so the two
  // diagnostics can describe different decks and invert. That is not a cloud
  // 200 ft thick, and reporting a number for it would invent a depth.
  it("refuses a depth when the top is at or below the base", () => {
    const d = diagnostics(
      fields({ cloudBase: 8000, cloudTop: 7000 }),
      0,
      surfaceFt,
      null
    );

    assert.equal(d.depthFt, null);
  });

  describe("the band against the cloud", () => {
    it("passes when the band's base is between cloud base and top", () => {
      const d = diagnostics(
        fields({ cloudBase: 4000, cloudTop: 30000 }),
        0,
        surfaceFt,
        16000
      );

      assert.equal(d.bandInCloud, true);
    });

    it("fails when the band sits above the cloud entirely", () => {
      const d = diagnostics(
        fields({ cloudBase: 4000, cloudTop: 9000 }),
        0,
        surfaceFt,
        16000
      );

      assert.equal(d.bandInCloud, false);
    });

    // The common case: HRRR diagnoses a base far more often than a top. "We
    // cannot tell" must not come back as "no".
    it("is unknown rather than false when there is no cloud top", () => {
      const d = diagnostics(
        fields({ cloudBase: 4000, cloudTop: NaN }),
        0,
        surfaceFt,
        16000
      );

      assert.equal(d.bandInCloud, null);
    });

    it("is unknown when the column has no band base", () => {
      const d = diagnostics(
        fields({ cloudBase: 4000, cloudTop: 30000 }),
        0,
        surfaceFt,
        null
      );

      assert.equal(d.bandInCloud, null);
    });
  });

  it("reports storm motion in knots", () => {
    // 10 m/s east, nothing north.
    const d = diagnostics(
      fields({ stormU: 10, stormV: 0 }),
      0,
      surfaceFt,
      null
    );

    assert.equal(d.stormMotionKt, 19);
    assert.equal(d.stormMotionTowardDeg, 90);
  });

  // atan2(0, 0) is 0, which would print "toward north" for still air.
  it("has no direction when the storm is not moving", () => {
    const d = diagnostics(fields({ stormU: 0, stormV: 0 }), 0, surfaceFt, null);

    assert.equal(d.stormMotionTowardDeg, null);
  });

  // LTNG at f00 is a 188-byte constant field, so the hour does not carry it and
  // the build never asks for it. Absent is not zero flashes.
  it("reports no lightning at an hour that does not diagnose it", () => {
    const d = diagnostics(fields({ cape: 2000 }), 0, surfaceFt, null);

    assert.equal(d.lightning, null);
  });

  it("distinguishes a diagnosed zero from an undiagnosed hour", () => {
    const d = diagnostics(fields({ lightning: 0 }), 0, surfaceFt, null);

    assert.equal(d.lightning, 0);
  });

  // RETOP writes -999 where there is no echo, and the block average drops it
  // like any other nodata — so a quiet cell has no echo top rather than one
  // 999 meters below sea level.
  it("has no echo top where the model diagnoses no echo", () => {
    const d = diagnostics(fields({ echoTop: NaN }), 0, surfaceFt, null);

    assert.equal(d.echoTopFt, null);
  });

  it("reports mixed-layer CIN as a magnitude", () => {
    const d = diagnostics(fields({ cin: -150 }), 0, surfaceFt, null);

    assert.equal(d.cinJKg, 150);
  });

  it("reports no inhibition when CIN is zero", () => {
    const d = diagnostics(fields({ cin: 0 }), 0, surfaceFt, null);

    assert.equal(d.cinJKg, 0);
  });

  it("reports LCL in feet", () => {
    const d = diagnostics(fields({ lcl: 4500 }), 0, surfaceFt, null);

    assert.equal(d.lclFt, 4500);
  });

  it("has no LCL where the field is missing", () => {
    const d = diagnostics(fields({ lcl: NaN }), 0, surfaceFt, null);

    assert.equal(d.lclFt, null);
  });
});

describe("bearing", () => {
  // Storm motion is named by where it is going and wind by where it comes
  // from; getting this backwards is 180 degrees wrong without looking wrong.
  it("names the direction the vector points toward", () => {
    assert.equal(bearing(0, 10), 0); // due north
    assert.equal(bearing(10, 0), 90); // due east
    assert.equal(bearing(0, -10), 180); // due south
    assert.equal(bearing(-10, 0), 270); // due west
  });

  it("reads a northeasterly vector as 45 degrees", () => {
    assert.equal(bearing(7.07, 7.07), 45);
  });
});
