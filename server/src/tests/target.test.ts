// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  emptyTarget,
  flyValues,
  join,
  readTarget,
  summarize,
  verdict,
} from "../lib/services/candidate/target";
import { BASE_WINDOW_FT } from "../lib/services/hrrr/diagnostics";
import { CELL_KM2 } from "../lib/services/shared/grid";
import { RAIN_DBZ } from "../lib/services/mrms/radar";

// Types
import type { TargetInputs } from "../lib/services/candidate/target";
import type { Geo } from "../lib/services/shared/contour";

const RUN = new Date("2025-05-15T18:00:00.000Z");
const [WINDOW_LOW, WINDOW_HIGH] = BASE_WINDOW_FT;
const NO_ECHO = -99;
const NO_COVERAGE = -999;

/**
 * One cell that passes every Texas test, with any field overridden.
 *
 * Base 8,000 ft MSL over 2,000 ft terrain (6,000 ft AGL), freezing at
 * 16,000 ft, 18 dBZ echo top at 18,000 ft, 35 dBZ: a raining convective
 * column with the aircraft in the operational window.
 */
function cell(
  over: Partial<Record<keyof Omit<TargetInputs, "nx" | "ny">, number>> = {}
): TargetInputs {
  const one = (v: number) => new Float32Array([v]);
  return {
    cloudBaseFt: one(over.cloudBaseFt ?? 8000),
    surfaceFt: one(over.surfaceFt ?? 2000),
    freezingFt: one(over.freezingFt ?? 16000),
    echoTopFt: one(over.echoTopFt ?? 18000),
    dbz: one(over.dbz ?? 35),
    nx: 1,
    ny: 1,
  };
}

/** A 3×3 of in-window bases with no echo and no echo top. Centre is 4. */
function quiet3(): TargetInputs {
  const fill = (v: number) => new Float32Array(9).fill(v);
  return {
    cloudBaseFt: fill(8000),
    surfaceFt: fill(2000),
    freezingFt: fill(16000),
    echoTopFt: fill(Number.NaN),
    dbz: fill(NO_ECHO),
    nx: 3,
    ny: 3,
  };
}

function put(
  inputs: TargetInputs,
  i: number,
  over: Partial<Record<keyof Omit<TargetInputs, "nx" | "ny">, number>>
) {
  if (over.cloudBaseFt !== undefined) inputs.cloudBaseFt[i] = over.cloudBaseFt;
  if (over.surfaceFt !== undefined) inputs.surfaceFt[i] = over.surfaceFt;
  if (over.freezingFt !== undefined) inputs.freezingFt[i] = over.freezingFt;
  if (over.echoTopFt !== undefined) inputs.echoTopFt[i] = over.echoTopFt;
  if (over.dbz !== undefined) inputs.dbz[i] = over.dbz;
}

const geoOf = (inputs: TargetInputs, lats: number[], lons: number[]): Geo => ({
  nx: inputs.nx,
  ny: inputs.ny,
  lats: new Float32Array(lats),
  lons: new Float32Array(lons),
});

describe("flyValues", () => {
  it("is 1 on passing cells and missing elsewhere", () => {
    const out = flyValues(join(cell()));
    assert.equal(out[0], 1);
    const empty = flyValues(join(cell({ cloudBaseFt: Number.NaN })));
    assert.ok(Number.isNaN(empty[0]));
  });
});

describe("target join", () => {
  it("keeps a raining column whose base is in the window and whose echo top is above freezing", () => {
    const out = join(cell());

    assert.equal(out.values[0], 1);
    assert.equal(out.target, 1);
  });

  it("does not ask about supercooled liquid — rain in the cell is not a reject", () => {
    assert.equal(verdict(cell({ dbz: 45 }), 0), "target");
    assert.equal(verdict(cell({ dbz: RAIN_DBZ }), 0), "target");
  });

  it("rejects a cell with no cloud base before anything else", () => {
    assert.equal(verdict(cell({ cloudBaseFt: Number.NaN }), 0), "noCloudBase");
  });

  it("applies the operational window in AGL, not MSL", () => {
    // 8,000 ft MSL over 5,000 ft terrain is 3,000 ft AGL — below the window
    // even though the MSL height would pass.
    assert.equal(
      verdict(cell({ cloudBaseFt: 8000, surfaceFt: 5000 }), 0),
      "baseOutsideWindow"
    );
  });

  it("keeps a base on the lower edge of the window", () => {
    assert.equal(
      verdict(cell({ cloudBaseFt: WINDOW_LOW + 2000, surfaceFt: 2000 }), 0),
      "target"
    );
  });

  it("rejects a base at the top of the window — the interval is half-open", () => {
    assert.equal(
      verdict(cell({ cloudBaseFt: WINDOW_HIGH + 2000, surfaceFt: 2000 }), 0),
      "baseOutsideWindow"
    );
  });

  it("rejects a 3,000 ft AGL base even when the storm tests pass", () => {
    assert.equal(
      verdict(cell({ cloudBaseFt: 5000, surfaceFt: 2000 }), 0),
      "baseOutsideWindow"
    );
  });

  it("charges a neighbourhood with no freezing level separately from one whose top sits below it", () => {
    assert.equal(
      verdict(cell({ freezingFt: Number.NaN, echoTopFt: Number.NaN }), 0),
      "noFreezingLevel"
    );
    assert.equal(
      verdict(cell({ echoTopFt: Number.NaN }), 0),
      "topBelowFreezing"
    );
  });

  it("requires a measured 18 dBZ echo top at or above freezing in the same column", () => {
    assert.equal(verdict(cell({ echoTopFt: 15000 }), 0), "topBelowFreezing");
    assert.equal(verdict(cell({ echoTopFt: 16000 }), 0), "target");
  });

  it("rejects modelled echo above freezing when the radar sees no storm", () => {
    assert.equal(verdict(cell({ dbz: NO_ECHO }), 0), "noStorm");
  });

  it("does not treat uncovered ground as a storm", () => {
    assert.equal(verdict(cell({ dbz: NO_COVERAGE }), 0), "noStorm");
  });

  it("counts rejections so they partition the cells asked", () => {
    // One-cell grids, so a neighbourhood test cannot borrow a neighbour's
    // echo. Adjacent cells on a real grid would leak those two tests.
    const cases = [
      cell({ cloudBaseFt: Number.NaN }),
      cell({ cloudBaseFt: 5000, surfaceFt: 2000 }),
      cell({ freezingFt: Number.NaN, echoTopFt: Number.NaN }),
      cell({ echoTopFt: Number.NaN }),
      cell({ dbz: NO_ECHO }),
      cell(),
    ];
    const charged = { target: 0, ...emptyCounts() };
    for (const inputs of cases) {
      const out = join(inputs);
      charged.target += out.target;
      for (const key of Object.keys(
        out.rejected
      ) as (keyof typeof out.rejected)[]) {
        charged[key] += out.rejected[key];
      }
    }

    assert.equal(charged.target, 1);
    assert.equal(charged.noCloudBase, 1);
    assert.equal(charged.baseOutsideWindow, 1);
    assert.equal(charged.noFreezingLevel, 1);
    assert.equal(charged.topBelowFreezing, 1);
    assert.equal(charged.noStorm, 1);
    assert.equal(
      charged.target +
        charged.noCloudBase +
        charged.baseOutsideWindow +
        charged.noFreezingLevel +
        charged.topBelowFreezing +
        charged.noStorm,
      6
    );
  });
});

function emptyCounts() {
  return {
    noCloudBase: 0,
    baseOutsideWindow: 0,
    noFreezingLevel: 0,
    topBelowFreezing: 0,
    noStorm: 0,
  };
}

describe("neighbourhood", () => {
  it("takes a storm in an 8-connected neighbour as the cell's storm", () => {
    const inputs = quiet3();
    put(inputs, 5, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 4), "target");
  });

  it("does not wrap around the grid", () => {
    // Cell 0's neighbours are 0, 1, 3, 4. Cell 2 is the other end of the row.
    const inputs = quiet3();
    put(inputs, 2, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 0), "topBelowFreezing");
  });

  it("does not treat a diagonal-opposite corner as a neighbour", () => {
    const inputs = quiet3();
    put(inputs, 8, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 0), "topBelowFreezing");
  });

  it("sees a diagonal neighbour of the centre", () => {
    const inputs = quiet3();
    put(inputs, 0, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 4), "target");
  });
});

describe("readTarget", () => {
  it("reports AGL, freezing and echo top over the cell", () => {
    const point = readTarget(cell(), 0);

    assert.equal(point.target, "target");
    assert.equal(point.cloudBaseAglFt, 6000);
    assert.equal(point.freezingFt, 16000);
    assert.equal(point.echoTopFt, 18000);
  });

  it("agrees with the join about every cell", () => {
    const inputs = quiet3();
    put(inputs, 4, { echoTopFt: 18000, dbz: 35 });
    const out = join(inputs);

    for (let i = 0; i < inputs.cloudBaseFt.length; i++) {
      const drawn = out.values[i] > 0;
      assert.equal(readTarget(inputs, i).target === "target", drawn);
    }
  });

  it("names the test that ruled the cell out", () => {
    assert.equal(
      readTarget(cell({ cloudBaseFt: Number.NaN }), 0).target,
      "noCloudBase"
    );
    assert.equal(readTarget(cell({ dbz: NO_ECHO }), 0).target, "noStorm");
  });

  it("reports no base AGL where there is no cloud", () => {
    assert.equal(
      readTarget(cell({ cloudBaseFt: Number.NaN }), 0).cloudBaseAglFt,
      null
    );
  });

  it("reports no echo top where there is no 18 dBZ", () => {
    assert.equal(
      readTarget(cell({ echoTopFt: Number.NaN }), 0).echoTopFt,
      null
    );
  });
});

describe("emptyTarget", () => {
  it("is the answer when the target join did not run", () => {
    const point = emptyTarget();

    assert.equal(point.target, "noCloudBase");
    assert.equal(point.cloudBaseAglFt, null);
    assert.equal(point.freezingFt, null);
    assert.equal(point.echoTopFt, null);
  });
});

describe("summarize", () => {
  const context = (inputs: TargetInputs, lats: number[], lons: number[]) => ({
    run: RUN,
    validTime: "2025-05-15T18:00:00.000Z",
    sceneTime: "2025-05-15T18:01:17.900Z",
    radarTime: "2025-05-15T18:00:39.000Z",
    geo: geoOf(inputs, lats, lons),
  });

  it("reports target ground against the ground it was asked", () => {
    const inputs: TargetInputs = {
      cloudBaseFt: new Float32Array([8000, 8000, NaN, NaN]),
      surfaceFt: new Float32Array([2000, 2000, 2000, 2000]),
      freezingFt: new Float32Array([16000, 16000, 16000, 16000]),
      echoTopFt: new Float32Array([18000, 18000, 18000, 18000]),
      dbz: new Float32Array([35, 35, 35, 35]),
      nx: 4,
      ny: 1,
    };
    const stats = summarize(
      inputs,
      join(inputs),
      context(inputs, [32, 32, 32, 32], [-101, -100, -99, -98])
    );

    assert.equal(stats.coveragePct, 50);
    assert.equal(stats.targetKm2, 2 * CELL_KM2);
    assert.equal(stats.boxKm2, 4 * CELL_KM2);
  });

  it("charges boxed rejections only to cells inside the box", () => {
    const inputs: TargetInputs = {
      cloudBaseFt: new Float32Array([NaN, 8000]),
      surfaceFt: new Float32Array([2000, 2000]),
      freezingFt: new Float32Array([16000, 16000]),
      echoTopFt: new Float32Array([18000, 18000]),
      dbz: new Float32Array([35, 35]),
      nx: 2,
      ny: 1,
    };
    const stats = summarize(inputs, join(inputs), {
      ...context(inputs, [32, 32], [-101, -100]),
      box: { west: -100.5, east: -99.5, south: 31, north: 33 },
    });

    assert.equal(stats.boxKm2, CELL_KM2);
    assert.equal(stats.targetKm2, CELL_KM2);
    assert.equal(stats.rejected.noCloudBase, 0);
  });

  it("still sees a neighbour that sits just outside the box", () => {
    // Two cells. The asked one is quiet; the one outside the box holds the
    // storm. A crop-then-join would miss it.
    const inputs: TargetInputs = {
      cloudBaseFt: new Float32Array([8000, 8000]),
      surfaceFt: new Float32Array([2000, 2000]),
      freezingFt: new Float32Array([16000, 16000]),
      echoTopFt: new Float32Array([Number.NaN, 18000]),
      dbz: new Float32Array([NO_ECHO, 35]),
      nx: 2,
      ny: 1,
    };
    const asked = summarize(inputs, join(inputs), {
      ...context(inputs, [32, 32], [-101, -100]),
      box: { west: -101.5, east: -100.5, south: 31, north: 33 },
    });

    assert.equal(asked.targetKm2, CELL_KM2);
    assert.equal(verdict(inputs, 0), "target");
  });
});
