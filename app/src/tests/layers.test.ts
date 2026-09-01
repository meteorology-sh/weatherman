// ArcGIS
import {
  CandidateFieldLayer,
  ReplayFieldLayer,
  CandidateCloudBaseLayer,
  CandidateCloudTopLayer,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
  CandidateLiquidLayer,
  CandidateRadarLayer,
  CandidateStormCoreLayer,
  CandidateStormMotionLayer,
  CandidateLightningLayer,
} from "@/lib/arcgis/layers";

const BOX = {
  west: "-107",
  east: "-93",
  south: "25.5",
  north: "37",
};

describe("GOES cloud-top layer", () => {
  it("reads the banded scene from our own server, not from GIBS", () => {
    expect(CandidateCloudTopLayer.url).toBe("/cloudtop/temperature");
    expect(CandidateCloudTopLayer.customParameters).toEqual(BOX);
  });

  // The layer this replaced was a raster, and a raster has no nodata. Declaring
  // the schema is what lets a clear scene come back as an empty collection
  // without leaving the renderer with no field to match.
  it("declares its schema, so a cloud-free scene still renders", () => {
    expect(CandidateCloudTopLayer.geometryType).toBe("polygon");
    expect(CandidateCloudTopLayer.fields.map((f) => f.name)).toContain(
      "topColdnessC"
    );
  });

  it("credits both sources, because it is built from two", () => {
    expect(CandidateCloudTopLayer.copyright).toBe("NOAA GOES-East / NOAA HRRR");
  });

  it("leaves visibility to the map, which drives it from the store", () => {
    expect(CandidateCloudTopLayer.visible).toBe(false);
  });
});

describe("HRRR cloud-base layer", () => {
  // Pinned to the analysis hour, like the liquid-water layer: a cloud base is
  // a state the analysis holds, not a flux needing a timestep. ArcGIS splits
  // the query string off into `customParameters`, so the hour is asserted where
  // it lands rather than on the url it was written on.
  it("reads the analysis hour from our own server", () => {
    expect(CandidateCloudBaseLayer.url).toBe("/forecast/cloudbase");
    expect(CandidateCloudBaseLayer.customParameters).toEqual({
      hour: "0",
      ...BOX,
    });
  });

  // The field has real nodata — most of the domain has no cloud — so the
  // collection can come back empty and the renderer still needs a field.
  it("declares its schema, so a cloud-free domain still renders", () => {
    expect(CandidateCloudBaseLayer.geometryType).toBe("polygon");
    expect(CandidateCloudBaseLayer.fields.map((f) => f.name)).toContain(
      "cloudBaseFt"
    );
  });

  // The renderer matches on a field, so it has to be the one the server puts
  // on the feature — and the server bands on the window's lower edge.
  it("renders on the property the server's frame carries", () => {
    expect(CandidateCloudBaseLayer.renderer).toHaveProperty(
      "field",
      "cloudBaseFt"
    );
  });

  it("credits the model it comes from", () => {
    expect(CandidateCloudBaseLayer.copyright).toBe("NOAA HRRR");
  });

  it("leaves visibility to the map, which drives it from the store", () => {
    expect(CandidateCloudBaseLayer.visible).toBe(false);
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
    expect(CandidateLiquidLayer.customParameters).toEqual({
      hour: "0",
      ...BOX,
    });
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
   * MRMS samples at 1 km, so contouring that mosaic removes no structure and
   * invents none — which is what earns this field a surface at all.
   */
  it("draws a surface, which its sampling density earns", () => {
    expect(CandidateRadarLayer.geometryType).not.toBe("point");
  });

  // A scene, not a forecast: no run and no hour to ask for. A query string here
  // would be split into customParameters rather than staying on the url.
  it("asks for the current scene in the window the map can paint", () => {
    expect(CandidateRadarLayer.url).toBe("/radar/reflectivity");
    expect(CandidateRadarLayer.customParameters).toEqual(BOX);
  });
});

describe("CandidateStormCoreLayer", () => {
  it("marks the heaviest rain as a point, not a filled blob", () => {
    expect(CandidateStormCoreLayer.geometryType).toBe("point");
    expect(CandidateStormCoreLayer.url).toBe("/radar/objects/cores");
  });

  it("draws heading as a filled dart from that point", () => {
    expect(CandidateStormMotionLayer.geometryType).toBe("polygon");
    expect(CandidateStormMotionLayer.url).toBe("/radar/objects/motion");
  });

  it("draws lightning as points, not a surface", () => {
    expect(CandidateLightningLayer.geometryType).toBe("point");
    expect(CandidateLightningLayer.url).toBe("/cloudtop/lightning");
  });
});

describe("CandidateFieldLayer", () => {
  it("points at the joined field", () => {
    expect(CandidateFieldLayer.url).toBe("/candidate/field");
    expect(CandidateFieldLayer.customParameters).toEqual(BOX);
  });

  // The renderer matches on this field, and the layer starts empty on a day
  // with no candidates — an empty FeatureCollection gives ArcGIS nothing to
  // infer a schema from, so it has to be declared.
  it("declares the schema its renderer matches on", () => {
    expect(CandidateFieldLayer.geometryType).toBe("polygon");
    expect(CandidateFieldLayer.fields.map((f) => f.name)).toContain(
      "seedableSlwPath"
    );
  });

  it("credits all three sources it joins", () => {
    expect(CandidateFieldLayer.copyright).toMatch(/HRRR/);
    expect(CandidateFieldLayer.copyright).toMatch(/GOES/);
    expect(CandidateFieldLayer.copyright).toMatch(/MRMS/);
  });
});

describe("ReplayFieldLayer", () => {
  // Separate from the live layer for the same reason the other replay layers
  // are: a shared url would leave a past date on the live map.
  it("starts with no url, since the page opens with no date chosen", () => {
    expect(ReplayFieldLayer.url).toBeFalsy();
  });

  it("is a different instance from the live field layer", () => {
    expect(ReplayFieldLayer).not.toBe(CandidateFieldLayer);
  });

  it("declares the same schema, so both draw the same frames", () => {
    expect(ReplayFieldLayer.fields.map((f) => f.name)).toEqual(
      CandidateFieldLayer.fields.map((f) => f.name)
    );
  });
});
