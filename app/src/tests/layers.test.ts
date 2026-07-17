// ArcGIS
import {
  Band13Layer,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
  CandidateLiquidLayer,
} from "@/lib/arcgis/layers";

describe("GOES imagery layer", () => {
  it("points Band13 at the GIBS GOES-East Clean Infrared endpoint", () => {
    expect(Band13Layer.urlTemplate).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" +
        "GOES-East_ABI_Band13_Clean_Infrared" +
        "/default/default/GoogleMapsCompatible_Level6/{level}/{row}/{col}.png"
    );
  });

  // GIBS publishes Band13 only to zoom 6. Requesting a deeper tile 400s, so the
  // layer's LODs must stop where its matrix set does.
  it("caps Band13 at the zoom level GIBS publishes (6)", () => {
    const levels = Band13Layer.tileInfo.lods.map((lod) => lod.level);

    expect(Math.max(...levels)).toBe(6);
  });

  // GIBS serves these from its epsg3857 endpoint, so the tiling scheme has to
  // be Web Mercator or the imagery lands in the wrong place.
  it("tiles in Web Mercator to match the basemap", () => {
    expect(Band13Layer.tileInfo.spatialReference.isWebMercator).toBe(true);
  });

  it("credits NASA GIBS and NOAA", () => {
    expect(Band13Layer.copyright).toBe("NASA GIBS / NOAA GOES-East");
  });

  it("leaves visibility to the map, which drives it from the store", () => {
    expect(Band13Layer.visible).toBe(false);
  });
});

describe("HRRR contour layers", () => {
  it("credits NOAA on every contour layer", () => {
    for (const layer of [
      ForecastCloudsLayer,
      ForecastPrecipLayer,
      CandidateLiquidLayer,
    ]) {
      expect(layer.copyright).toBe("NOAA HRRR");
    }
  });

  it("leaves visibility to the map", () => {
    for (const layer of [
      ForecastCloudsLayer,
      ForecastPrecipLayer,
      CandidateLiquidLayer,
    ]) {
      expect(layer.visible).toBe(false);
    }
  });

  // The renderer matches on a field, so the field has to be the one the server
  // puts on the feature.
  it("renders each layer on the property its server frame carries", () => {
    expect(ForecastCloudsLayer.renderer).toHaveProperty("field", "cloudCover");
    expect(ForecastPrecipLayer.renderer).toHaveProperty("field", "precipRate");
    expect(CandidateLiquidLayer.renderer).toHaveProperty("field", "slwPath");
  });

  // The candidate map is "right now", and CLWMR is a state the analysis holds,
  // so hour 0 is a real answer here rather than the empty one precip gives.
  //
  // ArcGIS splits a query string off `url` into `customParameters` and
  // re-appends it when it fetches, so the hour has to be asserted where it
  // actually lands — reading `url` alone would pass while the hour went missing.
  it("pins the liquid layer to the analysis hour", () => {
    expect(CandidateLiquidLayer.url).toBe("/forecast/liquid");
    expect(CandidateLiquidLayer.customParameters).toEqual({ hour: "0" });
  });
});
