// ArcGIS
import {
  CLOUD_BANDS,
  PRECIP_BANDS,
  PRECIP_LABELS,
  PRECIP_FIRST_HOUR,
  RADAR_BANDS,
  RADAR_LABELS,
  RADAR_RGB,
  stackedAlpha,
  stackedColor,
  soloColor,
  CLOUD_RGB,
  PRECIP_RGB,
  SLW_RGB,
  PIREP_RGB,
  PIREP_NEG_RGB,
  PIREP_CLASSES,
  PIREP_COLORS,
  PIREP_IN_BAND,
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

describe("RADAR_BANDS", () => {
  // Mirrors REFLECTIVITY.levels on the server, in dBZ.
  it("matches the levels the server contours", () => {
    expect(RADAR_BANDS.map((b) => b.value)).toEqual([20, 30, 40, 50]);
  });

  it("ascends, so the bands nest and stack in order", () => {
    const values = RADAR_BANDS.map((b) => b.value);
    expect([...values].sort((a, b) => a - b)).toEqual(values);
  });

  it("gets more opaque with harder rain", () => {
    const alphas = RADAR_BANDS.map((b) => b.alpha);
    expect([...alphas].sort((a, b) => a - b)).toEqual(alphas);
  });

  it("names every band", () => {
    expect(RADAR_LABELS).toHaveLength(RADAR_BANDS.length);
  });

  // Observed rain and forecast rain are the same quantity, and they never share
  // a map. A second hue would imply a second variable.
  it("paints observed rain the colour the forecast map paints rain", () => {
    expect(RADAR_RGB).toEqual(PRECIP_RGB);
  });

  // Drawn over the liquid-water contours, so the top band has to leave the
  // amber underneath legible rather than covering it.
  it("stays translucent enough to read the layer underneath", () => {
    expect(stackedAlpha(RADAR_BANDS, RADAR_BANDS.length)).toBeLessThan(0.7);
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

describe("PIREP_CLASSES", () => {
  // Mirrors SEVERITY in server/src/lib/services/pirep.ts. The server ranks the
  // filed code; this decides how each rank is drawn, and a rank with no class
  // would render as an unstyled default marker.
  it("has a class for every rank the server can emit", () => {
    expect(PIREP_CLASSES.map((c) => c.value)).toEqual([0, 1, 2, 3, 4]);
  });

  it("reserves rank 0 for a report of no ice", () => {
    expect(PIREP_CLASSES[0].label).toBe("none");
  });

  it("gets more opaque and larger with worse icing", () => {
    const alphas = PIREP_CLASSES.map((c) => c.alpha);
    const sizes = PIREP_CLASSES.map((c) => c.size);

    expect([...alphas].sort((a, b) => a - b)).toEqual(alphas);
    expect([...sizes].sort((a, b) => a - b)).toEqual(sizes);
  });

  // A negative report is evidence, but not evidence of liquid water. If it
  // shared the positive hue it would read as a hit at a glance.
  it("paints a negative report in a different hue from every positive one", () => {
    expect(PIREP_CLASSES[0].rgb).toEqual(PIREP_NEG_RGB);
    for (const found of PIREP_CLASSES.slice(1)) {
      expect(found.rgb).toEqual(PIREP_RGB);
    }
  });

  // The candidate map already spends amber on modelled liquid water. A report
  // is the opposite kind of claim and has to be told apart from it.
  it("gives reports a hue the modelled liquid water never takes", () => {
    expect(PIREP_RGB).not.toEqual(SLW_RGB);
  });
});

describe("soloColor", () => {
  // PIREP markers do not stack — one aircraft, one point, one class — so the
  // legend must read each class straight rather than compositing it.
  it("is the class's own alpha, not a running composite", () => {
    expect(soloColor(PIREP_RGB, 0.55)).toBe("rgba(167,139,250,0.550)");
  });

  it("gives the legend the colour each marker is actually painted", () => {
    expect(PIREP_COLORS).toEqual(
      PIREP_CLASSES.map((c) => soloColor(c.rgb, c.alpha))
    );
  });

  // Four stacked bands reach ~0.6 alpha; one solo band at 1.0 does not. Getting
  // these two the same way round is the whole point of having both.
  it("differs from the stacked composite it is not", () => {
    expect(soloColor(CLOUD_RGB, 0.1)).not.toBe(
      stackedColor(CLOUD_BANDS, CLOUD_RGB, 2)
    );
  });
});

describe("PIREP_IN_BAND", () => {
  // The server already decides band membership per report, including that an
  // unknown temperature is not in band. Re-deriving it here from tempC would
  // silently disagree with the count in the sidebar.
  it("filters on the flag the server set, not on temperature", () => {
    expect(PIREP_IN_BAND).toBe("inBand = 1");
    expect(PIREP_IN_BAND).not.toContain("tempC");
  });
});
