// Geometry
import { insideRing } from "@/lib/geometry";

// Types
import type { DomainRing } from "@/lib/types";

/** A closed square from (-10, 0) to (0, 10), in [lon, lat]. */
const square: DomainRing = [
  [-10, 0],
  [0, 0],
  [0, 10],
  [-10, 10],
  [-10, 0],
];

/**
 * A ring with a notch cut into its east side, which is the shape that matters:
 * HRRR's grid is a Lambert quadrilateral whose edges bow, so a point can be
 * inside the bounding box and outside the ring.
 */
const notched: DomainRing = [
  [-10, 0],
  [0, 0],
  [-5, 5],
  [0, 10],
  [-10, 10],
  [-10, 0],
];

describe("insideRing", () => {
  it("puts a point in the middle inside", () => {
    expect(insideRing(square, -5, 5)).toBe(true);
  });

  it("puts a point beyond every edge outside", () => {
    expect(insideRing(square, -5, 20)).toBe(false);
    expect(insideRing(square, -5, -1)).toBe(false);
    expect(insideRing(square, -11, 5)).toBe(false);
    expect(insideRing(square, 1, 5)).toBe(false);
  });

  // The whole reason the ring is fetched rather than a bounding box being
  // assumed: a click here is inside the box and outside the model.
  it("excludes a point inside the bounding box but outside the ring", () => {
    expect(insideRing(notched, -1, 5)).toBe(false);
    expect(insideRing(notched, -8, 5)).toBe(true);
  });

  it("does not depend on the ring being closed twice", () => {
    const open = square.slice(0, -1);

    expect(insideRing(open, -5, 5)).toBe(true);
    expect(insideRing(open, 1, 5)).toBe(false);
  });
});
