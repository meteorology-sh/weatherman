// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  cclFt,
  mixingRatio,
  saturationMixingRatio,
  saturationVaporPressure,
} from "../lib/services/hrrr/ccl";
import { levelKey } from "../lib/services/hrrr/profile";

// Types
import type { CclProfile } from "../lib/services/hrrr/ccl";

/**
 * A one-cell column on a 100 mb ladder, with the temperature at each level
 * given in °C and the height in ft MSL.
 */
function column(
  rungs: { mb: number; tempC: number; heightFt: number }[],
  surfaceFt = 0
): CclProfile {
  const tempC = new Map<number, Float32Array>();
  const heightFt = new Map<number, Float32Array>();
  for (const r of rungs) {
    tempC.set(levelKey(r.mb), new Float32Array([r.tempC]));
    heightFt.set(levelKey(r.mb), new Float32Array([r.heightFt]));
  }
  return {
    levels: rungs.map((r) => r.mb),
    tempC,
    heightFt,
    surfaceFt: new Float32Array([surfaceFt]),
  };
}

describe("saturationVaporPressure", () => {
  // Bolton (1980) at 0 °C is the triple-point value, which is the one number
  // in this file that can be checked against a table rather than against
  // itself.
  it("is 6.112 hPa at 0 °C", () => {
    assert.ok(Math.abs(saturationVaporPressure(0) - 6.112) < 1e-9);
  });

  it("roughly doubles every 10 °C, as Clausius-Clapeyron requires", () => {
    const ratio = saturationVaporPressure(20) / saturationVaporPressure(10);

    assert.ok(ratio > 1.8 && ratio < 2.1, `ratio was ${ratio}`);
  });

  it("rises with temperature", () => {
    assert.ok(saturationVaporPressure(30) > saturationVaporPressure(10));
  });
});

describe("saturationMixingRatio", () => {
  // ~14.7 g/kg at 20 °C and 1000 mb, which is the textbook figure.
  it("matches the textbook value at 20 °C and 1000 mb", () => {
    const ws = saturationMixingRatio(20, 1000);

    assert.ok(Math.abs(ws - 0.0147) < 0.0005, `ws was ${ws}`);
  });

  it("falls as the parcel cools", () => {
    assert.ok(saturationMixingRatio(0, 800) < saturationMixingRatio(20, 800));
  });

  // Rather than a negative mixing ratio, which would make the crossing search
  // find a level it should have skipped.
  it("is not finite where the vapor pressure reaches the ambient", () => {
    assert.ok(!Number.isFinite(saturationMixingRatio(100, 5)));
  });
});

describe("mixingRatio", () => {
  it("is slightly larger than the specific humidity it comes from", () => {
    const w = mixingRatio(0.01);

    assert.ok(w > 0.01 && w < 0.0102, `w was ${w}`);
  });

  it("has no answer for a missing or impossible humidity", () => {
    for (const q of [Number.NaN, 0, -0.001, 1]) {
      assert.ok(!Number.isFinite(mixingRatio(q)), `q=${q}`);
    }
  });
});

describe("cclFt", () => {
  /**
   * A saturated-enough column: 25 °C at the ground falling to −5 °C at 700 mb.
   * With 10 g/kg at the surface the crossing sits in the middle of the column
   * rather than at either end, which is the case worth pinning.
   */
  const profile = column([
    { mb: 1000, tempC: 25, heightFt: 400 },
    { mb: 900, tempC: 18, heightFt: 3400 },
    { mb: 800, tempC: 10, heightFt: 6600 },
    { mb: 700, tempC: -5, heightFt: 10000 },
  ]);

  it("finds the crossing between two levels, not on a rung", () => {
    const ccl = cclFt(profile, new Float32Array([0.01]))[0];

    assert.ok(Number.isFinite(ccl), "expected a height");
    assert.ok(ccl > 400 && ccl < 10000, `ccl was ${ccl}`);
    // Not snapped to one of the rungs it was interpolated between.
    assert.ok(![400, 3400, 6600, 10000].includes(ccl));
  });

  // The physical direction: drier air has to rise further before it condenses.
  it("puts a drier parcel's base higher", () => {
    const moist = cclFt(profile, new Float32Array([0.012]))[0];
    const dry = cclFt(profile, new Float32Array([0.006]))[0];

    assert.ok(dry > moist, `dry ${dry} was not above moist ${moist}`);
  });

  // An airmass too dry for its own surface moisture to condense anywhere in
  // the profile has no convective cloud base. Returning the top of the ladder
  // would invent one.
  it("has no answer for a column that never saturates", () => {
    assert.ok(!Number.isFinite(cclFt(profile, new Float32Array([1e-6]))[0]));
  });

  it("has no answer where the surface moisture is missing", () => {
    assert.ok(
      !Number.isFinite(cclFt(profile, new Float32Array([Number.NaN]))[0])
    );
  });

  // HRRR extrapolates its pressure levels beneath the terrain, so over high
  // ground the low rungs are inside rock and their temperatures are fiction.
  // The walk has to start above the terrain or the crossing is found in it.
  it("skips levels underground", () => {
    const high = column(
      [
        // Underground, and deliberately absurd: if this rung were read the
        // crossing would land at 400 ft.
        { mb: 1000, tempC: -40, heightFt: 400 },
        { mb: 900, tempC: 18, heightFt: 3400 },
        { mb: 800, tempC: 10, heightFt: 6600 },
        { mb: 700, tempC: -5, heightFt: 10000 },
      ],
      3000
    );

    const ccl = cclFt(high, new Float32Array([0.01]))[0];

    assert.ok(ccl > 3000, `ccl was ${ccl}, at or below the terrain`);
  });

  // Already saturated at the first level above the ground: the parcel is at
  // its condensation level, so the base is the ground rather than a height
  // interpolated from a layer that was never crossed.
  it("puts the base at the ground where the surface is already saturated", () => {
    const ccl = cclFt(profile, new Float32Array([0.05]))[0];

    assert.equal(ccl, 0);
  });

  it("answers every cell of a grid independently", () => {
    const two: CclProfile = {
      levels: [1000, 900, 800, 700],
      tempC: new Map([
        [levelKey(1000), new Float32Array([25, 25])],
        [levelKey(900), new Float32Array([18, 18])],
        [levelKey(800), new Float32Array([10, 10])],
        [levelKey(700), new Float32Array([-5, -5])],
      ]),
      heightFt: new Map([
        [levelKey(1000), new Float32Array([400, 400])],
        [levelKey(900), new Float32Array([3400, 3400])],
        [levelKey(800), new Float32Array([6600, 6600])],
        [levelKey(700), new Float32Array([10000, 10000])],
      ]),
      surfaceFt: new Float32Array([0, 0]),
    };

    const out = cclFt(two, new Float32Array([0.012, 0.006]));

    assert.equal(out.length, 2);
    assert.ok(out[1] > out[0]);
  });
});
