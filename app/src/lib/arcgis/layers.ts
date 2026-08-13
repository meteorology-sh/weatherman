// ArcGIS
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import PopupTemplate from "@arcgis/core/PopupTemplate";
import {
  forecastCloudRenderer,
  forecastPrecipRenderer,
  candidateCloudTopRenderer,
  candidateLiquidRenderer,
  candidateRadarRenderer,
  candidatePirepRenderer,
} from "./renderers";

// Client
import {
  CloudTopUrl,
  ForecastCloudsUrl,
  ForecastPrecipUrl,
  ForecastLiquidUrl,
  RadarReflectivityUrl,
  IcingPirepsUrl,
} from "@/lib/client";

/**
 * Observed cloud tops, banded server-side from a GOES-East scene.
 *
 * **This replaced the last raster on either map**, and the reason is the reason
 * the rest of these layers are vectors: an infrared image has no nodata. Band
 * 13 painted warm clear sky opaquely and buried the basemap under it, so a map
 * whose whole job is "where is there something worth flying to" spent most of
 * its pixels on sky where there is nothing at all. These bands are simply not
 * drawn where the satellite sees no cloud — **[verified] about half a scene** —
 * and the basemap shows through.
 *
 * It is also filtered rather than merely redrawn. Only tops colder than −5 °C
 * appear, which is criterion C2: a warmer top means the seeding band lies above
 * the cloud entirely, so there is nothing inside it to seed. That is
 * **[verified] 71% of all cloudy ground over a Texas year**, removed.
 *
 * The geometry comes from the satellite and the temperatures from HRRR's
 * profile — see the server's `cloudtop.ts` for why that split runs the way it
 * does. `fields` and `geometryType` are declared rather than inferred for the
 * same reason as the precipitation layer: on a clear scene the collection is
 * empty, and an empty one gives ArcGIS nothing to infer a schema from.
 */
export const CandidateCloudTopLayer = new GeoJSONLayer({
  title: "GOES-East cloud-top temperature",
  url: CloudTopUrl(),
  copyright: "NOAA GOES-East / NOAA HRRR",
  renderer: candidateCloudTopRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "topColdnessC", type: "double" },
  ],
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
