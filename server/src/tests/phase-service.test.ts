// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { abiGrid, pixelAt } from "../lib/services/goes/abi";
import { PHASE, classify, resample } from "../lib/services/goes/phase";

// Types
import type { Geo } from "../lib/services/shared/contour";

/**
 * The real constants from a live ABI-L2-ACTPC scene — the same fixed grid the
 * cloud-top product is published on, at the same 2 km CONUS resolution.
 */
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

/** Somewhere over the West Texas seeding districts. */
const LUBBOCK: [number, number] = [33.58, -101.86];

const geo = (points: [number, number][]): Geo => ({
  nx: points.length,
  ny: 1,
  lats: new Float32Array(points.map((p) => p[0])),
  lons: new Float32Array(points.map((p) => p[1])),
});

/**
 * A scene of one class, with the 6x6 window under a point painted pixel by
 * pixel — the same window `resample` reads, so a test can say exactly what the
 * satellite saw over one 12 km cell.
 */
function scene(background: number, at: [number, number], window: number[]) {
  const pixels = new Uint8Array(grid.nx * grid.ny).fill(background);
  const [col, row] = pixelAt(grid, at[0], at[1])!;

  let i = 0;
  for (let dy = -3; dy < 3; dy++) {
    for (let dx = -3; dx < 3; dx++) {
      pixels[(row + dy) * grid.nx + (col + dx)] = window[i++];
    }
  }
  return pixels;
}

/** 36 pixels, `count` of the first class and the rest of the second. */
const mix = (count: number, some: number, rest: number) =>
  Array.from({ length: 36 }, (_, i) => (i < count ? some : rest));

describe("cloud-phase class lookup", () => {
  // The names are the scene's own, and they are the only thing tying its
  // numbering to ours. A product that renumbers still has to decode.
  it("maps the published class names onto the ones this app uses", () => {
    const lookup = classify(
      "clear_sky liquid_water super_cooled_liquid_water mixed_phase ice unknown"
    );

    assert.equal(lookup.get(0), PHASE.clear);
    assert.equal(lookup.get(1), PHASE.liquid);
    assert.equal(lookup.get(2), PHASE.supercooled);
    assert.equal(lookup.get(3), PHASE.mixed);
    assert.equal(lookup.get(4), PHASE.ice);
    assert.equal(lookup.get(5), PHASE.unknown);
  });

  // Reading the classes off their position would put every class one place out
  // the moment a product stores them as anything but 0..n.
  it("reads the numbers the scene stores rather than the positions", () => {
    const lookup = classify(
      "clear_sky liquid_water super_cooled_liquid_water",
      [10, 20, 30]
    );

    assert.equal(lookup.get(30), PHASE.supercooled);
    assert.equal(lookup.get(2), undefined);
  });

  // Guessing at a class we have never seen is how a scene ends up confirming a
  // candidate with a value nobody checked the meaning of.
  it("does not guess at a class name it does not know", () => {
    const lookup = classify("clear_sky something_new");

    assert.equal(lookup.get(1), PHASE.unknown);
  });
});

describe("folding a phase scene onto the 12 km grid", () => {
  it("takes the commonest class among the cloudy pixels", () => {
    const pixels = scene(
      PHASE.clear,
      LUBBOCK,
      mix(30, PHASE.supercooled, PHASE.ice)
    );

    assert.equal(resample(grid, pixels, geo([LUBBOCK]))[0], PHASE.supercooled);
  });

  // The same majority rule the cloud-top layer uses, so the two products cannot
  // disagree about where there is cloud at all.
  it("calls a cell clear when most of its pixels are", () => {
    const pixels = scene(
      PHASE.clear,
      LUBBOCK,
      mix(17, PHASE.supercooled, PHASE.clear)
    );

    assert.equal(resample(grid, pixels, geo([LUBBOCK]))[0], PHASE.clear);
  });

  it("classifies a cell whose pixels are mostly cloudy", () => {
    const pixels = scene(
      PHASE.clear,
      LUBBOCK,
      mix(19, PHASE.supercooled, PHASE.clear)
    );

    assert.equal(resample(grid, pixels, geo([LUBBOCK]))[0], PHASE.supercooled);
  });

  // A tie has to fall the way that costs a candidate its confirmation. Breaking
  // it the other way would manufacture one out of a coin toss.
  it("breaks a tie toward the colder class", () => {
    const pixels = scene(
      PHASE.clear,
      LUBBOCK,
      mix(18, PHASE.supercooled, PHASE.ice)
    );

    assert.equal(resample(grid, pixels, geo([LUBBOCK]))[0], PHASE.ice);
  });

  // Nothing the satellite cannot see may read as clear sky: one is an
  // observation and the other is the absence of one.
  it("leaves a cell off the edge of the scan unknown", () => {
    const pixels = new Uint8Array(grid.nx * grid.ny).fill(PHASE.clear);
    const honolulu = geo([[21.31, -157.86]]);

    assert.equal(resample(grid, pixels, honolulu)[0], PHASE.unknown);
  });

  it("carries a class the product could not settle through as unknown", () => {
    const pixels = scene(
      PHASE.clear,
      LUBBOCK,
      mix(36, PHASE.unknown, PHASE.unknown)
    );

    assert.equal(resample(grid, pixels, geo([LUBBOCK]))[0], PHASE.unknown);
  });
});
