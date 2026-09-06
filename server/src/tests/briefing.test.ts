// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  BRIEFING_COLD_C,
  CAPE,
  CIN,
  FREEZING,
  LCL,
  MINUS15,
  WARM_DEPTH,
  cinMagnitude,
  isBriefingField,
  warmCloudDepthValues,
} from "../lib/services/hrrr/briefing";
import { CLOUD_BASE } from "../lib/services/hrrr/diagnostics";

describe("briefing fields", () => {
  it("names the −15 °C isotherm the 12Z table prints", () => {
    assert.equal(BRIEFING_COLD_C, -15);
  });

  it("bands mixed-layer CAPE on the NWS instability classes", () => {
    assert.deepEqual(CAPE.edges, [1000, 2500, 4000]);
    assert.equal(CAPE.property, "mixedCapeJKg");
  });

  it("bands CIN magnitude on the NWS inhibition classes", () => {
    assert.deepEqual(CIN.edges, [50, 100, 200]);
  });

  it("bands LCL, freezing, −15 °C, and warm-cloud depth on the cloud-base edges", () => {
    assert.equal(LCL.edges, CLOUD_BASE.edges);
    assert.equal(FREEZING.edges, CLOUD_BASE.edges);
    assert.equal(MINUS15.edges, CLOUD_BASE.edges);
    assert.equal(WARM_DEPTH.edges, CLOUD_BASE.edges);
  });

  it("accepts the six briefing field names and no others", () => {
    assert.equal(isBriefingField("cape"), true);
    assert.equal(isBriefingField("warm-depth"), true);
    assert.equal(isBriefingField("cloudbase"), false);
  });
});

describe("cinMagnitude", () => {
  it("reports HRRR's negative CIN as a magnitude", () => {
    const out = cinMagnitude(new Float32Array([0, -50, -200]));
    assert.deepEqual([...out], [0, 50, 200]);
  });

  it("drops non-finite values", () => {
    const out = cinMagnitude(new Float32Array([Number.NaN]));
    assert.ok(Number.isNaN(out[0]));
  });

  it("does not invent inhibition from a positive", () => {
    const out = cinMagnitude(new Float32Array([25]));
    assert.equal(out[0], 0);
  });
});

describe("warmCloudDepthValues", () => {
  it("is freezing minus cloud base where both exist and the base is below freezing", () => {
    const out = warmCloudDepthValues(
      new Float32Array([12000]),
      new Float32Array([4000])
    );
    assert.equal(out[0], 8000);
  });

  it("has no warm cloud where the base sits at or above freezing", () => {
    const at = warmCloudDepthValues(
      new Float32Array([8000]),
      new Float32Array([8000])
    );
    const above = warmCloudDepthValues(
      new Float32Array([8000]),
      new Float32Array([9000])
    );
    assert.ok(Number.isNaN(at[0]));
    assert.ok(Number.isNaN(above[0]));
  });

  it("has no depth where either height is missing", () => {
    const noFreeze = warmCloudDepthValues(
      new Float32Array([Number.NaN]),
      new Float32Array([4000])
    );
    const noBase = warmCloudDepthValues(
      new Float32Array([12000]),
      new Float32Array([Number.NaN])
    );
    assert.ok(Number.isNaN(noFreeze[0]));
    assert.ok(Number.isNaN(noBase[0]));
  });
});
