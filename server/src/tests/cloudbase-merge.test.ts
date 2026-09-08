// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  BASE_CEILING_FT,
  MERGED_BASE,
  mergedBaseAt,
  mergedBaseValues,
  readMergedBase,
  summarizeMergedBase,
} from "../lib/services/candidate/cloudbase";
import { CELL_KM2 } from "../lib/services/shared/grid";

// Types
import type { MergedBaseInputs } from "../lib/services/candidate/cloudbase";
import type { Geo } from "../lib/services/shared/contour";

const RUN = new Date("2025-05-15T18:00:00.000Z");

/**
 * One cell the layer draws: HRRR base at 5,000 ft MSL under a 25,000 ft echo
 * top, with a CCL that would have answered had the model declined.
 */
function cell(over: Partial<Record<keyof MergedBaseInputs, number>> = {}) {
  const one = (v: number) => new Float32Array([v]);
  return {
    cloudBaseFt: one(over.cloudBaseFt ?? 5000),
    cclFt: one(over.cclFt ?? 7000),
    echoTopFt: one(over.echoTopFt ?? 25000),
  };
}

describe("mergedBaseAt", () => {
  it("takes HRRR's own base where the model has one", () => {
    const answer = mergedBaseAt(cell(), 0);

    assert.equal(answer.baseFt, 5000);
    assert.equal(answer.source, "model");
  });

  // The whole reason the two are merged: under convection HRRR frequently
  // diagnoses no cloud base, and the layer used to go blank exactly where a
  // storm was.
  it("falls back to the CCL where the model has no base", () => {
    const answer = mergedBaseAt(cell({ cloudBaseFt: Number.NaN }), 0);

    assert.equal(answer.baseFt, 7000);
    assert.equal(answer.source, "ccl");
  });

  it("draws nothing where neither height is available", () => {
    const answer = mergedBaseAt(
      cell({ cloudBaseFt: Number.NaN, cclFt: Number.NaN }),
      0
    );

    assert.equal(answer.baseFt, null);
    assert.equal(answer.source, null);
  });

  // The measured gate. A CCL exists over dry ground, so without this the fill
  // would paint clear sky at a height no cloud is at.
  it("draws nothing where no echo top tops the cell", () => {
    assert.equal(mergedBaseAt(cell({ echoTopFt: Number.NaN }), 0).baseFt, null);
  });

  // It gates the model's own base too: HRRR reports a base for thin high deck
  // that no radar sees, and that is not the convective base this layer is for.
  it("gates the modeled base on the echo top as well", () => {
    assert.equal(
      mergedBaseAt(cell({ cloudBaseFt: 5000, echoTopFt: Number.NaN }), 0)
        .baseFt,
      null
    );
  });

  // "Topped by" is a statement about a column, so the top has to be above the
  // base. An echo top under the base describes two unrelated heights.
  it("draws nothing where the echo top sits below the base", () => {
    assert.equal(mergedBaseAt(cell({ echoTopFt: 4000 }), 0).baseFt, null);
  });

  // Height alone never blanks a cell. Whether a base can be flown is the
  // seeding opportunity's judgement; this layer reports the height it measured,
  // and cutting it would delete data to express an opinion made elsewhere.
  it("draws a base above the workable bound rather than cutting it", () => {
    assert.equal(BASE_CEILING_FT, 18000);
    for (const cloudBaseFt of [BASE_CEILING_FT, 26000]) {
      assert.equal(
        mergedBaseAt(cell({ cloudBaseFt, echoTopFt: 30000 }), 0).baseFt,
        cloudBaseFt
      );
    }
  });

  // Terrain is not consulted anywhere in this file, which is what keeps the
  // height an MSL claim rather than an AGL one.
  it("reads the base in MSL, never above the ground", () => {
    assert.equal(mergedBaseAt(cell({ cloudBaseFt: 17999 }), 0).baseFt, 17999);
  });
});

describe("mergedBaseValues", () => {
  // NaN and not zero: the contourer traces nothing over NaN, and zero would be
  // a cloud base at sea level.
  it("leaves undrawn cells as NaN", () => {
    const values = mergedBaseValues({
      cloudBaseFt: new Float32Array([5000, Number.NaN]),
      cclFt: new Float32Array([7000, Number.NaN]),
      echoTopFt: new Float32Array([25000, 25000]),
    });

    assert.equal(values[0], 5000);
    assert.ok(Number.isNaN(values[1]));
  });
});

describe("readMergedBase", () => {
  // A click asks about the column, not about the fill. A base with no echo over
  // it is a real answer and printing a dash for it loses the reason the map is
  // blank there.
  it("reports a height the layer does not draw", () => {
    const point = readMergedBase(
      cell({ cloudBaseFt: 19000, echoTopFt: Number.NaN }),
      0
    );

    assert.equal(point.cloudBaseMslFt, 19000);
    assert.equal(point.baseSource, "model");
    assert.equal(point.baseDrawn, false);
  });

  it("agrees with the fill where the layer draws", () => {
    const point = readMergedBase(cell(), 0);

    assert.equal(point.cloudBaseMslFt, 5000);
    assert.equal(point.baseDrawn, true);
  });

  it("names the CCL as the source when it answered", () => {
    const point = readMergedBase(cell({ cloudBaseFt: Number.NaN }), 0);

    assert.equal(point.baseSource, "ccl");
  });
});

describe("summarizeMergedBase", () => {
  const geo = {
    nx: 3,
    ny: 1,
    lats: new Float32Array([31, 31, 31]),
    lons: new Float32Array([-101, -101, -101]),
  } as unknown as Geo;

  // The figure worth watching: how much of the drawn map rests on the fallback
  // rather than on HRRR's own diagnosis.
  it("splits the drawn ground by which height answered", () => {
    const stats = summarizeMergedBase(
      {
        cloudBaseFt: new Float32Array([5000, Number.NaN, Number.NaN]),
        cclFt: new Float32Array([7000, 7000, Number.NaN]),
        echoTopFt: new Float32Array([25000, 25000, 25000]),
      },
      { run: RUN, validTime: "v", radarTime: "r", geo }
    );

    assert.equal(stats.modelKm2, CELL_KM2);
    assert.equal(stats.cclKm2, CELL_KM2);
    assert.equal(stats.drawnKm2, 2 * CELL_KM2);
    assert.equal(stats.drawnPct, 66.67);
    assert.equal(stats.medianFt, 5000);
  });

  it("reports no median where the layer draws nothing", () => {
    const stats = summarizeMergedBase(
      {
        cloudBaseFt: new Float32Array([Number.NaN]),
        cclFt: new Float32Array([Number.NaN]),
        echoTopFt: new Float32Array([Number.NaN]),
      },
      {
        run: RUN,
        validTime: "v",
        radarTime: "r",
        geo: {
          nx: 1,
          ny: 1,
          lats: new Float32Array([31]),
          lons: new Float32Array([-101]),
        } as unknown as Geo,
      }
    );

    assert.equal(stats.medianFt, null);
    assert.equal(stats.drawnPct, 0);
  });
});

describe("MERGED_BASE", () => {
  // Every edge traces to the one number, and the last band is open above it so
  // no measured base goes undrawn.
  it("bands on thirds of the workable bound, open above it", () => {
    assert.deepEqual(
      [...MERGED_BASE.edges],
      [0, BASE_CEILING_FT / 3, (2 * BASE_CEILING_FT) / 3, BASE_CEILING_FT]
    );
  });

  it("traces on the property the app's renderer matches", () => {
    assert.equal(MERGED_BASE.property, "cloudBaseFt");
  });
});
