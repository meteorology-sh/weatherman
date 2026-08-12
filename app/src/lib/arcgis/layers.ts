// ArcGIS
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import TileInfo from "@arcgis/core/layers/support/TileInfo";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import {
  forecastCloudRenderer,
  forecastPrecipRenderer,
  candidateLiquidRenderer,
  candidateRadarRenderer,
  candidatePirepRenderer,
} from "./renderers";

// Client
import {
  ForecastCloudsUrl,
  ForecastPrecipUrl,
  ForecastLiquidUrl,
  RadarReflectivityUrl,
  IcingPirepsUrl,
} from "@/lib/client";

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

/**
 * Cloud-top brightness temperature, identical day and night.
 *
 * The only GOES rendering we carry. GeoColor was dropped because it answers a
 * question this product does not ask: it is true colour by day and a different
 * IR shading by night, so it looks like a photograph and tells the operator
 * nothing about what is inside the cloud. Band 13 at least reports a
 * temperature, which is one step from the seeding band.
 *
 * Starts hidden; Map.tsx drives visibility from the store so it is decided in
 * exactly one place.
 */
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

/**
 * Supercooled liquid water in the seeding band, integrated from HRRR's analysis
 * and contoured the same way — drawn over Band 13, because the satellite shows
 * the cloud top and this shows what is inside it.
 *
 * Pinned to hour 0: the candidate map is "right now", and for this field the
 * analysis is a real answer rather than an empty one (CLWMR is a state, not a
 * flux). Nothing repoints this url, so unlike the forecast layers it is fetched
 * once per session.
 */
export const CandidateLiquidLayer = new GeoJSONLayer({
  title: "HRRR supercooled liquid water",
  url: ForecastLiquidUrl(0),
  copyright: "NOAA HRRR",
  renderer: candidateLiquidRenderer,
  visible: false,
});

/**
 * Observed reflectivity, contoured server-side from the MRMS national mosaic —
 * the only layer on either map that is measured rather than modelled or
 * reported, and the check on the liquid-water contours it is drawn over. A
 * candidate already raining itself out is one the model still paints amber.
 *
 * Contours rather than NOAA's ready-made `MapImageLayer` of the same data. The
 * image would have been an afternoon's work, but it paints an opaque rectangle
 * over the basemap and cannot be composited with the layer underneath, which is
 * the whole point of drawing this one on top of the liquid water. MRMS samples
 * at 1 km, so contouring a 12 km block average of it removes structure rather
 * than inventing any.
 */
export const CandidateRadarLayer = new GeoJSONLayer({
  title: "MRMS base reflectivity",
  url: RadarReflectivityUrl(),
  copyright: "NOAA / National Weather Service MRMS",
  renderer: candidateRadarRenderer,
  visible: false,
});

/**
 * Icing reports filed by aircraft in the last 12 hours — the only observation of
 * supercooled liquid water available anywhere in this system, and the reason
 * this layer exists despite being a handful of points.
 *
 * Points, and points only. Every other layer here is a field we contoured
 * because its source sampled the country densely enough to justify it; this one
 * is ~20 positive reports over CONUS, hundreds of kilometres apart and
 * concentrated on airways. Interpolating that into a surface would draw an
 * icing map out of where airliners happen to fly. So the colour banding is
 * carried by the marker ramp instead, and each marker stays exactly where an
 * aircraft was.
 *
 * `fields` and `geometryType` are declared rather than inferred for the same
 * reason as the precipitation layer: on a quiet day the collection is empty, and
 * an empty one gives ArcGIS nothing to infer a schema from — which would leave
 * the renderer with no field to match and the band filter with nothing to query.
 */
export const CandidatePirepLayer = new GeoJSONLayer({
  title: "Icing PIREPs (12 h)",
  url: IcingPirepsUrl(),
  copyright: "NOAA Aviation Weather Center",
  renderer: candidatePirepRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "severity", type: "double" },
    { name: "intensity", type: "string" },
    { name: "iceType", type: "string" },
    { name: "flightLevelFt", type: "double" },
    { name: "tempC", type: "double" },
    { name: "inBand", type: "double" },
    { name: "obsTime", type: "string" },
    { name: "obsLabel", type: "string" },
    { name: "aircraft", type: "string" },
    { name: "detail", type: "string" },
    { name: "raw", type: "string" },
  ],
  // The raw report is the payload here. A decoded summary is easier to read, but
  // an operator deciding whether to trust a confirmation wants the line the
  // pilot actually filed.
  //
  // Every substitution is a field the server laid out, `detail` included: a
  // template cannot skip an absent field, and a negative report routinely has no
  // ice type and no temperature.
  popupTemplate: new PopupTemplate({
    title: "{intensity} icing",
    content:
      "<div>{obsLabel}</div>" +
      "<div>{detail}</div>" +
      "<div class='mt-2 font-mono text-xs'>{raw}</div>",
  }),
  visible: false,
});
