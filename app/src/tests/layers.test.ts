// ArcGIS
import {
  Band13Layer,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
  CandidateLiquidLayer,
  CandidateRadarLayer,
  CandidatePirepLayer,
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

describe("icing PIREP layer", () => {
  it("reads the reports from our server, not from AWC directly", () => {
    expect(CandidatePirepLayer.url).toBe("/pireps/icing");
  });

  it("credits the Aviation Weather Center", () => {
    expect(CandidatePirepLayer.copyright).toBe("NOAA Aviation Weather Center");
  });

  it("leaves visibility to the map", () => {
    expect(CandidatePirepLayer.visible).toBe(false);
  });

  /**
   * Points, not a surface. ~20 positive reports over the country, only where
   * aircraft fly — contouring them would draw an icing map out of airway
   * geometry. This is the assertion that stops that from being "improved" later.
   */
  it("draws points, never an interpolated field", () => {
    expect(CandidatePirepLayer.geometryType).toBe("point");
  });

  it("renders on the severity rank the server puts on each report", () => {
    expect(CandidatePirepLayer.renderer).toHaveProperty("field", "severity");
  });

  // The collection is empty on a quiet day, and an empty one gives ArcGIS
  // nothing to infer a schema from — the renderer would have no field to match
  // and the band filter nothing to query.
  it("declares its schema so an empty feed still renders", () => {
    const fields = CandidatePirepLayer.fields.map((f) => f.name);

    expect(fields).toContain("severity");
    expect(fields).toContain("inBand");
    expect(CandidatePirepLayer.objectIdField).toBe("OBJECTID");
  });

  // The filed line is the point of clicking a marker: a decoded summary is
  // easier to read, but the operator is deciding whether to trust a
  // confirmation.
  it("shows the raw report in the popup", () => {
    expect(CandidatePirepLayer.popupTemplate?.content).toContain("{raw}");
  });

  // A template cannot skip an absent field, and a negative report usually has
  // no ice type and no temperature — so the popup substitutes the line the
  // server laid out rather than assembling one from fields that may be null.
  it("substitutes a laid-out detail line, not raw nullable fields", () => {
    const content = CandidatePirepLayer.popupTemplate?.content;

    expect(content).toContain("{detail}");
    expect(content).not.toContain("{tempC}");
    expect(content).not.toContain("{iceType}");
  });

  it("starts unfiltered, showing every report", () => {
    expect(CandidatePirepLayer.definitionExpression).toBeFalsy();
  });
});

describe("MRMS radar layer", () => {
  it("reads the mosaic from our server, not from NOAA directly", () => {
    expect(CandidateRadarLayer.url).toBe("/radar/reflectivity");
  });

  it("credits the National Weather Service", () => {
    expect(CandidateRadarLayer.copyright).toBe(
      "NOAA / National Weather Service MRMS"
    );
  });

  it("leaves visibility to the map", () => {
    expect(CandidateRadarLayer.visible).toBe(false);
  });

  it("renders on the property the server frame carries", () => {
    expect(CandidateRadarLayer.renderer).toHaveProperty(
      "field",
      "reflectivity"
    );
  });

  /**
   * Contours, not NOAA's ready-made image service of the same data. An image
   * cannot composite with the liquid-water layer underneath it, and reading
   * cyan against amber is the whole reason this layer is on the candidate map.
   * MRMS samples at 1 km, so a 12 km block average removes structure rather
   * than inventing it — the rule that forbids contouring the PIREPs permits
   * this.
   */
  it("draws a surface, which its sampling density earns", () => {
    expect(CandidateRadarLayer.geometryType).not.toBe("point");
  });

  // A scene, not a forecast: no run and no hour to ask for. A query string here
  // would be split into customParameters rather than staying on the url.
  it("asks for whatever scene is current", () => {
    expect(CandidateRadarLayer.url).not.toContain("?");
    expect(CandidateRadarLayer.customParameters).toBeFalsy();
  });
});
