// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Local
import { project } from "./geo.mjs";
import {
  coordinateBoundKm,
  decimals,
  positionBoundKm,
  radialBoundKm,
  radialOf,
} from "./tolerance.mjs";

const AMARILLO = [35.2333, -101.7092];

describe("decimals", () => {
  it("counts digits after the point", () => {
    assert.equal(decimals(-100.8598), 4);
    assert.equal(decimals(32.4), 1);
    assert.equal(decimals(101), 0);
  });
});

describe("coordinateBoundKm", () => {
  it("is meters at four decimals", () => {
    const km = coordinateBoundKm(31.0982, -100.8598);
    assert.ok(km > 0.006 && km < 0.009, `${km}`);
  });

  it("is under a kilometer at two decimals", () => {
    const km = coordinateBoundKm(32.43, -101.12);
    assert.ok(km > 0.7 && km < 0.8, `${km}`);
  });

  it("reads the row at its longer coordinate", () => {
    // 32.4 is 32.40 with the zero dropped.
    assert.equal(coordinateBoundKm(32.4, -101.12), coordinateBoundKm(32.4, -101.13));
    assert.ok(coordinateBoundKm(32.4, -101.12) < 1);
  });
});

describe("radialBoundKm", () => {
  it("is half a mile along and half a degree across", () => {
    const km = radialBoundKm(115, 39);
    const along = 0.926;
    const across = 39 * 1.852 * Math.sin((0.5 * Math.PI) / 180);
    assert.ok(Math.abs(km - Math.hypot(along, across)) < 1e-9);
  });

  it("grows with range", () => {
    assert.ok(radialBoundKm(115, 80) > radialBoundKm(115, 20));
  });
});

describe("radialOf", () => {
  it("reads a bearing and range the record kept", () => {
    const release = { lat: 34.9567, lon: -100.9909, bearingDeg: 115, rangeNm: 39 };
    assert.deepEqual(radialOf(release, AMARILLO), { bearingDeg: 115, rangeNm: 39 });
  });

  it("recovers them from a projected position", () => {
    const [lat, lon] = project(AMARILLO, 115, 39);
    assert.deepEqual(radialOf({ lat, lon }, AMARILLO), { bearingDeg: 115, rangeNm: 39 });
  });

  it("recovers a bearing just west of north", () => {
    const [lat, lon] = project(AMARILLO, 359, 12);
    assert.deepEqual(radialOf({ lat, lon }, AMARILLO), { bearingDeg: 359, rangeNm: 12 });
  });

  it("refuses a coordinate that is not on the lattice", () => {
    assert.equal(radialOf({ lat: 34.95, lon: -101.0 }, AMARILLO), null);
  });

  it("is null without an origin", () => {
    assert.equal(radialOf({ lat: 31.0982, lon: -100.8598 }, undefined), null);
  });
});

describe("positionBoundKm", () => {
  it("uses the radial bound for a radial row", () => {
    const [lat, lon] = project(AMARILLO, 115, 39);
    assert.equal(positionBoundKm({ lat, lon }, AMARILLO), radialBoundKm(115, 39));
  });

  it("uses the coordinate bound otherwise", () => {
    assert.equal(
      positionBoundKm({ lat: 32.43, lon: -101.12 }, undefined),
      coordinateBoundKm(32.43, -101.12)
    );
  });
});
