// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  flyValues,
  join,
  payloadAt,
  readTarget,
  summarize,
  verdict,
} from "../lib/services/candidate/target";
import { BASE_CEILING_FT } from "../lib/services/candidate/cloudbase";
import { CELL_KM2 } from "../lib/services/shared/grid";
import { RAIN_DBZ } from "../lib/services/mrms/radar";

// Types
import type { TargetInputs } from "../lib/services/candidate/target";
import type { Geo } from "../lib/services/shared/contour";

const RUN = new Date("2025-05-15T18:00:00.000Z");
const NO_ECHO = -99;
const NO_COVERAGE = -999;

/**
 * One cell that passes every Texas test, with any field overridden.
 *
 * Base 8,000 ft MSL over 2,000 ft terrain (6,000 ft AGL), freezing at
 * 16,000 ft, 18 dBZ echo top at 18,000 ft, 35 dBZ: a raining convective
 * column with a base low enough to seed.
 */
function cell(
  over: Partial<Record<keyof Omit<TargetInputs, "nx" | "ny">, number>> = {}
): TargetInputs {
  const one = (v: number) => new Float32Array([v]);
  return {
    cloudBaseFt: one(over.cloudBaseFt ?? 8000),
    cclFt: one(over.cclFt ?? 9000),
    surfaceFt: one(over.surfaceFt ?? 2000),
    freezingFt: one(over.freezingFt ?? 16000),
    echoTopFt: one(over.echoTopFt ?? 18000),
    dbz: one(over.dbz ?? 35),
    nx: 1,
    ny: 1,
  };
}

/** A 3×3 of seedable bases with no echo and no echo top. Center is 4. */
function quiet3(): TargetInputs {
  const fill = (v: number) => new Float32Array(9).fill(v);
  return {
    cloudBaseFt: fill(8000),
    cclFt: fill(9000),
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
    const empty = flyValues(join(cell({ dbz: NO_ECHO })));
    assert.ok(Number.isNaN(empty[0]));
  });
});

describe("target join", () => {
  it("keeps a raining column whose base is low enough and whose echo top is above freezing", () => {
    const out = join(cell());

    assert.equal(out.values[0], 1);
    assert.equal(out.target, 1);
  });

  it("does not ask about supercooled liquid — rain in the cell is not a reject", () => {
    assert.equal(verdict(cell({ dbz: 45 }), 0), "target");
    assert.equal(verdict(cell({ dbz: RAIN_DBZ }), 0), "target");
  });

  it("leaves the height tests unanswered where the model has no cloud", () => {
    // HRRR reports no base in columns a crew is working. Reading that
    // silence as "too high to seed" would turn a gap in the model into a
    // verdict about the sky, so the cell rests on the radar tests.
    assert.equal(verdict(cell({ cloudBaseFt: Number.NaN }), 0), "target");
  });

  it("still requires the radar to see a storm where the model has no cloud", () => {
    // The measured tests are what put a cell on the map, so a missing base
    // adds no ground of its own.
    assert.equal(
      verdict(cell({ cloudBaseFt: Number.NaN, dbz: NO_ECHO }), 0),
      "noStorm"
    );
    // No ice, but the CCL puts a base under the freezing level, so a salt
    // flare has a warm layer to work in and the cell still passes.
    assert.equal(
      verdict(cell({ cloudBaseFt: Number.NaN, echoTopFt: Number.NaN }), 0),
      "target"
    );
  });

  it("reads the ceiling in MSL, so terrain does not move it", () => {
    // The same 8,000 ft MSL base passes over 5,000 ft terrain and over 200 ft
    // terrain. The ceiling is a property of the airframe, not of the ground.
    assert.equal(
      verdict(cell({ cloudBaseFt: 8000, surfaceFt: 5000 }), 0),
      "target"
    );
    assert.equal(
      verdict(cell({ cloudBaseFt: 8000, surfaceFt: 200 }), 0),
      "target"
    );
  });

  it("keeps a low base — there is no lower bound", () => {
    // 575 ft above the ground is still cloud an aircraft can climb into.
    assert.equal(
      verdict(cell({ cloudBaseFt: 2575, surfaceFt: 2000 }), 0),
      "target"
    );
  });

  it("rejects a base at the ceiling — the interval is half-open", () => {
    assert.equal(
      verdict(cell({ cloudBaseFt: BASE_CEILING_FT }), 0),
      "baseTooHigh"
    );
    assert.equal(
      verdict(cell({ cloudBaseFt: BASE_CEILING_FT - 1 }), 0),
      "target"
    );
  });

  // The bound is MSL, so terrain does not move it. The old criterion was a
  // depth above the ground and did, which is the difference this pins.
  it("reads the bound in MSL, so terrain does not move it", () => {
    for (const surfaceFt of [500, 2000, 7000]) {
      assert.equal(
        verdict(cell({ cloudBaseFt: 13000, surfaceFt }), 0),
        "target"
      );
    }
  });

  // The whole reason the CCL is here: HRRR grows no cloud in most cells under
  // convection, and the base test used to be waived there. It is answerable
  // now, so it is asked.
  it("falls back to the CCL where the model has no base", () => {
    assert.equal(
      verdict(cell({ cloudBaseFt: Number.NaN, cclFt: 9000 }), 0),
      "target"
    );
    assert.equal(
      verdict(cell({ cloudBaseFt: Number.NaN, cclFt: 19000 }), 0),
      "baseTooHigh"
    );
  });

  it("prefers the model's own base to the CCL where it has one", () => {
    // The model is workable and the CCL is not. The model wins, so the cell
    // is a target.
    assert.equal(
      verdict(cell({ cloudBaseFt: 8000, cclFt: 19000 }), 0),
      "target"
    );
    // And the other way round.
    assert.equal(
      verdict(cell({ cloudBaseFt: 19000, cclFt: 8000 }), 0),
      "baseTooHigh"
    );
  });

  it("rejects a column with no base from either height", () => {
    assert.equal(
      verdict(cell({ cloudBaseFt: Number.NaN, cclFt: Number.NaN }), 0),
      "noCloudBase"
    );
  });

  it("charges a neighborhood with no freezing level separately from a cloud neither payload can use", () => {
    assert.equal(
      verdict(cell({ freezingFt: Number.NaN, echoTopFt: Number.NaN }), 0),
      "noFreezingLevel"
    );
    // Top never reached freezing and the base is above the freezing level, so
    // there is no ice to make and no warm layer to grow rain in.
    assert.equal(
      verdict(
        cell({ echoTopFt: Number.NaN, cloudBaseFt: 17000, cclFt: 17000 }),
        0
      ),
      "noIceNoWarmLayer"
    );
  });

  // Silver iodide needs the top at or above freezing. A salt flare does not,
  // and a warm layer under the base is what it needs instead, so a cloud that
  // fails the ice test is still a cloud one payload can work.
  it("passes a cloud whose top never froze when it has a warm layer", () => {
    assert.equal(verdict(cell({ echoTopFt: 15000 }), 0), "target");
    assert.equal(payloadAt(cell({ echoTopFt: 15000 }), 0), "salt");
    assert.equal(verdict(cell({ echoTopFt: 16000 }), 0), "target");
    assert.equal(payloadAt(cell({ echoTopFt: 16000 }), 0), "both");
  });

  it("names ice alone where the base sits at the freezing level", () => {
    const inputs = cell({ cloudBaseFt: 16000, cclFt: 16000 });

    assert.equal(payloadAt(inputs, 0), "ice");
    assert.equal(verdict(inputs, 0), "target");
  });

  it("names no payload where the cloud offers neither", () => {
    const inputs = cell({
      echoTopFt: Number.NaN,
      cloudBaseFt: 17000,
      cclFt: 17000,
    });

    assert.equal(payloadAt(inputs, 0), null);
  });

  it("rejects modeled echo above freezing when the radar sees no storm", () => {
    assert.equal(verdict(cell({ dbz: NO_ECHO }), 0), "noStorm");
  });

  it("does not treat uncovered ground as a storm", () => {
    assert.equal(verdict(cell({ dbz: NO_COVERAGE }), 0), "noStorm");
  });

  it("counts rejections so they partition the cells asked", () => {
    // One-cell grids, so a neighborhood test cannot borrow a neighbor's
    // echo. Adjacent cells on a real grid would leak those two tests.
    const cases = [
      cell({ cloudBaseFt: BASE_CEILING_FT + 1000, cclFt: Number.NaN }),
      cell({ cloudBaseFt: Number.NaN, cclFt: Number.NaN }),
      cell({ freezingFt: Number.NaN, echoTopFt: Number.NaN }),
      cell({ echoTopFt: Number.NaN, cloudBaseFt: 17000, cclFt: 17000 }),
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
    assert.equal(charged.baseTooHigh, 1);
    assert.equal(charged.noCloudBase, 1);
    assert.equal(charged.noFreezingLevel, 1);
    assert.equal(charged.noIceNoWarmLayer, 1);
    assert.equal(charged.noStorm, 1);
    assert.equal(
      charged.target +
        charged.baseTooHigh +
        charged.noCloudBase +
        charged.noFreezingLevel +
        charged.noIceNoWarmLayer +
        charged.noStorm,
      6
    );
  });
});

function emptyCounts() {
  return {
    noCloudBase: 0,
    baseTooHigh: 0,
    noFreezingLevel: 0,
    noIceNoWarmLayer: 0,
    noStorm: 0,
  };
}

describe("neighborhood", () => {
  it("takes a storm in an 8-connected neighbor as the cell's storm", () => {
    const inputs = quiet3();
    put(inputs, 5, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 4), "target");
  });

  it("does not wrap around the grid", () => {
    // Cell 0's neighbors are 0, 1, 3, 4. Cell 2 is the other end of the row.
    const inputs = quiet3();
    put(inputs, 2, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 0), "noStorm");
  });

  it("does not treat a diagonal-opposite corner as a neighbor", () => {
    const inputs = quiet3();
    put(inputs, 8, { echoTopFt: 18000, dbz: 35 });

    assert.equal(verdict(inputs, 0), "noStorm");
  });

  it("sees a diagonal neighbor of the center", () => {
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
      readTarget(cell({ cloudBaseFt: 40000 }), 0).target,
      "baseTooHigh"
    );
    assert.equal(readTarget(cell({ dbz: NO_ECHO }), 0).target, "noStorm");
  });

  // The panel prints the payload beside FLY, and the depth beside it, because
  // how much warm layer is enough is the operator's call and not a constant in
  // this file.
  it("reports the payload and the warm layer under it", () => {
    const point = readTarget(cell(), 0);

    assert.equal(point.payload, "both");
    assert.equal(point.warmCloudDepthFt, 8000);
  });

  it("reports no warm layer where the base is above the freezing level", () => {
    const point = readTarget(cell({ cloudBaseFt: 17000, cclFt: 17000 }), 0);

    assert.equal(point.warmCloudDepthFt, null);
    assert.equal(point.payload, "ice");
  });

  it("reads the AGL height off the CCL where the model has no cloud", () => {
    // 9,000 ft MSL over 2,000 ft terrain. The height comes from whichever of
    // the two answered, so the panel prints a number rather than a dash.
    const point = readTarget(cell({ cloudBaseFt: Number.NaN }), 0);
    assert.equal(point.cloudBaseAglFt, 7000);
    assert.equal(point.target, "target");
  });

  it("reports no base AGL where neither height answered", () => {
    // Null is "this column has no cloud base", which the panel says in words.
    // It must not become a height.
    const point = readTarget(
      cell({ cloudBaseFt: Number.NaN, cclFt: Number.NaN }),
      0
    );
    assert.equal(point.cloudBaseAglFt, null);
    assert.equal(point.target, "noCloudBase");
  });

  it("reports no echo top where there is no 18 dBZ", () => {
    assert.equal(
      readTarget(cell({ echoTopFt: Number.NaN }), 0).echoTopFt,
      null
    );
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
      cloudBaseFt: new Float32Array([8000, 8000, 40000, 40000]),
      cclFt: new Float32Array(4).fill(9000),
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
      cloudBaseFt: new Float32Array([40000, 8000]),
      cclFt: new Float32Array(2).fill(9000),
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
    assert.equal(stats.rejected.baseTooHigh, 0);
  });

  it("still sees a neighbor that sits just outside the box", () => {
    // Two cells. The asked one is quiet; the one outside the box holds the
    // storm. A crop-then-join would miss it.
    const inputs: TargetInputs = {
      cloudBaseFt: new Float32Array([8000, 8000]),
      cclFt: new Float32Array(2).fill(9000),
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
