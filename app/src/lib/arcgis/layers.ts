// ArcGIS
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import TileInfo from "@arcgis/core/layers/support/TileInfo";
import { forecastCloudRenderer, forecastPrecipRenderer } from "./renderers";

// Client
import { ForecastCloudsUrl, ForecastPrecipUrl } from "@/lib/client";

// Types
import type { CloudLayerId } from "@/lib/types";

// NASA GIBS serves GOES ABI imagery as RESTful WMTS tiles: no API key, ~2km
// native resolution, new imagery every 10 minutes. "default" in the {Style}
// and {Time} slots resolves to the most recent scene.
// Docs: https://nasa-gibs.github.io/gibs-api-docs/access-basics/
const GIBS = "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best";
const COPYRIGHT = "NASA GIBS / NOAA GOES-East";

function goesUrl(layer: string, matrixSet: string) {
  return `${GIBS}/${layer}/default/default/${matrixSet}/{level}/{row}/{col}.png`;
}

/**
 * GIBS publishes each GOES layer to a fixed maximum zoom (Level7 = LODs 0-7,
 * Level6 = LODs 0-6). Capping tileInfo at that depth stops ArcGIS requesting
 * tiles that do not exist; past the last LOD it stretches the deepest tiles
 * rather than dropping the layer.
 */
function goesTileInfo(numLODs: number) {
  return TileInfo.create({ size: 256, numLODs });
}

// Both layers start hidden; Map.tsx drives visibility from the store so the
// selected layer is decided in exactly one place.
export const GeoColorLayer = new WebTileLayer({
  title: "GOES-East GeoColor",
  urlTemplate: goesUrl("GOES-East_ABI_GeoColor", "GoogleMapsCompatible_Level7"),
  tileInfo: goesTileInfo(8),
  copyright: COPYRIGHT,
  visible: false,
});

export const Band13Layer = new WebTileLayer({
  title: "GOES-East Band 13 (Clean IR)",
  urlTemplate: goesUrl(
    "GOES-East_ABI_Band13_Clean_Infrared",
    "GoogleMapsCompatible_Level6"
  ),
  tileInfo: goesTileInfo(7),
  copyright: COPYRIGHT,
  visible: false,
});

export const GoesLayers: Record<CloudLayerId, WebTileLayer> = {
  geocolor: GeoColorLayer,
  band13: Band13Layer,
};

/**
 * Modelled cloud cover, contoured server-side from HRRR into nested polygons.
 * Vector rather than raster on purpose: GOES cannot forecast, and unlike an
 * infrared image these have true nodata — where the model has no cloud, nothing
 * is drawn and the basemap shows through. Map.tsx repoints `url` as the
 * forecast-hour slider moves.
 */
export const ForecastCloudsLayer = new GeoJSONLayer({
  title: "HRRR forecast cloud cover",
  url: ForecastCloudsUrl(0),
  copyright: "NOAA HRRR",
  renderer: forecastCloudRenderer,
  visible: false,
});

/**
 * Modelled precipitation rate, contoured the same way and drawn over the cloud
 * layer — rain is the more specific signal and covers far less ground, so it
 * belongs on top.
 *
 * `fields` and `geometryType` are declared rather than inferred, because this
 * layer starts empty and stays that way until the slider passes
 * PRECIP_FIRST_HOUR. An empty FeatureCollection gives ArcGIS nothing to infer a
 * schema from, which would leave the renderer with no field to match.
 *
 * It is built on hour 0 for the same reason Map.tsx hides it there: that frame
 * is 123 bytes the server answers from a constant, so the layer costs nothing
 * until the operator asks for a real one. Constructing it on PRECIP_FIRST_HOUR
 * instead would download a frame nobody has asked to see.
 */
export const ForecastPrecipLayer = new GeoJSONLayer({
  title: "HRRR forecast precipitation rate",
  url: ForecastPrecipUrl(0),
  copyright: "NOAA HRRR",
  renderer: forecastPrecipRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "precipRate", type: "double" },
  ],
  visible: false,
});
