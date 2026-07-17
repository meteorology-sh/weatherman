// ArcGIS
import { Band13Legend } from "@/lib/arcgis/legends";

/** Where a temperature should sit on a -90..+40 °C bar, as a percentage. */
const expectedPercent = (celsius: number) => ((celsius + 90) / 130) * 100;

describe("Band13 legend", () => {
  it("tells the operator what the layer leaves out", () => {
    expect(Band13Legend.caveat.length).toBeGreaterThan(0);
  });

  // The bar is decoded against the imagery, so its ends must be the colours
  // the GIBS colour map assigns to -90 °C and +40 °C.
  it("anchors the ramp to the colour map's endpoints", () => {
    expect(Band13Legend.gradient).toContain("rgb(140,13,135) 0.0%");
    expect(Band13Legend.gradient).toContain("rgb(44,44,44) 100.0%");
  });

  it("brackets the seeding band at -12 °C", () => {
    expect(Band13Legend.band.fromPercent).toBeCloseTo(expectedPercent(-12), 5);
  });

  it("brackets the seeding band at -5 °C", () => {
    expect(Band13Legend.band.toPercent).toBeCloseTo(expectedPercent(-5), 5);
  });

  it("keeps the seeding bracket the right way round", () => {
    expect(Band13Legend.band.fromPercent).toBeLessThan(
      Band13Legend.band.toPercent
    );
  });

  it("places every tick where its temperature falls on the ramp", () => {
    expect(Band13Legend.ticks).toEqual([
      { label: "-80°", percent: expectedPercent(-80) },
      { label: "-60°", percent: expectedPercent(-60) },
      { label: "-40°", percent: expectedPercent(-40) },
      { label: "-20°", percent: expectedPercent(-20) },
      { label: "0°", percent: expectedPercent(0) },
      { label: "20°", percent: expectedPercent(20) },
      { label: "40°", percent: expectedPercent(40) },
    ]);
  });

  it("keeps every tick on the bar", () => {
    for (const tick of Band13Legend.ticks) {
      expect(tick.percent).toBeGreaterThanOrEqual(0);
      expect(tick.percent).toBeLessThanOrEqual(100);
    }
  });
});
