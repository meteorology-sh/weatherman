// ArcGIS
import {
  CandidateFieldLayer,
  ReplayFieldLayer,
  CandidateCloudBaseLayer,
  ReplayCloudBaseLayer,
  ForecastCloudsLayer,
  ForecastPrecipLayer,
  ForecastLiquidLayer,
  CandidateLiquidLayer,
  CandidateRadarLayer,
  CandidateStormCoreLayer,
  CandidateStormMotionLayer,
  CandidateLightningLayer,
  CandidateWarningLayer,
  ReplayWarningLayer,
  CandidateEchoFreezeLayer,
  ReplayStormCoreLayer,
  ReplayStormMotionLayer,
  STORM_OBJECT_MIN_SCALE,
  TEXAS_ZOOM,
} from "@/lib/arcgis/layers";

/** Web Mercator's scale at a zoom, the figure the tile pyramid is cut on. */
const scaleAtZoom = (zoom: number) => 591657527.591555 / 2 ** zoom;

const BOX = {
  west: "-107",
  east: "-93",
  south: "25.5",
  north: "37",
};

describe("cloud-base layer", () => {
  // The candidate build, not the forecast ladder: the layer is gated on a
  // measured echo top and an observation cannot be forecast to an hour, so
  // there is no `hour` to send. ArcGIS splits the query string off into
  // `customParameters`, so the box is asserted where it lands rather than on
  // the url it was written on.
  it("reads the analysis scene from our own server", () => {
    expect(CandidateCloudBaseLayer.url).toBe("/candidate/cloudbase");
    expect(CandidateCloudBaseLayer.customParameters).toEqual({ ...BOX });
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

  // Disjoint bands, so exactly one is drawn over a cell and the order they are
  // drawn in decides nothing. Pinning one would say the opposite.
  it("leaves drawing order to the geometry", () => {
    for (const layer of [CandidateCloudBaseLayer, ReplayCloudBaseLayer]) {
      expect(layer.orderBy).toBeFalsy();
    }
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
      ForecastLiquidLayer,
      CandidateLiquidLayer,
    ]) {
      expect(layer.copyright).toBe("NOAA HRRR");
    }
  });

  it("leaves visibility to the map", () => {
    for (const layer of [
      ForecastCloudsLayer,
      ForecastPrecipLayer,
      ForecastLiquidLayer,
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
    expect(ForecastLiquidLayer.renderer).toHaveProperty("field", "slwPath");
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

  // An hour with no in-band liquid anywhere comes back as an empty
  // FeatureCollection, which gives ArcGIS nothing to infer a schema from and
  // would leave the renderer with no field to match.
  it("declares the liquid schema on both instances, so an empty hour renders", () => {
    for (const layer of [CandidateLiquidLayer, ForecastLiquidLayer]) {
      expect(layer.geometryType).toBe("polygon");
      expect(layer.fields.map((f) => f.name)).toContain("slwPath");
    }
  });

  // Its own instance rather than the candidate map's: that one is pinned to
  // the analysis, and repointing it at +12 h would leave a forecast on a map
  // captioned "right now".
  it("gives the forecast map its own liquid layer, on the slider", () => {
    expect(ForecastLiquidLayer).not.toBe(CandidateLiquidLayer);
    expect(ForecastLiquidLayer.url).toBe("/forecast/liquid");
    expect(ForecastLiquidLayer.customParameters).toEqual({
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

  it("draws heading as a line from that point, not a ground-width dart", () => {
    expect(CandidateStormMotionLayer.geometryType).toBe("polyline");
    expect(CandidateStormMotionLayer.customParameters).toEqual({
      shape: "line",
      ...BOX,
    });
  });

  /**
   * A core is one point on one storm and a heading is a tick off it, so both
   * only mean something at a zoom where you can see the storm they belong to.
   * ArcGIS draws a layer while the view's scale is at or under `minScale`, so
   * the check is that Texas whole is over the line and one step in is not.
   */
  it("hides the cores and headings at Texas and wider", () => {
    for (const layer of [
      CandidateStormCoreLayer,
      CandidateStormMotionLayer,
      ReplayStormCoreLayer,
      ReplayStormMotionLayer,
    ]) {
      expect(layer.minScale).toBe(STORM_OBJECT_MIN_SCALE);
      expect(scaleAtZoom(TEXAS_ZOOM)).toBeGreaterThan(layer.minScale);
      expect(scaleAtZoom(TEXAS_ZOOM + 1)).toBeLessThanOrEqual(layer.minScale);
    }
  });

  // The rain itself is a field, readable over the whole state, so it keeps no
  // floor — only the per-storm marks drawn on top of it do.
  it("keeps the mosaic underneath them drawn at every zoom", () => {
    expect(CandidateRadarLayer.minScale).toBe(0);
  });

  it("draws lightning as points, not a surface", () => {
    expect(CandidateLightningLayer.geometryType).toBe("point");
    expect(CandidateLightningLayer.url).toBe("/cloudtop/lightning");
  });

  it("draws echo past freezing as a fill", () => {
    expect(CandidateEchoFreezeLayer.geometryType).toBe("polygon");
    expect(CandidateEchoFreezeLayer.url).toBe("/radar/echotop/past-freezing");
  });
});

describe("CandidateFieldLayer", () => {
  it("points at the Texas fly fill", () => {
    expect(CandidateFieldLayer.url).toBe("/candidate/target");
    expect(CandidateFieldLayer.customParameters).toEqual(BOX);
  });

  it("declares the schema its renderer matches on", () => {
    expect(CandidateFieldLayer.geometryType).toBe("polygon");
    expect(CandidateFieldLayer.fields.map((f) => f.name)).toContain("fly");
  });

  it("credits the sources the Texas tests join", () => {
    expect(CandidateFieldLayer.copyright).toMatch(/HRRR/);
    expect(CandidateFieldLayer.copyright).toMatch(/MRMS/);
    expect(CandidateFieldLayer.copyright).not.toMatch(/GOES/);
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

describe("warning layers", () => {
  it("reads the live warnings from our own server", () => {
    expect(CandidateWarningLayer.url).toBe("/warnings/severe");
    expect(CandidateWarningLayer.geometryType).toBe("polygon");
  });

  // The replay instance is pointed at an hour when one is ready, never at now.
  it("gives the replay instance no url of its own", () => {
    expect(ReplayWarningLayer.url).toBeFalsy();
  });

  // A thin hatch in the warning red, with a thin outline and no fill, so the
  // layers under a warning stay readable between the lines.
  it("draws a thin dark-red hatch with a thin outline", () => {
    for (const layer of [CandidateWarningLayer, ReplayWarningLayer]) {
      const symbol = (
        layer.renderer as unknown as {
          symbol: {
            style: string;
            color: { r: number; g: number; b: number };
            outline: {
              width: number;
              color: { r: number; g: number; b: number };
            };
          };
        }
      ).symbol;
      expect(symbol.style).toBe("forward-diagonal");
      expect([symbol.color.r, symbol.color.g, symbol.color.b]).toEqual([
        115, 14, 9,
      ]);
      expect([
        symbol.outline.color.r,
        symbol.outline.color.g,
        symbol.outline.color.b,
      ]).toEqual([115, 14, 9]);
      expect(symbol.outline.width).toBeLessThanOrEqual(1);
    }
  });

  // Every other layer is halved; a hatch has no fill to halve, and halving
  // its lines would lose them on the dark basemap.
  it("is drawn at full opacity", () => {
    expect(CandidateWarningLayer.opacity).toBe(1);
    expect(ReplayWarningLayer.opacity).toBe(1);
  });
});
