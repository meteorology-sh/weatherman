// ArcGIS
import {
  BAND_LABEL,
  FLIGHT_WINDOW_FT,
  CEILING_FT,
  RADAR_BANDS,
} from "@/lib/arcgis/bands";
import {
  ALL_LEGENDS,
  FLIGHT_WINDOW_LABEL,
  CEILING_LABEL,
  CandidateLegend,
  CloudBaseLegend,
  EchoFreezeLegend,
  HeadingLegend,
  LightningLegend,
  LiquidLegend,
  RadarLegend,
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

describe("CloudBaseLegend", () => {
  // The ceiling is the aircraft's design figure, and the prose has to read it
  // from the same constant the server bands on rather than restating it — a
  // hardcoded copy goes stale silently when the airframe changes.
  it("takes the ceiling from the constant the bands are built on", () => {
    expect(CEILING_LABEL).toContain(CEILING_FT.toLocaleString("en-US"));
    expect(detailOf(CloudBaseLegend)).toContain(CEILING_LABEL);
  });

  // The window is a test the candidate fill runs. This layer draws a height
  // and offers no switch, so the window must not appear on it at all.
  it("keeps the Texas window out of the layer entirely", () => {
    expect(CloudBaseLegend.summary).not.toContain(FLIGHT_WINDOW_LABEL);
    expect(detailOf(CloudBaseLegend)).not.toContain(FLIGHT_WINDOW_LABEL);
  });

  // Modelled data on a map of measurements, so the detail has to say which
  // this is.
  it("says the layer is modelled", () => {
    expect(detailOf(CloudBaseLegend)).toMatch(/modelled/i);
  });

  // MSL and AGL differ by thousands of feet across Texas, so a height with no
  // datum on it is a height an operator can read two ways. The ramp's own
  // caption says it too; this is the sentence under the switch.
  it("states the datum its heights are in", () => {
    expect(CloudBaseLegend.summary).toContain("MSL");
  });
});

describe("LiquidLegend", () => {
  // The one modelled layer on an observed map, and the band it is integrated
  // over is what makes it a seeding number rather than a cloud-water number.
  it("names the band it integrates over", () => {
    expect(LiquidLegend.summary).toContain(BAND_LABEL);
    expect(detailOf(LiquidLegend)).toContain(BAND_LABEL);
  });

  // The one modelled field on a map of measurements. It names the model it
  // comes from, which is what says it is not a reading.
  it("names the model it comes from", () => {
    expect(LiquidLegend.source).toContain("HRRR");
    expect(detailOf(LiquidLegend)).toContain("HRRR");
  });
});

describe("RadarLegend", () => {
  // The only measurement on either map, and the only layer that can cross a
  // candidate off. It names the instrument, its cadence and its resolution,
  // which is what an operator weighs a reading by.
  it("says what measured it, how often, and how finely", () => {
    expect(detailOf(RadarLegend)).toContain("MRMS");
    expect(detailOf(RadarLegend)).toContain("two minutes");
    expect(detailOf(RadarLegend)).toContain("1 km");
  });

  // Three switches sit under this layer, and a switch nobody has explained is
  // a switch an operator will not touch.
  it("names the three switches that sit under it", () => {
    expect(detailOf(RadarLegend)).toContain("core and heading");
    expect(detailOf(RadarLegend)).toContain("lightning");
    expect(detailOf(RadarLegend)).toContain("echo past freezing");
    expect(HeadingLegend.name).toBe("CORE AND HEADING");
    expect(HeadingLegend.summary).toContain("heaviest rain");
    expect(HeadingLegend.summary).toContain("direction it is moving");
    expect(LightningLegend.name).toBe("LIGHTNING");
    expect(LightningLegend.summary).toContain("flashes");
  });

  it("names echo past freezing as a switch under the radar", () => {
    expect(EchoFreezeLegend.name).toBe("ECHO PAST FREEZING");
    expect(EchoFreezeLegend.summary).toContain("18 dBZ");
    expect(EchoFreezeLegend.summary).toContain("freezing");
    expect(detailOf(EchoFreezeLegend)).toContain("18 dBZ");
  });

});

describe("CandidateLegend", () => {
  // The window survives here and only here: it is one of the three tests the
  // fill is built from, read from the same constant the server gates on.
  it("states the Texas tests it joins on", () => {
    expect(FLIGHT_WINDOW_LABEL).toContain(
      FLIGHT_WINDOW_FT[0].toLocaleString("en-US")
    );
    expect(FLIGHT_WINDOW_LABEL).toContain(
      FLIGHT_WINDOW_FT[1].toLocaleString("en-US")
    );
    expect(detailOf(CandidateLegend)).toContain(String(RADAR_BANDS[0].value));
    expect(detailOf(CandidateLegend)).toContain("18 dBZ");
    expect(detailOf(CandidateLegend)).toContain(FLIGHT_WINDOW_LABEL);
  });

  it("names every test it joins on, in the sentence under the switch", () => {
    expect(CandidateLegend.summary).toContain("window");
    expect(CandidateLegend.summary).toContain("echo");
    expect(CandidateLegend.summary).toContain("rain");
  });
});
