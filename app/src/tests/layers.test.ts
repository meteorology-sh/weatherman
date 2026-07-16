// ArcGIS
import { GoesLayers, GeoColorLayer, Band13Layer } from "@/lib/arcgis/layers";

describe("GOES layers", () => {
  it("exposes one layer per selectable id", () => {
    expect(GoesLayers).toEqual({
      geocolor: GeoColorLayer,
      band13: Band13Layer,
    });
  });

  it("points GeoColor at the GIBS GOES-East GeoColor endpoint", () => {
    expect(GeoColorLayer.urlTemplate).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/GOES-East_ABI_GeoColor" +
        "/default/default/GoogleMapsCompatible_Level7/{level}/{row}/{col}.png"
    );
  });

  it("points Band13 at the GIBS GOES-East Clean Infrared endpoint", () => {
    expect(Band13Layer.urlTemplate).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/" +
        "GOES-East_ABI_Band13_Clean_Infrared" +
        "/default/default/GoogleMapsCompatible_Level6/{level}/{row}/{col}.png"
    );
  });

  // GIBS publishes GeoColor to zoom 7 and Band13 only to zoom 6. Requesting a
  // deeper tile 404s, so each layer's LODs must stop where its matrix set does.
  it("caps GeoColor at the zoom level GIBS publishes (7)", () => {
    const levels = GeoColorLayer.tileInfo.lods.map((lod) => lod.level);

    expect(Math.max(...levels)).toBe(7);
  });

  it("caps Band13 at the zoom level GIBS publishes (6)", () => {
    const levels = Band13Layer.tileInfo.lods.map((lod) => lod.level);

    expect(Math.max(...levels)).toBe(6);
  });

  // GIBS serves these from its epsg3857 endpoint, so the tiling scheme has to
  // be Web Mercator or the imagery lands in the wrong place.
  it("tiles both layers in Web Mercator to match the basemap", () => {
    expect(GeoColorLayer.tileInfo.spatialReference.isWebMercator).toBe(true);
    expect(Band13Layer.tileInfo.spatialReference.isWebMercator).toBe(true);
  });

  it("credits NASA GIBS and NOAA on every layer", () => {
    for (const layer of Object.values(GoesLayers)) {
      expect(layer.copyright).toBe("NASA GIBS / NOAA GOES-East");
    }
  });

  it("leaves visibility to the map, which drives it from the store", () => {
    for (const layer of Object.values(GoesLayers)) {
      expect(layer.visible).toBe(false);
    }
  });
});
