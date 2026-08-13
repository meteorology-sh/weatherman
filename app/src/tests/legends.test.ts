// ArcGIS
import {
  BAND_LABEL,
  BASE_WINDOW_FT,
  CLOUD_TOP_BANDS,
} from "@/lib/arcgis/renderers";
import {
  BASE_WINDOW_LABEL,
  CloudBaseLegend,
  CloudTopLegend,
  CLOUD_TOP_WARMEST_C,
} from "@/lib/arcgis/legends";

describe("cloud-top legend", () => {
  it("tells the operator what the layer leaves out", () => {
    expect(CloudTopLegend.caveat.length).toBeGreaterThan(0);
  });

  // The layer shows the top; the seeding band is below it. Saying so is the
  // whole reason this layer does not replace the liquid-water one.
  it("names the band it cannot see into", () => {
    expect(CloudTopLegend.caveat).toContain(BAND_LABEL);
  });

  // The warm edge is criterion C2, not decoration: a top warmer than it means
  // the seeding band is above the cloud entirely. Read from the bands rather
  // than written twice, so the prose has to follow the mask when it moves.
  it("takes its warm edge from the bands themselves", () => {
    expect(CLOUD_TOP_WARMEST_C).toBe(CLOUD_TOP_BANDS[0].fromC);
  });

  it("states the warm edge in the summary", () => {
    expect(CloudTopLegend.summary).toContain(String(CLOUD_TOP_WARMEST_C));
  });

  // The layer's one claim over the raster it replaced.
  it("says that nothing is drawn where there is no cloud", () => {
    expect(CloudTopLegend.summary.toLowerCase()).toContain("no cloud");
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
    expect(CloudBaseLegend.summary).toContain(BASE_WINDOW_LABEL);
  });

  // Real nodata is the layer's one claim over a raster, on this map as on the
  // cloud-top one.
  it("says that nothing is drawn where there is no cloud", () => {
    expect(CloudBaseLegend.summary.toLowerCase()).toContain("no cloud");
  });

  // Modelled data on the observed map is an exception to the editorial split,
  // and the panel is where it has to be admitted.
  it("admits the layer is modelled rather than observed", () => {
    expect(CloudBaseLegend.caveat).toContain("Modelled, not observed");
  });

  // MSL and AGL differ by thousands of feet across Texas, and the published
  // window does not say which it means. Silence would be the dishonest option.
  it("states the datum and that the source figure does not", () => {
    expect(CloudBaseLegend.summary).toContain("MSL");
    expect(CloudBaseLegend.caveat).toContain("datum");
  });

  // The reason the map draws base and not depth: HRRR's own cloud top is far
  // sparser than its base.
  it("explains why depth is not drawn", () => {
    expect(CloudBaseLegend.caveat).toContain("Depth is not drawn");
  });
});
