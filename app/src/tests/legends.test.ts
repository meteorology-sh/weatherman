// ArcGIS
import {
  BAND_LABEL,
  BAND_WARMEST_C,
  BAND_COLDEST_C,
} from "@/lib/arcgis/renderers";
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

  // Pinned against the band constants rather than literals: the bracket has to
  // follow the band when it moves, and it did not the first time it moved.
  it("brackets the seeding band at its cold edge", () => {
    expect(Band13Legend.band.fromPercent).toBeCloseTo(
      expectedPercent(BAND_COLDEST_C),
      5
    );
  });

  it("brackets the seeding band at its warm edge", () => {
    expect(Band13Legend.band.toPercent).toBeCloseTo(
      expectedPercent(BAND_WARMEST_C),
      5
    );
  });

  it("names the band it brackets in the caveat", () => {
    expect(Band13Legend.caveat).toContain(BAND_LABEL);
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
