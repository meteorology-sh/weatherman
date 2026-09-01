import {
  INITIAL_BOX,
  covers,
  heldBox,
  requestFromExtent,
  viewFromExtent,
} from "@/lib/bbox";

describe("heldBox", () => {
  it("keeps the held window when the view zooms in inside it", () => {
    const next = heldBox(INITIAL_BOX, {
      xmin: -102,
      ymin: 28,
      xmax: -98,
      ymax: 32,
    });
    expect(next).toBe(INITIAL_BOX);
  });

  it("asks for a new padded window when the view leaves it", () => {
    const next = heldBox(INITIAL_BOX, {
      xmin: -102,
      ymin: 38,
      xmax: -98,
      ymax: 42,
    });
    expect(next).not.toBe(INITIAL_BOX);
    expect(next.north).toBeGreaterThan(42);
    expect(next.south).toBeLessThan(38);
  });
});

describe("covers", () => {
  it("is true only when the view sits inside the held window", () => {
    expect(
      covers(INITIAL_BOX, {
        west: -100,
        east: -96,
        south: 28,
        north: 32,
      })
    ).toBe(true);
    expect(
      covers(INITIAL_BOX, {
        west: -100,
        east: -96,
        south: 36,
        north: 40,
      })
    ).toBe(false);
  });
});

describe("viewFromExtent", () => {
  it("rounds the visible window out to a tenth of a degree", () => {
    expect(
      viewFromExtent({
        xmin: -100.23,
        ymin: 30.01,
        xmax: -99.01,
        ymax: 31.99,
      })
    ).toEqual({ west: -100.3, east: -99, south: 30, north: 32 });
  });
});

describe("requestFromExtent", () => {
  it("pads widely and rounds to a degree", () => {
    const box = requestFromExtent({
      xmin: -100,
      ymin: 30,
      xmax: -98,
      ymax: 32,
    });
    expect(box.west).toBeLessThanOrEqual(-101);
    expect(box.east).toBeGreaterThanOrEqual(-97);
    expect(Number.isInteger(box.west)).toBe(true);
    expect(Number.isInteger(box.east)).toBe(true);
  });
});
