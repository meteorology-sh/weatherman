// ArcGIS
import { CLOUD_BANDS, stackedAlpha } from "@/lib/arcgis/renderers";

describe("CLOUD_BANDS", () => {
  // The server decides which contours exist (LEVELS in
  // server/src/lib/services/forecast.ts); this pins our half of that contract.
  it("matches the levels the server contours", () => {
    expect(CLOUD_BANDS.map((b) => b.value)).toEqual([30, 50, 70, 90]);
  });

  it("has no 10% band, which would veil most of the country", () => {
    expect(CLOUD_BANDS.map((b) => b.value)).not.toContain(10);
  });

  it("ascends, so the bands nest and stack in order", () => {
    const values = CLOUD_BANDS.map((b) => b.value);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("gets more opaque with more cloud", () => {
    const alphas = CLOUD_BANDS.map((b) => b.alpha);
    expect([...alphas].sort((a, b) => a - b)).toEqual(alphas);
  });
});

describe("stackedAlpha", () => {
  // The legend's swatches are drawn from these numbers, so assert the numbers
  // rather than the labels — a legend can read "90%" while showing the wrong
  // shade.
  it("is the single band's alpha at the first level", () => {
    expect(stackedAlpha(1)).toBeCloseTo(0.1, 5);
  });

  it("composites multiplicatively, not additively", () => {
    // Additive would give 0.23; fills do not work that way.
    expect(stackedAlpha(2)).toBeCloseTo(1 - 0.9 * 0.87, 5);
    expect(stackedAlpha(2)).not.toBeCloseTo(0.23, 5);
  });

  it("leaves overcast under half opaque so the basemap still reads", () => {
    const full = stackedAlpha(CLOUD_BANDS.length);
    expect(full).toBeGreaterThan(0.4);
    expect(full).toBeLessThan(0.5);
  });

  it("increases with every band added", () => {
    const steps = CLOUD_BANDS.map((_, i) => stackedAlpha(i + 1));
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it("paints nothing when no band applies", () => {
    expect(stackedAlpha(0)).toBe(0);
  });
});
