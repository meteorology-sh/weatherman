// ArcGIS
import { BAND_LABEL, CLOUD_TOP_BANDS } from "@/lib/arcgis/renderers";
import { CloudTopLegend, CLOUD_TOP_WARMEST_C } from "@/lib/arcgis/legends";

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
