import {
  INITIAL_BOX,
  covers,
  heldBox,
  requestFromExtent,
  tracesNative,
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

describe("tracesNative", () => {
  // Texas plus padding on a normal window: a 3 km cell is about three
  // pixels across, so the native rings are structure the screen can show.
  it("traces native at the zoom a program works at", () => {
    expect(
      tracesNative({ xmin: -107, ymin: 25.5, xmax: -93, ymax: 37 }, 1200)
    ).toBe(true);
  });

  // The whole country in the same window is about 4.5 km to the pixel. A
  // native cell is smaller than a pixel there, so the average is the finest
  // thing that can be drawn and the extra rings would never be seen.
  it("falls back to the average when a cell is under a pixel", () => {
    expect(
      tracesNative({ xmin: -125, ymin: 24, xmax: -66, ymax: 50 }, 1200)
    ).toBe(false);
  });

  // The same ground on a wider screen resolves more, so the same box can
  // want native rings. The rule is pixels, not degrees.
  it("follows the screen, not the box", () => {
    const conus = { xmin: -125, ymin: 24, xmax: -66, ymax: 50 };
    expect(tracesNative(conus, 1200)).toBe(false);
    expect(tracesNative(conus, 2400)).toBe(true);
  });

  // Web Mercator extents arrive in meters, and the shared converter has to
  // run before the width means anything.
  it("reads a Mercator extent", () => {
    expect(
      tracesNative(
        { xmin: -11900000, ymin: 2900000, xmax: -10350000, ymax: 4450000 },
        1200
      )
    ).toBe(true);
  });

  // A view with no width yet is not a reason to ask for the heavier fill.
  it("is false before the view has been laid out", () => {
    expect(
      tracesNative({ xmin: -107, ymin: 25.5, xmax: -93, ymax: 37 }, 0)
    ).toBe(false);
  });
});
