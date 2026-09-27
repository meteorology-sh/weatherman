// ArcGIS
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import {
  candidateConfirmedRenderer,
  candidateFieldRenderer,
  forecastCloudRenderer,
  forecastPrecipRenderer,
  candidateCloudBaseRenderer,
  candidateLiquidRenderer,
  candidateRadarRenderer,
  echoFreezeRenderer,
  lightningRenderer,
  stormCoreRenderer,
  stormMotionRenderer,
  warningRenderer,
} from "./renderers";
import { LAYER_OPACITY } from "./bands";

// Client
import {
  CandidateConfirmedUrl,
  CandidateFieldUrl,
  ForecastCloudsUrl,
  CloudBaseUrl,
  ForecastPrecipUrl,
  ForecastLiquidUrl,
  RadarReflectivityUrl,
  RadarStormCoresUrl,
  RadarStormMotionUrl,
  RadarEchoFreezeUrl,
  LightningUrl,
  WarningsUrl,
} from "@/lib/client";

/**
 * **A change to this module reloads the page.** Every layer below is one live
 * ArcGIS object, and `Map.tsx` builds its map around them once. A hot update
 * re-runs this module and mints layers the map has never seen, so every switch
 * and url after it lands on objects that are not drawn. `renderers.ts` and
 * `bands.ts` reach the map through here, so an edit to either reloads too.
 */
if (import.meta.hot) {
  import.meta.hot.accept(() => location.reload());
}


export const ReplayCloudBaseLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "HRRR cloud base (replay)",
  copyright: "NOAA HRRR",
  renderer: candidateCloudBaseRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "cloudBaseFt", type: "double" },
  ],
  visible: false,
});

export const ReplayLiquidLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "HRRR supercooled liquid water (replay)",
  copyright: "NOAA HRRR",
  renderer: candidateLiquidRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "slwPath", type: "double" },
  ],
  visible: false,
});

export const ReplayRadarLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS base reflectivity (replay)",
  copyright: "NOAA / National Weather Service MRMS",
  renderer: candidateRadarRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "reflectivity", type: "double" },
  ],
  visible: false,
});

/**
 * Web Mercator's scale at a zoom level — the tile pyramid's own figure,
 * halving each step in.
 */
const scaleAtZoom = (zoom: number) => 591657527.591555 / 2 ** zoom;

/**
 * The zoom at which the map opens: Texas, whole, in the window.
 */
export const TEXAS_ZOOM = 5;

/**
 * Closest the storm objects may be drawn from. ArcGIS draws a layer while
 * the view's scale is at or under `minScale`, so this is the scale one step
 * in from Texas: the cores and headings appear at zoom 6 and are gone at
 * zoom 5 and anything wider.
 *
 * They are per-storm marks, not a field. Over the whole state a core is a
 * speck on a speck and every heading points at the same weather, so the two
 * layers read as noise over the rain rather than as a reading of it. The
 * switch stays where it is and the map turns them off for you.
 */
export const STORM_OBJECT_MIN_SCALE = scaleAtZoom(TEXAS_ZOOM + 1);

export const ReplayStormCoreLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS radar storm cores (replay)",
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormCoreRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "maxDbz", type: "double" },
  ],
  minScale: STORM_OBJECT_MIN_SCALE,
  visible: false,
});

export const ReplayStormMotionLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS radar storm motion (replay)",
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormMotionRenderer,
  geometryType: "polyline",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "motionTowardDeg", type: "double" },
    { name: "motionKmh", type: "double" },
  ],
  minScale: STORM_OBJECT_MIN_SCALE,
  visible: false,
});

export const ReplayLightningLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "GOES-East GLM flashes (replay)",
  copyright: "NOAA GOES-East GLM",
  renderer: lightningRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: [{ name: "OBJECTID", type: "oid" }],
  visible: false,
});

export const ReplayEchoFreezeLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS echo top past freezing (replay)",
  copyright: "NOAA MRMS / NOAA HRRR",
  renderer: echoFreezeRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "pastFreezing", type: "double" },
  ],
  visible: false,
});

/**
 * Texas fly: base low enough to seed, 18 dBZ echo top past freezing
 * nearby, rain nearby. One fill. The same cells a click names FLY.
 */
export const CandidateFieldLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "Seeding opportunity",
  url: CandidateFieldUrl(),
  copyright: "NOAA HRRR / NOAA MRMS",
  renderer: candidateFieldRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "fly", type: "double" },
  ],
  visible: false,
});

/**
 * The outline around the part of that field the satellite still sees liquid at
 * the top of.
 *
 * **An annotation on the field, not a filter of it.** Both are drawn, and the
 * ground outside the outline is still a candidate — the satellite sees the top
 * of the cloud and the seeding band is inside it, so a frozen top is evidence
 * about a candidate rather than a verdict on one. Under an anvil it is not even
 * evidence about the same cloud.
 *
 * Its own layer rather than a symbol on the field, because a contour polygon
 * spans many 3 km cells and confirmation is per cell: one polygon routinely
 * covers both, so the distinction has to be traced separately to fall where it
 * actually falls. Added above the field so the line sits on top of the fills.
 */
export const CandidateConfirmedLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "Seeding opportunity — observed liquid top",
  url: CandidateConfirmedUrl(),
  copyright: "NOAA GOES-East",
  renderer: candidateConfirmedRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "seedableSlwPath", type: "double" },
  ],
  visible: false,
});

/** The same field at a replayed hour, as its own instance. */
export const ReplayFieldLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "Seeding opportunity (replay)",
  copyright: "NOAA HRRR / NOAA MRMS",
  renderer: candidateFieldRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "fly", type: "double" },
  ],
  visible: false,
});

/** The same outline at a replayed hour. */
export const ReplayConfirmedLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "Seeding opportunity — observed liquid top (replay)",
  copyright: "NOAA GOES-East",
  renderer: candidateConfirmedRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "seedableSlwPath", type: "double" },
  ],
  visible: false,
});

/**
 * Modeled cloud base, banded server-side from HRRR — the height an aircraft
 * would climb through, and the variable Texas operations actually select on.
 *
 * **Disjoint bands, not nested contours**, because the fill is one you can see
 * through: two translucent bands over each other would composite into a shade
 * the ramp does not have, so exactly one is drawn over any cell and the draw
 * order carries nothing. It has the same real nodata the cloud-top layer has —
 * where the model has no cloud over a cell, nothing is drawn.
 *
 * Pinned to hour 0, like the liquid-water layer and for the same reason: the
 * candidate map is "right now", and a cloud base is a state the analysis holds
 * rather than a flux needing a timestep. Nothing repoints this url.
 */
export const CandidateCloudBaseLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "HRRR cloud base",
  url: CloudBaseUrl(),
  copyright: "NOAA HRRR",
  renderer: candidateCloudBaseRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "cloudBaseFt", type: "double" },
  ],
  visible: false,
});

/**
 * Modeled cloud cover, contoured server-side from HRRR into nested polygons.
 * Vector rather than raster on purpose: GOES cannot forecast, and unlike an
 * infrared image these have true nodata — where the model has no cloud, nothing
 * is drawn and the basemap shows through. Map.tsx repoints `url` as the
 * forecast-hour slider moves.
 */
export const ForecastCloudsLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "HRRR forecast cloud cover",
  url: ForecastCloudsUrl(0),
  copyright: "NOAA HRRR",
  renderer: forecastCloudRenderer,
  visible: false,
});

/**
 * Modeled precipitation rate, contoured the same way and drawn over the cloud
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
  opacity: LAYER_OPACITY,
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
  opacity: LAYER_OPACITY,
  title: "HRRR supercooled liquid water",
  url: ForecastLiquidUrl(0),
  copyright: "NOAA HRRR",
  renderer: candidateLiquidRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "slwPath", type: "double" },
  ],
  visible: false,
});

/**
 * The same field on the forecast map, following the hour slider.
 *
 * Its own instance rather than the candidate map's, for the reason every pair
 * here is split: that one is pinned to the analysis, and repointing it at +12 h
 * would leave a forecast on a map captioned "right now".
 *
 * `fields` and `geometryType` are declared rather than inferred, like the
 * precipitation layer's and for the same reason — an hour with no in-band
 * liquid anywhere comes back as an empty FeatureCollection, which gives ArcGIS
 * no schema to infer and leaves the renderer with no field to match.
 */
export const ForecastLiquidLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "HRRR forecast supercooled liquid water",
  url: ForecastLiquidUrl(0),
  copyright: "NOAA HRRR",
  renderer: candidateLiquidRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "slwPath", type: "double" },
  ],
  visible: false,
});

/**
 * Observed reflectivity, contoured server-side from the MRMS national mosaic —
 * the only layer on either map that is measured rather than modeled, and the
 * check on the liquid-water contours it is drawn over. A candidate already
 * raining itself out is one the model still paints amber.
 *
 * Contours rather than NOAA's ready-made `MapImageLayer` of the same data. The
 * image would have been an afternoon's work, but it paints an opaque rectangle
 * over the basemap and cannot be composited with the layer underneath, which is
 * the whole point of drawing this one on top of the liquid water. MRMS samples
 * at 1 km, so contouring that mosaic removes no structure and invents none.
 */
export const CandidateRadarLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS base reflectivity",
  url: RadarReflectivityUrl(),
  copyright: "NOAA / National Weather Service MRMS",
  renderer: candidateRadarRenderer,
  visible: false,
});

/**
 * The strongest cell in each contiguous ≥20 dBZ storm. The heading
 * switch under radar drives this with the heading tick.
 */
export const CandidateStormCoreLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS radar storm cores",
  url: RadarStormCoresUrl(),
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormCoreRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "maxDbz", type: "double" },
  ],
  minScale: STORM_OBJECT_MIN_SCALE,
  visible: false,
});

/**
 * Heading of each storm, from the heaviest-rain cell. Empty when the
 * previous mosaic gave no direction. Not a forecast of where the storm
 * will be.
 */
export const CandidateStormMotionLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS radar storm motion",
  url: RadarStormMotionUrl(),
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormMotionRenderer,
  geometryType: "polyline",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "motionTowardDeg", type: "double" },
    { name: "motionKmh", type: "double" },
  ],
  minScale: STORM_OBJECT_MIN_SCALE,
  visible: false,
});

/**
 * GLM flashes in the last five minutes. Points only. The lightning
 * switch under radar drives this with the mosaic.
 */
export const CandidateLightningLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "GOES-East GLM flashes",
  url: LightningUrl(),
  copyright: "NOAA GOES-East GLM",
  renderer: lightningRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: [{ name: "OBJECTID", type: "oid" }],
  visible: false,
});

/**
 * 18 dBZ top at or above freezing. The switch under radar drives this
 * with the mosaic.
 */
export const CandidateEchoFreezeLayer = new GeoJSONLayer({
  opacity: LAYER_OPACITY,
  title: "MRMS echo top past freezing",
  url: RadarEchoFreezeUrl(),
  copyright: "NOAA MRMS / NOAA HRRR",
  renderer: echoFreezeRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "pastFreezing", type: "double" },
  ],
  visible: false,
});

const warningFields = [
  { name: "OBJECTID", type: "oid" as const },
  { name: "phenomenon", type: "string" as const },
  { name: "event", type: "string" as const },
  { name: "office", type: "string" as const },
  { name: "eventId", type: "integer" as const },
  { name: "begins", type: "string" as const },
  { name: "ends", type: "string" as const },
];

/**
 * NWS severe thunderstorm and tornado warnings in force, drawn over every
 * other layer.
 *
 * Full opacity rather than LAYER_OPACITY: the symbol is a thin hatch with no
 * fill, so the ground under it already shows, and halving a dark red over a
 * dark basemap would lose the lines.
 */
export const CandidateWarningLayer = new GeoJSONLayer({
  title: "NWS severe storm warnings",
  url: WarningsUrl(),
  copyright: "NOAA / National Weather Service via Iowa Environmental Mesonet",
  renderer: warningRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: warningFields,
  visible: false,
});

export const ReplayWarningLayer = new GeoJSONLayer({
  title: "NWS severe storm warnings (replay)",
  copyright: "NOAA / National Weather Service via Iowa Environmental Mesonet",
  renderer: warningRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: warningFields,
  visible: false,
});
