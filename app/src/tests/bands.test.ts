// ArcGIS
import { candidateCloudBaseRenderer } from "@/lib/arcgis/renderers";
import type SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import {
  SEEDABLE_BASE_FT,
  BASE_CEILING_FT,
  CANDIDATE_BANDS,
  CEILING_FT,
  CLOUD_BASE_ALPHA,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  CLOUD_BANDS,
  PRECIP_BANDS,
  PRECIP_LABELS,
  PRECIP_FIRST_HOUR,
  MOTION_RGB,
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

/** Rec. 709 luma, so "lighter" is what an eye reads and not a sum of channels. */
const lightness = (rgb: readonly number[]) =>
  0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];

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
  it("paints observed rain the color the forecast map paints rain", () => {
    expect(RADAR_RGB).toEqual(PRECIP_RGB);
  });

  // Drawn over the liquid-water contours, so the top band has to leave the
  // amber underneath legible rather than covering it.
  it("stays translucent enough to read the layer underneath", () => {
    expect(stackedAlpha(RADAR_BANDS, RADAR_BANDS.length)).toBeLessThan(0.7);
  });
});

describe("heading mark", () => {
  it("is white on the dark basemap", () => {
    expect(MOTION_RGB).toEqual([255, 255, 255]);
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
  // The cloud-base bands are disjoint — exactly one applies to a cell — so the
  // legend must read each band straight rather than compositing it.
  it("is the band's own alpha, not a running composite", () => {
    expect(soloColor(CLOUD_BASE_RGB, 0.3)).toBe("rgba(167,139,250,0.300)");
  });

  it("gives the legend the color each band is actually painted", () => {
    const band = CLOUD_BASE_BANDS[0];

    expect(soloColor(band.rgb, CLOUD_BASE_ALPHA)).toBe(
      `rgba(${band.rgb.join(",")},${CLOUD_BASE_ALPHA.toFixed(3)})`
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

describe("CLOUD_BASE_BANDS", () => {
  const third = BASE_CEILING_FT / 3;

  // The server bands on thirds of the top of the map. If these drift apart the
  // renderer matches nothing and the layer paints as invisible.
  it("keys each band on the lower edge the server emits", () => {
    expect(CLOUD_BASE_BANDS.map((band) => band.value)).toEqual([
      0,
      third,
      2 * third,
      BASE_CEILING_FT,
    ]);
  });

  it("matches on the field the server writes", () => {
    expect(candidateCloudBaseRenderer.field).toBe("cloudBaseFt");
  });

  // Lightness is the number: the lowest base is the deepest violet and the
  // highest is the palest, so a cell reads as high or low without the legend.
  it("lightens as the base gets higher", () => {
    const light = CLOUD_BASE_BANDS.map((band) => lightness(band.rgb));

    expect(light).toEqual([...light].sort((a, b) => a - b));
  });

  // The height is in the color, so the symbol's opacity carries none of it: the
  // see-through is one knob on the layer, and what a band mixes with is the
  // basemap rather than another band.
  it("paints every band at one opacity", () => {
    const alphas = candidateCloudBaseRenderer.uniqueValueInfos!.map(
      (info) => (info.symbol as SimpleFillSymbol).color!.a
    );

    expect(alphas).toEqual(CLOUD_BASE_BANDS.map(() => CLOUD_BASE_ALPHA));
  });

  // These bands do not composite: a disjoint band is painted once, so it has to
  // carry its whole separation from its neighbors in its own color. Steps this
  // wide survive being read against a basemap rather than against each other.
  it("separates each band by a step of its own", () => {
    const light = CLOUD_BASE_BANDS.map((band) => lightness(band.rgb));

    for (let i = 0; i < light.length - 1; i++) {
      expect(light[i + 1] - light[i]).toBeGreaterThanOrEqual(24);
    }
  });

  // The edges come from the top of the map, not from Texas practice — which
  // matters because two thirds of it happens to land on 12,000 ft, the same
  // number as the seeding criterion. Assert the derivation rather than the
  // presence of the number, or the coincidence reads as a citation the layer
  // does not have. The bands are MSL and the criterion is AGL, so they are not
  // the same claim even where they print the same figure.
  it("derives every edge from the top of the map, not the seeding criterion", () => {
    expect(CLOUD_BASE_BANDS.map((band) => band.value)).toEqual(
      [0, 1, 2, 3].map((n) => (n * BASE_CEILING_FT) / 3)
    );
    expect(2 * third).toBe(SEEDABLE_BASE_FT); // the coincidence
  });
});
