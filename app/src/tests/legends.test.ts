// ArcGIS
import {
  BAND_LABEL,
  BASE_WINDOW_FT,
  CEILING_FT,
  CLOUD_TOP_BANDS,
  RADAR_BANDS,
} from "@/lib/arcgis/bands";
import {
  ALL_LEGENDS,
  BASE_WINDOW_LABEL,
  CEILING_LABEL,
  CandidateLegend,
  CloudBaseLegend,
  CloudTopLegend,
  LiquidLegend,
  RadarLegend,
  StormLegend,
  CLOUD_TOP_WARMEST_C,
} from "@/lib/arcgis/legends";

/** The whole detail block as one string, for the checks that only need a fact. */
const detailOf = (legend: (typeof ALL_LEGENDS)[number]) =>
  legend.detail.join(" ");

describe("layer legends", () => {
  // The panel is a stack of switches read at a glance, so the names have one
  // shape: capitals and single spaces, nothing else. No underscores — a name is
  // read, not typed, and SUPERCOOLED_LIQUID_WATER reads like a constant.
  it("names every layer the same way", () => {
    for (const legend of ALL_LEGENDS) {
      expect(legend.name).toMatch(/^[A-Z]+( [A-Z]+)*$/);
    }
  });

  it("gives every layer a name of its own", () => {
    expect(new Set(ALL_LEGENDS.map((l) => l.name)).size).toBe(
      ALL_LEGENDS.length
    );
  });

  // The switch has room for one sentence and no more. A summary that runs on
  // is the dense prose creeping back into the panel, which is what the About
  // page exists to prevent.
  it("gives every layer one short sentence for the panel", () => {
    for (const legend of ALL_LEGENDS) {
      expect(legend.summary.length).toBeGreaterThan(0);
      expect(legend.summary.length).toBeLessThan(200);
      expect(legend.source.length).toBeGreaterThan(0);
    }
  });

  // The About page is where a layer gets explained, so a layer with nothing to
  // say there is a section that renders as a heading over a sentence.
  it("gives every layer more than a sentence on the About page", () => {
    for (const legend of ALL_LEGENDS) {
      expect(legend.detail.length).toBeGreaterThan(0);
      for (const paragraph of legend.detail) {
        expect(paragraph.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("CloudTopLegend", () => {
  // The layer shows the top; the seeding band is below it. Saying so is the
  // whole reason this layer does not replace the liquid-water one.
  it("names the band it cannot see into", () => {
    expect(detailOf(CloudTopLegend)).toContain(BAND_LABEL);
  });

  // The warm edge is load-bearing, not decoration: a top warmer than it means
  // the seeding band is above the cloud entirely. Read from the bands rather
  // than written twice, so the prose has to follow the mask when it moves.
  it("takes its warm edge from the bands themselves", () => {
    expect(CLOUD_TOP_WARMEST_C).toBe(CLOUD_TOP_BANDS[0].fromC);
  });

  // The cut is the first thing an operator asks about an empty patch of map,
  // so it is one of the few numbers that earns its place on the switch.
  it("states the warm edge it is cut at on the switch", () => {
    expect(CloudTopLegend.summary).toContain(String(CLOUD_TOP_WARMEST_C));
  });

  it("admits the temperature is modelled even though the shape is observed", () => {
    expect(detailOf(CloudTopLegend)).toContain("HRRR");
  });
});

describe("CloudBaseLegend", () => {
  // The ceiling is the aircraft's design figure, and the prose has to read it
  // from the same constant the server bands on rather than restating it — a
  // hardcoded copy goes stale silently when the airframe changes.
  it("takes the ceiling from the constant the bands are built on", () => {
    expect(CEILING_LABEL).toContain(CEILING_FT.toLocaleString("en-US"));
    expect(CloudBaseLegend.summary).toContain(CEILING_LABEL);
  });

  // The Texas window is reported and never drawn, so the switch's one sentence
  // must not offer it as what the ramp shows.
  it("keeps the Texas window out of the summary", () => {
    expect(CloudBaseLegend.summary).not.toContain(BASE_WINDOW_LABEL);
  });

  // It still has to be explained somewhere, and the About page is where the
  // layer says what it does not tell you.
  it("explains the window it does not band on, in the detail", () => {
    expect(BASE_WINDOW_LABEL).toContain(
      BASE_WINDOW_FT[0].toLocaleString("en-US")
    );
    expect(BASE_WINDOW_LABEL).toContain(
      BASE_WINDOW_FT[1].toLocaleString("en-US")
    );
    expect(CloudBaseLegend.detail.join(" ")).toContain(BASE_WINDOW_LABEL);
  });

  // Modelled data on the observed map is an exception to the editorial split,
  // and the About page is where it has to be admitted.
  it("admits the layer is modelled rather than observed", () => {
    expect(detailOf(CloudBaseLegend)).toContain("Modelled, not observed");
  });

  // MSL and AGL differ by thousands of feet across Texas, so a height with no
  // datum on it is a height an operator can read two ways.
  it("states the datum its heights are in", () => {
    expect(CloudBaseLegend.summary).toContain("MSL");
    expect(detailOf(CloudBaseLegend)).toContain("MSL");
  });
});

describe("LiquidLegend", () => {
  // The one modelled layer on an observed map, and the band it is integrated
  // over is what makes it a seeding number rather than a cloud-water number.
  it("names the band it integrates over", () => {
    expect(LiquidLegend.summary).toContain(BAND_LABEL);
    expect(detailOf(LiquidLegend)).toContain(BAND_LABEL);
  });

  it("admits the layer is modelled rather than observed", () => {
    expect(detailOf(LiquidLegend)).toContain("Modelled, not observed");
  });
});

describe("StormLegend", () => {
  it("names the 20 dBZ threshold that defines a storm", () => {
    expect(StormLegend.summary).toContain("20 dBZ");
    expect(StormLegend.summary).toContain("heaviest rain");
  });

  it("says the dashed line is the working area, not rain", () => {
    expect(StormLegend.summary).toContain("working area");
    expect(StormLegend.summary).toContain("upwind");
    expect(detailOf(StormLegend)).toContain("not rain");
    expect(detailOf(StormLegend)).toContain("moving away from");
  });
});

describe("RadarLegend", () => {
  // The only measurement on either map, and the only layer that can cross a
  // candidate off. Both halves of that have to be said.
  it("says it is measured and that it cannot confirm a candidate", () => {
    expect(detailOf(RadarLegend)).toContain("Measured, not modelled");
    expect(detailOf(RadarLegend)).toContain("never confirm one");
  });
});

describe("CandidateLegend", () => {
  // The tests it applies are the reason the layer exists, and their thresholds
  // are read from the bands rather than restated, so the prose follows them.
  it("states the thresholds it joins on", () => {
    expect(detailOf(CandidateLegend)).toContain(String(RADAR_BANDS[0].value));
    expect(detailOf(CandidateLegend)).toContain(String(CLOUD_TOP_WARMEST_C));
  });

  it("says it exists at the analysis hour only", () => {
    expect(detailOf(CandidateLegend)).toContain("analysis hour");
  });

  // The switch names all four tests without a number on any of them. That is
  // the layer in one line, and it is what a reader who never opens the About
  // page takes away.
  it("names every test it joins on, in the sentence under the switch", () => {
    expect(CandidateLegend.summary).toContain("liquid");
    expect(CandidateLegend.summary).toContain("cloud top");
    expect(CandidateLegend.summary).toContain("cloud base");
    expect(CandidateLegend.summary).toContain("rain");
  });
});
