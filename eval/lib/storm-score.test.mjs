// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Local
import {
  flagsOf,
  stormFromReading,
  tallyFlags,
  upwindOf,
} from "./storm-score.mjs";

const flare = (storm, extra = {}) => ({
  lat: 32,
  lon: -100,
  storm,
  ...extra,
});

const object = (extra = {}) => ({
  id: 1,
  maxDbz: 40,
  areaKm2: 80,
  ageMin: 6,
  ageFloor: false,
  motionTowardDeg: 90,
  motionKmh: 20,
  areaDeltaKm2: 3,
  coreLat: 32,
  coreLon: -100,
  ...extra,
});

describe("flagsOf", () => {
  it("does not score a flare painted before storm readings were stored", () => {
    assert.equal(flagsOf({ lat: 32, lon: -100 }), null);
  });

  it("scores no rain when the reading is null", () => {
    const flags = flagsOf(flare(null));
    assert.equal(flags.inRain, false);
    assert.equal(flags.upwind, null);
    assert.equal(flags.liquidOverStorm, null);
  });

  it("scores no rain when there is no 20 dBZ object", () => {
    const flags = flagsOf(
      flare({
        inside: false,
        inWorking: false,
        coreKm: null,
        edgeKm: null,
        object: null,
        slwGM2: null,
        goesTopC: null,
        goesTopDeltaC: null,
        glmFlashes: null,
        echoTopFt: null,
        freezingFt: null,
      })
    );
    assert.equal(flags.inRain, false);
    assert.equal(flags.lightning, null);
  });

  it("says yes on each test when the reading clears it", () => {
    const flags = flagsOf(
      flare({
        inside: true,
        inWorking: true,
        coreKm: 8,
        edgeKm: 1,
        object: object(),
        slwGM2: 12,
        goesTopC: -55,
        goesTopDeltaC: -1.2,
        glmFlashes: 4,
        echoTopFt: 40000,
        freezingFt: 15000,
      })
    );
    assert.deepEqual(flags, {
      inRain: true,
      upwind: true,
      nearerEdge: true,
      echoPastFreezing: true,
      grew: true,
      lightning: true,
      colderTop: true,
      liquidOverStorm: true,
    });
  });

  it("does not count an unchanged raining area as growth", () => {
    const flags = flagsOf(
      flare({
        inside: true,
        inWorking: false,
        coreKm: 2,
        edgeKm: 4,
        object: object({ areaDeltaKm2: 0.1, motionTowardDeg: null }),
        slwGM2: 0,
        goesTopDeltaC: 0.2,
        glmFlashes: 0,
        echoTopFt: 10000,
        freezingFt: 15000,
      })
    );
    assert.equal(flags.grew, null);
    assert.equal(flags.colderTop, null);
    assert.equal(flags.lightning, false);
    assert.equal(flags.liquidOverStorm, false);
    assert.equal(flags.echoPastFreezing, false);
    assert.equal(flags.nearerEdge, false);
    assert.equal(flags.upwind, null);
  });
});

describe("upwindOf", () => {
  it("treats a point west of an eastward storm as upwind", () => {
    assert.equal(upwindOf(32, -100, 32, -100.2, 90), true);
    assert.equal(upwindOf(32, -100, 32, -99.8, 90), false);
  });
});

describe("stormFromReading", () => {
  it("returns null when the look failed", () => {
    assert.equal(stormFromReading(null), null);
    assert.equal(stormFromReading({ error: "wedged" }), null);
  });
});

describe("tallyFlags", () => {
  it("drops unscored flares from the denominator", () => {
    const rows = tallyFlags([
      { lat: 32, lon: -100 },
      flare(null),
      flare({
        inside: true,
        inWorking: false,
        coreKm: 1,
        edgeKm: 0.4,
        object: object({ areaDeltaKm2: 2 }),
        slwGM2: 4,
        goesTopDeltaC: -2,
        glmFlashes: 1,
        echoTopFt: 20000,
        freezingFt: 14000,
      }),
    ]);
    const byKey = Object.fromEntries(rows.map((row) => [row.key, row]));
    assert.equal(byKey.inRain.n, 2);
    assert.equal(byKey.inRain.yes, 1);
    assert.equal(byKey.lightning.n, 1);
    assert.equal(byKey.lightning.yes, 1);
  });
});
