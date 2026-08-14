// ArcGIS
import {
  BAND_LABEL,
  BASE_WINDOW_FT,
  CLOUD_TOP_BANDS,
  RADAR_BANDS,
} from "@/lib/arcgis/bands";
import {
  BASE_WINDOW_LABEL,
  CandidateLegend,
  CloudBaseLegend,
  CloudCoverLegend,
  CloudTopLegend,
  LiquidLegend,
  PrecipLegend,
  RadarLegend,
  CLOUD_TOP_WARMEST_C,
} from "@/lib/arcgis/legends";

/** Every layer named in the panel, so a new one cannot skip the checks below. */
const LEGENDS = [
  CandidateLegend,
  CloudBaseLegend,
  CloudCoverLegend,
  CloudTopLegend,
  LiquidLegend,
  PrecipLegend,
  RadarLegend,
];

describe("layer legends", () => {
  // The panel is a stack of switches read at a glance, so the names have one
  // shape: capitals, digits and underscores, nothing else.
  it("names every layer the same way", () => {
    for (const legend of LEGENDS) {
      expect(legend.name).toMatch(/^[A-Z0-9_]+$/);
    }
  });

  it("gives every layer a name of its own", () => {
    expect(new Set(LEGENDS.map((l) => l.name)).size).toBe(LEGENDS.length);
  });

  // The collapse under a switch answers two questions, and a layer that
  // answers neither is a switch with no explanation behind it.
  it("says what every layer measures and what it does not tell you", () => {
    for (const legend of LEGENDS) {
      expect(legend.about.length).toBeGreaterThan(0);
      expect(legend.caveat.length).toBeGreaterThan(0);
      expect(legend.source.length).toBeGreaterThan(0);
    }
  });
});

describe("CloudTopLegend", () => {
  // The layer shows the top; the seeding band is below it. Saying so is the
  // whole reason this layer does not replace the liquid-water one.
  it("names the band it cannot see into", () => {
    expect(CloudTopLegend.caveat).toContain(BAND_LABEL);
  });

  // The warm edge is load-bearing, not decoration: a top warmer than it means
  // the seeding band is above the cloud entirely. Read from the bands rather
  // than written twice, so the prose has to follow the mask when it moves.
  it("takes its warm edge from the bands themselves", () => {
    expect(CLOUD_TOP_WARMEST_C).toBe(CLOUD_TOP_BANDS[0].fromC);
  });

  it("states the warm edge it is cut at", () => {
    expect(CloudTopLegend.about).toContain(String(CLOUD_TOP_WARMEST_C));
  });

  it("admits the temperature is modelled even though the shape is observed", () => {
    expect(CloudTopLegend.caveat).toContain("HRRR");
  });
});

describe("CloudBaseLegend", () => {
  // The window's edges are cited operational practice, and the prose has to
  // read them from the same constant the server bands on rather than restating
  // them — a hardcoded copy goes stale silently when the window moves.
  it("takes the window from the constant the bands are built on", () => {
    expect(BASE_WINDOW_LABEL).toContain(
      BASE_WINDOW_FT[0].toLocaleString("en-US")
    );
    expect(BASE_WINDOW_LABEL).toContain(
      BASE_WINDOW_FT[1].toLocaleString("en-US")
    );
    expect(CloudBaseLegend.about).toContain(BASE_WINDOW_LABEL);
  });

  // Modelled data on the observed map is an exception to the editorial split,
  // and the panel is where it has to be admitted.
  it("admits the layer is modelled rather than observed", () => {
    expect(CloudBaseLegend.caveat).toContain("Modelled, not observed");
  });

  // MSL and AGL differ by thousands of feet across Texas, and the published
  // window does not say which it means. Silence would be the dishonest option.
  it("states the datum and that the source figure does not", () => {
    expect(CloudBaseLegend.about).toContain("MSL");
    expect(CloudBaseLegend.caveat).toContain("datum");
  });

  // The reason the map draws base and not depth: HRRR's own cloud top is far
  // sparser than its base.
  it("explains why depth is not drawn", () => {
    expect(CloudBaseLegend.caveat).toContain("Depth is not drawn");
  });
});

describe("LiquidLegend", () => {
  // The one modelled layer on an observed map, and the band it is integrated
  // over is what makes it a seeding number rather than a cloud-water number.
  it("names the band it integrates over", () => {
    expect(LiquidLegend.about).toContain(BAND_LABEL);
  });

  it("admits the layer is modelled rather than observed", () => {
    expect(LiquidLegend.caveat).toContain("Modelled, not observed");
  });
});

describe("RadarLegend", () => {
  // The only measurement on either map, and the only layer that can cross a
  // candidate off. Both halves of that have to be said.
  it("says it is measured and that it cannot confirm a candidate", () => {
    expect(RadarLegend.caveat).toContain("Measured, not modelled");
    expect(RadarLegend.caveat).toContain("never confirm one");
  });
});

describe("CandidateLegend", () => {
  // The tests it applies are the reason the layer exists, and their thresholds
  // are read from the bands rather than restated, so the prose follows them.
  it("states the thresholds it joins on", () => {
    expect(CandidateLegend.about).toContain(String(RADAR_BANDS[0].value));
    expect(CandidateLegend.about).toContain(String(CLOUD_TOP_WARMEST_C));
  });

  it("says it exists at the analysis hour only", () => {
    expect(CandidateLegend.caveat).toContain("analysis hour");
  });
});
