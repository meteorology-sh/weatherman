// ArcGIS
import { CloudLayerLegends } from "@/lib/arcgis/legends";

const band13 = CloudLayerLegends.band13;

/** Where a temperature should sit on a -90..+40 °C bar, as a percentage. */
const expectedPercent = (celsius: number) => ((celsius + 90) / 130) * 100;

describe("cloud layer legends", () => {
  it("gives GeoColor no colour ramp, because imagery is not a scale", () => {
    expect(CloudLayerLegends.geocolor.gradient).toBeUndefined();
  });

  it("tells the operator what each layer leaves out", () => {
    for (const legend of Object.values(CloudLayerLegends)) {
      expect(legend.caveat.length).toBeGreaterThan(0);
    }
  });

  // The bar is decoded against the imagery, so its ends must be the colours
  // the GIBS colour map assigns to -90 °C and +40 °C.
  it("anchors the Band13 ramp to the colour map's endpoints", () => {
    expect(band13.gradient).toContain("rgb(140,13,135) 0.0%");
    expect(band13.gradient).toContain("rgb(44,44,44) 100.0%");
  });

  it("brackets the seeding band at -12 °C", () => {
    expect(band13.band?.fromPercent).toBeCloseTo(expectedPercent(-12), 5);
  });

  it("brackets the seeding band at -5 °C", () => {
    expect(band13.band?.toPercent).toBeCloseTo(expectedPercent(-5), 5);
  });

  it("keeps the seeding bracket the right way round", () => {
    expect(band13.band!.fromPercent).toBeLessThan(band13.band!.toPercent);
  });

  it("places every tick where its temperature falls on the ramp", () => {
    expect(band13.ticks).toEqual([
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
    for (const tick of band13.ticks ?? []) {
      expect(tick.percent).toBeGreaterThanOrEqual(0);
      expect(tick.percent).toBeLessThanOrEqual(100);
    }
  });
});
