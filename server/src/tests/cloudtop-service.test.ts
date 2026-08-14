// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { abiGrid, scanAngles, pixelAt } from "../lib/services/goes/abi";
import { sceneTime, dayOfYear, summarize } from "../lib/services/goes/cloudtop";
import { temperatureAtMb } from "../lib/services/hrrr/profile";
import { bandFeatures } from "../lib/services/shared/contour";

// Types
import type { Grid, Geo } from "../lib/services/shared/contour";

/** The real constants from a live ABI-L2-ACHP2KMC scene. */
const grid = abiGrid({
  lonOriginDeg: -75,
  perspectiveHeight: 35786023,
  semiMajor: 6378137,
  semiMinor: 6356752.31414,
  sweep: "x",
  xScale: 0.000056000000768108293,
  xOffset: -0.10133200138807297,
  yScale: -0.000056000000768108293,
  yOffset: 0.12821200489997864,
  nx: 2500,
  ny: 1500,
});

describe("ABI fixed-grid geolocation", () => {
  // The one point whose answer is known exactly without trusting the formulas:
  // looking straight down the boresight is zero scan angle in both axes.
  it("puts the sub-satellite point at the origin of the scan angles", () => {
    const [x, y] = scanAngles(grid, 0, -75)!;

    assert.ok(Math.abs(x) < 1e-12, `x was ${x}`);
    assert.ok(Math.abs(y) < 1e-12, `y was ${y}`);
  });

  // Without this the arithmetic still returns finite angles for the far side of
  // the planet, which would fold Asia onto the edge of a CONUS scene.
  it("refuses a point over the horizon", () => {
    assert.equal(scanAngles(grid, 21.31, -157.86), null); // Honolulu
    assert.equal(scanAngles(grid, 0, 105), null); // antipode-ish
  });

  it("accepts a point the satellite can see", () => {
    assert.notEqual(scanAngles(grid, 33.58, -101.86), null); // Lubbock
  });

  // Longitude increases to the east, and the column index has to follow it or
  // the whole scene is mirrored.
  it("orders columns west to east", () => {
    const seattle = pixelAt(grid, 47.61, -122.33)!;
    const denver = pixelAt(grid, 39.74, -104.99)!;
    const chicago = pixelAt(grid, 41.88, -87.63)!;

    assert.ok(seattle[0] < denver[0], "Seattle should be west of Denver");
    assert.ok(denver[0] < chicago[0], "Denver should be west of Chicago");
  });

  // Row 0 is the north edge: the y coordinate's scale factor is negative.
  it("orders rows north to south", () => {
    const chicago = pixelAt(grid, 41.88, -87.63)!;
    const dallas = pixelAt(grid, 32.78, -96.8)!;
    const miami = pixelAt(grid, 25.76, -80.19)!;

    assert.ok(chicago[1] < dallas[1], "Chicago should be north of Dallas");
    assert.ok(dallas[1] < miami[1], "Dallas should be north of Miami");
  });

  // CONUS is a crop of the full disk, so "visible" and "in this file" are
  // different questions and both have to be asked.
  it("refuses a visible point that falls outside this sector", () => {
    // The sub-satellite point is squarely visible and nowhere near CONUS.
    assert.notEqual(scanAngles(grid, 0, -75), null);
    assert.equal(pixelAt(grid, 0, -75), null);
  });

  // ABI sweeps x; SEVIRI sweeps y, and reading one with the other's formulas
  // silently transposes the sky rather than failing.
  it("refuses a grid that does not sweep the x axis", () => {
    assert.throws(
      () =>
        abiGrid({
          lonOriginDeg: 0,
          perspectiveHeight: 35786023,
          semiMajor: 6378137,
          semiMinor: 6356752.31414,
          sweep: "y",
          xScale: 1,
          xOffset: 0,
          yScale: -1,
          yOffset: 0,
          nx: 10,
          ny: 10,
        }),
      /sweep_angle_axis/
    );
  });
});

describe("temperature at a pressure", () => {
  const levels = [100, 300, 500, 1000];
  const tempC = new Map<number, Float32Array>([
    [100, Float32Array.from([-70])],
    [300, Float32Array.from([-40])],
    [500, Float32Array.from([-20])],
    [1000, Float32Array.from([10])],
  ]);

  it("interpolates between the two bracketing levels", () => {
    // Halfway between 300 and 500 mb is halfway between -40 and -20.
    assert.equal(temperatureAtMb(levels, tempC, 0, 400), -30);
  });

  it("returns the level's own temperature when it lands on one", () => {
    assert.equal(temperatureAtMb(levels, tempC, 0, 500), -20);
  });

  // A cloud top above the ceiling is colder than the ceiling, so clamping
  // understates its coldness. That is the safe direction: it can only move a
  // top toward the warm end, never invent a cold one.
  it("clamps above the ceiling rather than extrapolating", () => {
    assert.equal(temperatureAtMb(levels, tempC, 0, 50), -70);
  });

  it("clamps below the floor rather than extrapolating", () => {
    assert.equal(temperatureAtMb(levels, tempC, 0, 1200), 10);
  });
});

describe("cloud-top bands", () => {
  /**
   * A 2x2 patch. Two rows because `project` interpolates between grid rows and
   * a single-row grid has none to interpolate between.
   */
  const geo: Geo = {
    nx: 2,
    ny: 2,
    lats: Float32Array.from([40, 40, 41, 41]),
    lons: Float32Array.from([-100, -99, -100, -99]),
  };

  const gridOf = (values: number[]): Grid => ({
    nx: 2,
    ny: 2,
    values: Float32Array.from(values),
  });

  // The whole reason these are bands rather than nested contours: a cell must
  // appear in exactly one of them, or the stacking is back.
  it("puts a cell in exactly one band", () => {
    const features = bandFeatures(
      gridOf([8, 8, 8, 8]),
      geo,
      "topColdnessC",
      [5, 12, 18, 25]
    );

    assert.equal(features.length, 1);
    assert.equal(features[0].properties.topColdnessC, 5);
  });

  it("drops bands nothing in the grid falls into", () => {
    const features = bandFeatures(
      gridOf([20, 20, 20, 20]),
      geo,
      "topColdnessC",
      [5, 12, 18, 25]
    );

    assert.deepEqual(
      features.map((f) => f.properties.topColdnessC),
      [18]
    );
  });

  // Nothing is discarded for being cold — the coldest band has no upper bound.
  it("leaves the coldest band open-ended", () => {
    const features = bandFeatures(
      gridOf([70, 70, 70, 70]),
      geo,
      "topColdnessC",
      [5, 12, 18, 25]
    );

    assert.deepEqual(
      features.map((f) => f.properties.topColdnessC),
      [25]
    );
  });

  // Clear sky carries a sentinel below every edge, so it draws nothing at all.
  // This is the property the raster this layer replaced could not have.
  it("draws nothing where the satellite saw no cloud", () => {
    const features = bandFeatures(
      gridOf([-999, -999, -999, -999]),
      geo,
      "topColdnessC",
      [5, 12, 18, 25]
    );

    assert.deepEqual(features, []);
  });
});

describe("scene naming", () => {
  const key =
    "ABI-L2-ACHP2KMC/2026/225/00/" +
    "OR_ABI-L2-ACHP2KMC-M6_G19_s20262250051179_e20262250053552_c20262250055335.nc";

  // The scan time is the layer's valid time, and it only appears in the name —
  // latestKey has to compare scenes before downloading one.
  it("reads the scan start out of the file name", () => {
    assert.equal(sceneTime(key), "2026-08-13T00:51:17.900Z");
  });

  it("refuses a name it cannot parse rather than guessing a time", () => {
    assert.throws(() => sceneTime("nonsense.nc"), /Unparseable/);
  });

  it("counts the day of year GOES files are filed under", () => {
    assert.equal(dayOfYear(new Date("2026-01-01T00:00:00Z")), 1);
    assert.equal(dayOfYear(new Date("2026-08-13T00:51:00Z")), 225);
  });
});

describe("cloud-top summary", () => {
  const CLEAR = -999;
  const gridOf = (values: number[]): Grid => ({
    nx: values.length,
    ny: 1,
    values: Float32Array.from(values),
  });

  it("counts cloud and seedable tops against the whole grid", () => {
    // Two clear, one warm-but-cloudy top below the edge, one seedable.
    const stats = summarize(
      gridOf([CLEAR, CLEAR, 3, 20]),
      "2026-08-13T01:41:17.900Z",
      "2026-08-13T00:00:00.000Z"
    );

    assert.equal(stats.cloudPct, 50);
    assert.equal(stats.seedableTopPct, 25);
  });

  // Stored negated so the contours nest; reported as the temperature an
  // operator reads. Getting this backwards would report +68 °C cloud tops.
  it("reports the coldest top as a temperature, not as coldness", () => {
    const stats = summarize(
      gridOf([20, 68]),
      "2026-08-13T01:41:17.900Z",
      "2026-08-13T00:00:00.000Z"
    );

    assert.equal(stats.coldestTopC, -68);
  });

  it("has no coldest top when there is no cloud", () => {
    const stats = summarize(
      gridOf([CLEAR, CLEAR]),
      "2026-08-13T01:41:17.900Z",
      "2026-08-13T00:00:00.000Z"
    );

    assert.equal(stats.coldestTopC, null);
    assert.equal(stats.cloudPct, 0);
  });

  // The layer is assembled from two sources and both times have to survive to
  // the sidebar, or an operator cannot tell how old either half is.
  it("carries both the scan time and the model run", () => {
    const stats = summarize(
      gridOf([20]),
      "2026-08-13T01:41:17.900Z",
      "2026-08-13T00:00:00.000Z"
    );

    assert.equal(stats.validTime, "2026-08-13T01:41:17.900Z");
    assert.equal(stats.profileRun, "2026-08-13T00:00:00.000Z");
  });
});
