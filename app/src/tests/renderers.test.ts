// ArcGIS
import {
  CLOUD_BANDS,
  PRECIP_BANDS,
  PRECIP_LABELS,
  PRECIP_FIRST_HOUR,
  stackedAlpha,
  stackedColor,
  CLOUD_RGB,
  PRECIP_RGB,
} from "@/lib/arcgis/renderers";

describe("CLOUD_BANDS", () => {
  // The server decides which contours exist (FIELDS.clouds.levels in
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

describe("PRECIP_BANDS", () => {
  // Mirrors FIELDS.precip.levels on the server, in mm/hr.
  it("matches the levels the server contours", () => {
    expect(PRECIP_BANDS.map((b) => b.value)).toEqual([0.1, 0.5, 2.5, 7.6]);
  });

  // 2.5 and 7.6 mm/hr are the NWS light/moderate and moderate/heavy
  // boundaries. They are the reason these numbers and not round ones.
  it("breaks on the NWS intensity boundaries", () => {
    const values = PRECIP_BANDS.map((b) => b.value);
    expect(values).toContain(2.5);
    expect(values).toContain(7.6);
  });

  it("ascends, so the bands nest and stack in order", () => {
    const values = PRECIP_BANDS.map((b) => b.value);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("gets more opaque with harder rain", () => {
    const alphas = PRECIP_BANDS.map((b) => b.alpha);
    expect([...alphas].sort((a, b) => a - b)).toEqual(alphas);
  });

  it("names every band", () => {
    expect(PRECIP_LABELS).toHaveLength(PRECIP_BANDS.length);
  });
});

describe("PRECIP_FIRST_HOUR", () => {
  // HRRR diagnoses PRATE by integrating a timestep forward, so f00 is zero at
  // every one of its 1.9M points. Mirrors FIELDS.precip.firstHour.
  it("skips the analysis hour, which has no precipitation", () => {
    expect(PRECIP_FIRST_HOUR).toBe(1);
  });
});

describe("stackedAlpha", () => {
  // The legend's swatches are drawn from these numbers, so assert the numbers
  // rather than the labels — a legend can read "90%" while showing the wrong
  // shade.
  it("is the single band's alpha at the first level", () => {
    expect(stackedAlpha(CLOUD_BANDS, 1)).toBeCloseTo(0.1, 5);
  });

  it("composites multiplicatively, not additively", () => {
    // Additive would give 0.23; fills do not work that way.
    expect(stackedAlpha(CLOUD_BANDS, 2)).toBeCloseTo(1 - 0.9 * 0.87, 5);
    expect(stackedAlpha(CLOUD_BANDS, 2)).not.toBeCloseTo(0.23, 5);
  });

  it("leaves overcast under half opaque so the basemap still reads", () => {
    const full = stackedAlpha(CLOUD_BANDS, CLOUD_BANDS.length);
    expect(full).toBeGreaterThan(0.4);
    expect(full).toBeLessThan(0.5);
  });

  it("leaves heavy rain under two-thirds opaque for the same reason", () => {
    const full = stackedAlpha(PRECIP_BANDS, PRECIP_BANDS.length);
    expect(full).toBeGreaterThan(0.5);
    expect(full).toBeLessThan(0.65);
  });

  // Rain is ~2% of the domain against cloud's ~65%, so it can afford the
  // opacity that would veil the map if cloud took it.
  it("paints rain heavier than cloud at every depth", () => {
    for (let n = 1; n <= CLOUD_BANDS.length; n++) {
      expect(stackedAlpha(PRECIP_BANDS, n)).toBeGreaterThan(
        stackedAlpha(CLOUD_BANDS, n)
      );
    }
  });

  it("increases with every band added", () => {
    const steps = CLOUD_BANDS.map((_, i) => stackedAlpha(CLOUD_BANDS, i + 1));
    expect([...steps].sort((a, b) => a - b)).toEqual(steps);
  });

  it("paints nothing when no band applies", () => {
    expect(stackedAlpha(CLOUD_BANDS, 0)).toBe(0);
  });
});

describe("stackedColor", () => {
  it("carries the layer's hue into the legend swatch", () => {
    expect(stackedColor(CLOUD_BANDS, CLOUD_RGB, 1)).toBe(
      "rgba(255,255,255,0.100)"
    );
    expect(stackedColor(PRECIP_BANDS, PRECIP_RGB, 1)).toBe(
      "rgba(34,211,238,0.150)"
    );
  });

  // Cloud is a veil; rain is the thing you look for through it. If they shared
  // a hue the operator could not tell a raining cell from a thick one.
  it("gives rain a hue cloud can never reach", () => {
    expect(PRECIP_RGB).not.toEqual(CLOUD_RGB);
  });
});
