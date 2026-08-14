// ArcGIS
import {
  candidateCloudBaseRenderer,
  candidateCloudTopRenderer,
} from "@/lib/arcgis/renderers";
import {
  BASE_WINDOW_FT,
  CANDIDATE_BANDS,
  CEILING_FT,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  CLOUD_TOP_BANDS,
  CLOUD_TOP_RGB,
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
} from "@/lib/arcgis/bands";

describe("CLOUD_BANDS", () => {
  // The server decides which contours exist (FIELDS.clouds.levels in
  // server/src/lib/services/hrrr/forecast.ts); this pins our half of that contract.
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

describe("soloColor", () => {
  // The cloud-top bands are disjoint — exactly one applies to a cell — so the
  // legend must read each band straight rather than compositing it.
  it("is the band's own alpha, not a running composite", () => {
    expect(soloColor(CLOUD_TOP_RGB, 0.3)).toBe("rgba(148,163,184,0.300)");
  });

  it("gives the legend the colour each band is actually painted", () => {
    expect(soloColor(CLOUD_TOP_RGB, CLOUD_TOP_BANDS[0].alpha)).toContain(
      String(CLOUD_TOP_BANDS[0].alpha)
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

describe("CLOUD_TOP_BANDS", () => {
  // Disjoint, not nested: the intervals have to meet end to end with no gap and
  // no overlap, or a cell falls into two bands or none.
  it("tiles the temperature range without gaps or overlaps", () => {
    for (let i = 0; i < CLOUD_TOP_BANDS.length - 1; i++) {
      expect(CLOUD_TOP_BANDS[i].toC).toBe(CLOUD_TOP_BANDS[i + 1].fromC);
    }
  });

  // Nothing is discarded for being cold. See MEASUREMENTS.md §4 — there is no
  // cold cutoff, and the open end is what says so.
  it("leaves the coldest band open-ended", () => {
    expect(CLOUD_TOP_BANDS[CLOUD_TOP_BANDS.length - 1].toC).toBeNull();
  });

  // The ramp runs loud-to-quiet, backwards from every other layer here: the
  // warmest band is the target, and the coldest is cirrus over most of the sky.
  it("fades as the tops get colder", () => {
    const alphas = CLOUD_TOP_BANDS.map((band) => band.alpha);

    expect(alphas).toEqual([...alphas].sort((a, b) => b - a));
  });

  // The band value is what the server writes on the feature; if the two drift,
  // the renderer matches nothing and the layer paints as invisible.
  it("keys each band on the coldness the server emits", () => {
    expect(CLOUD_TOP_BANDS.map((band) => band.value)).toEqual([5, 12, 18, 25]);
    expect(CLOUD_TOP_BANDS.map((band) => -band.fromC)).toEqual([5, 12, 18, 25]);
  });

  it("matches on the field the server writes", () => {
    expect(candidateCloudTopRenderer.field).toBe("topColdnessC");
  });

  // Colourless on purpose: amber is spent on modelled liquid water and cyan on
  // observed rain, and cloud shape must not compete with either.
  it("stays grey so the layers above it keep their hues", () => {
    const [r, g, b] = CLOUD_TOP_RGB;

    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(50);
  });
});

describe("CLOUD_BASE_BANDS", () => {
  const third = CEILING_FT / 3;

  // The server bands on thirds of the ceiling. If these drift apart the
  // renderer matches nothing and the layer paints as invisible.
  it("keys each band on the lower edge the server emits", () => {
    expect(CLOUD_BASE_BANDS.map((band) => band.value)).toEqual([
      0,
      third,
      2 * third,
      CEILING_FT,
    ]);
  });

  it("matches on the field the server writes", () => {
    expect(candidateCloudBaseRenderer.field).toBe("cloudBaseFt");
  });

  // Loud to quiet, like the cloud tops: brightness is how short the climb is,
  // not how big the number is. Inverted, the ramp would shout about the cloud
  // furthest out of reach.
  it("fades as the base gets higher", () => {
    const alphas = CLOUD_BASE_BANDS.map((band) => band.alpha);

    expect(alphas).toEqual([...alphas].sort((a, b) => b - a));
  });

  // A base too high to reach and no cloud at all are different answers, and
  // dropping the top band would make them the same blank cell.
  it("still draws the cloud above the ceiling", () => {
    const top = CLOUD_BASE_BANDS[CLOUD_BASE_BANDS.length - 1];

    expect(top.value).toBe(CEILING_FT);
    expect(top.alpha).toBeGreaterThan(0);
  });

  // Three fills on one map, and a fourth that must not read as any of them.
  it("takes the one hue the candidate map has left", () => {
    for (const other of [SLW_RGB, RADAR_RGB, CLOUD_TOP_RGB]) {
      expect(CLOUD_BASE_RGB).not.toEqual(other);
    }
  });

  // Disjoint bands, so the swatch is the literal fill. Nothing composites, and
  // a stacked alpha would describe a map that is not being drawn. The ceiling
  // is where the nested layers' four bands stack to, so the loudest fill on the
  // map is no louder here than it is anywhere else.
  it("stays faint enough that the basemap reads through", () => {
    for (const band of CLOUD_BASE_BANDS) {
      expect(band.alpha).toBeLessThanOrEqual(
        stackedAlpha(CANDIDATE_BANDS, CANDIDATE_BANDS.length)
      );
    }
  });

  // These bands do not composite, so the gap between them is only as wide as it
  // is written — see the cloud-top note for why that has to be said out loud.
  it("separates each band by more than a stacking step", () => {
    const alphas = CLOUD_BASE_BANDS.map((band) => band.alpha);

    for (let i = 0; i < alphas.length - 1; i++) {
      expect(alphas[i] - alphas[i + 1]).toBeGreaterThanOrEqual(0.12);
    }
  });

  // The edges come from the aircraft, not from Texas practice — which matters
  // because two thirds of the ceiling happens to land on 12,000 ft, the top of
  // the window. Assert the derivation rather than the absence of the number, or
  // the coincidence reads as a citation the layer does not have.
  it("derives every edge from the ceiling, not from the Texas window", () => {
    expect(CLOUD_BASE_BANDS.map((band) => band.value)).toEqual(
      [0, 1, 2, 3].map((n) => (n * CEILING_FT) / 3)
    );
    expect(CLOUD_BASE_BANDS[2].value).toBe(BASE_WINDOW_FT[1]); // the coincidence
    expect(CLOUD_BASE_BANDS.map((b) => b.value)).not.toContain(
      BASE_WINDOW_FT[0]
    );
  });
});
