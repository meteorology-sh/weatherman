// ArcGIS
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import {
  candidateConfirmedRenderer,
  candidateFieldRenderer,
  forecastCloudRenderer,
  forecastPrecipRenderer,
  baseWindowRenderer,
  candidateCloudBaseRenderer,
  candidateCloudTopRenderer,
  candidateLiquidRenderer,
  candidateRadarRenderer,
  capeRenderer,
  cinRenderer,
  echoFreezeRenderer,
  freezingRenderer,
  lclRenderer,
  lightningRenderer,
  minus15Renderer,
  warmDepthRenderer,
  stormCoreRenderer,
  stormFlankRenderer,
  stormMotionRenderer,
} from "./renderers";

// Client
import {
  CandidateConfirmedUrl,
  CandidateFieldUrl,
  CloudTopUrl,
  ForecastCloudsUrl,
  ForecastBriefingUrl,
  ForecastCloudBaseUrl,
  ForecastCloudBaseWindowUrl,
  ForecastPrecipUrl,
  ForecastLiquidUrl,
  RadarReflectivityUrl,
  RadarStormCoresUrl,
  RadarStormFlanksUrl,
  RadarStormMotionUrl,
  RadarEchoFreezeUrl,
  LightningUrl,
} from "@/lib/client";

/**
 * The replay map's layers.
 *
 * Separate instances rather than repointing the live ones, and that is not
 * duplication for its own sake. Every layer here is added to the map once and
 * toggled with `.visible` so switching routes does not refetch — which only
 * holds if a layer's `url` means one thing. Pointing `CandidateRadarLayer` at a
 * date would make the candidate map show 2025 the next time it was opened, and
 * the bug would look like a caching failure rather than a shared object.
 *
 * They start with no `url`: the page opens with no date chosen, and a layer
 * built against "now" would fetch a frame nobody asked for. `Map.tsx` points
 * them once a date is picked.
 *
 * `fields` and `geometryType` are declared for the same reason the precipitation
 * layer declares them — these start empty, and an empty FeatureCollection gives
 * ArcGIS nothing to infer a schema from.
 */
export const ReplayCloudTopLayer = new GeoJSONLayer({
  title: "GOES-East cloud-top temperature (replay)",
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

export const ReplayCloudBaseLayer = new GeoJSONLayer({
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

export const ReplayCloudBaseWindowLayer = new GeoJSONLayer({
  title: "HRRR cloud base window (replay)",
  copyright: "NOAA HRRR",
  renderer: baseWindowRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "inWindow", type: "double" },
  ],
  visible: false,
});

export const ReplayLiquidLayer = new GeoJSONLayer({
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

export const ReplayStormCoreLayer = new GeoJSONLayer({
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
  visible: false,
});

export const ReplayStormMotionLayer = new GeoJSONLayer({
  title: "MRMS radar storm motion (replay)",
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormMotionRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "motionTowardDeg", type: "double" },
    { name: "motionKmh", type: "double" },
  ],
  visible: false,
});

export const ReplayStormFlankLayer = new GeoJSONLayer({
  title: "MRMS radar storm flanks (replay)",
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormFlankRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "maxDbz", type: "double" },
  ],
  visible: false,
});

export const ReplayLightningLayer = new GeoJSONLayer({
  title: "GOES-East GLM flashes (replay)",
  copyright: "NOAA GOES-East GLM",
  renderer: lightningRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: [{ name: "OBJECTID", type: "oid" }],
  visible: false,
});

export const ReplayCapeLayer = new GeoJSONLayer({
  title: "HRRR mixed-layer CAPE (replay)",
  copyright: "NOAA HRRR",
  renderer: capeRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "mixedCapeJKg", type: "double" },
  ],
  visible: false,
});

export const ReplayCinLayer = new GeoJSONLayer({
  title: "HRRR mixed-layer CIN (replay)",
  copyright: "NOAA HRRR",
  renderer: cinRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "cinJKg", type: "double" },
  ],
  visible: false,
});

export const ReplayLclLayer = new GeoJSONLayer({
  title: "HRRR lifting condensation level (replay)",
  copyright: "NOAA HRRR",
  renderer: lclRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "lclFt", type: "double" },
  ],
  visible: false,
});

export const ReplayFreezingLayer = new GeoJSONLayer({
  title: "HRRR freezing level (replay)",
  copyright: "NOAA HRRR",
  renderer: freezingRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "freezingFt", type: "double" },
  ],
  visible: false,
});

export const ReplayMinus15Layer = new GeoJSONLayer({
  title: "HRRR −15 °C height (replay)",
  copyright: "NOAA HRRR",
  renderer: minus15Renderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "minus15Ft", type: "double" },
  ],
  visible: false,
});

export const ReplayWarmDepthLayer = new GeoJSONLayer({
  title: "HRRR warm-cloud depth (replay)",
  copyright: "NOAA HRRR",
  renderer: warmDepthRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "warmCloudDepthFt", type: "double" },
  ],
  visible: false,
});

export const ReplayEchoFreezeLayer = new GeoJSONLayer({
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
 * Texas fly: base in the Comptroller window, 18 dBZ echo top past
 * freezing nearby, rain nearby. One fill. The same cells a click
 * names FLY.
 */
export const CandidateFieldLayer = new GeoJSONLayer({
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

/** The same field at a replayed hour. See ReplayCloudTopLayer for why separate. */
export const ReplayFieldLayer = new GeoJSONLayer({
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
 * Observed cloud tops, banded server-side from a GOES-East scene.
 *
 * **Vector, not imagery**, for the reason the rest of these layers are vectors:
 * an infrared image has no nodata. It paints warm clear sky opaquely and buries
 * the basemap, so a map whose whole job is "where is there something worth
 * flying to" spends most of its pixels on sky where there is nothing at all.
 * These bands are simply not drawn where the satellite sees no cloud — roughly
 * half a scene — and the basemap shows through.
 *
 * It is also filtered. Only tops colder than −5 °C appear: a warmer top means
 * the seeding band lies above the cloud entirely, so there is nothing inside it
 * to seed. That removes most cloudy ground.
 *
 * The geometry comes from the satellite and the temperatures from HRRR's
 * profile — see the server's `goes/cloudtop.ts` for why that split runs the way it
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
 * Modelled cloud base, banded server-side from HRRR — the height an aircraft
 * would climb through, and the variable Texas operations actually select on.
 *
 * **Disjoint bands, not nested contours**, because the field is a window rather
 * than a magnitude: below it the base is fog, above it the base is cirrus, and
 * the middle band is the one worth looking at. It has the same real nodata the
 * cloud-top layer has — where the model has no cloud over a cell, nothing is
 * drawn.
 *
 * Pinned to hour 0, like the liquid-water layer and for the same reason: the
 * candidate map is "right now", and a cloud base is a state the analysis holds
 * rather than a flux needing a timestep. Nothing repoints this url.
 */
export const CandidateCloudBaseLayer = new GeoJSONLayer({
  title: "HRRR cloud base",
  url: ForecastCloudBaseUrl(0),
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
 * Comptroller window, AGL. A picture of the gate, not a mask.
 * Drawn over the rain, like echo past freezing, so the switch
 * is visible on the storm. Pinned to hour 0 like the height ramp.
 */
export const CandidateCloudBaseWindowLayer = new GeoJSONLayer({
  title: "HRRR cloud base window",
  url: ForecastCloudBaseWindowUrl(0),
  copyright: "NOAA HRRR",
  renderer: baseWindowRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "inWindow", type: "double" },
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
 * the only layer on either map that is measured rather than modelled, and the
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
  visible: false,
});

/**
 * Heading of each storm, from the heaviest-rain cell. Empty when the
 * previous mosaic gave no direction. Not a forecast of where the storm
 * will be.
 */
export const CandidateStormMotionLayer = new GeoJSONLayer({
  title: "MRMS radar storm motion",
  url: RadarStormMotionUrl(),
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormMotionRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "motionTowardDeg", type: "double" },
    { name: "motionKmh", type: "double" },
  ],
  visible: false,
});

/**
 * Raining cells on the upwind edge of each storm. Empty when the
 * previous mosaic gave no direction. Not inflow.
 */
export const CandidateStormFlankLayer = new GeoJSONLayer({
  title: "MRMS radar storm flanks",
  url: RadarStormFlanksUrl(),
  copyright: "NOAA / National Weather Service MRMS",
  renderer: stormFlankRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "stormId", type: "integer" },
    { name: "maxDbz", type: "double" },
  ],
  visible: false,
});

/**
 * GLM flashes in the last five minutes. Points only. The lightning
 * switch under radar drives this with the mosaic.
 */
export const CandidateLightningLayer = new GeoJSONLayer({
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
 * Mixed-layer CAPE. The 12Z table's energy row, as a fill.
 */
export const CandidateCapeLayer = new GeoJSONLayer({
  title: "HRRR mixed-layer CAPE",
  url: ForecastBriefingUrl("cape", 0),
  copyright: "NOAA HRRR",
  renderer: capeRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "mixedCapeJKg", type: "double" },
  ],
  visible: false,
});

export const CandidateCinLayer = new GeoJSONLayer({
  title: "HRRR mixed-layer CIN",
  url: ForecastBriefingUrl("cin", 0),
  copyright: "NOAA HRRR",
  renderer: cinRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "cinJKg", type: "double" },
  ],
  visible: false,
});

export const CandidateLclLayer = new GeoJSONLayer({
  title: "HRRR lifting condensation level",
  url: ForecastBriefingUrl("lcl", 0),
  copyright: "NOAA HRRR",
  renderer: lclRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "lclFt", type: "double" },
  ],
  visible: false,
});

export const CandidateFreezingLayer = new GeoJSONLayer({
  title: "HRRR freezing level",
  url: ForecastBriefingUrl("freezing", 0),
  copyright: "NOAA HRRR",
  renderer: freezingRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "freezingFt", type: "double" },
  ],
  visible: false,
});

export const CandidateMinus15Layer = new GeoJSONLayer({
  title: "HRRR −15 °C height",
  url: ForecastBriefingUrl("minus15", 0),
  copyright: "NOAA HRRR",
  renderer: minus15Renderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "minus15Ft", type: "double" },
  ],
  visible: false,
});

export const CandidateWarmDepthLayer = new GeoJSONLayer({
  title: "HRRR warm-cloud depth",
  url: ForecastBriefingUrl("warm-depth", 0),
  copyright: "NOAA HRRR",
  renderer: warmDepthRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "warmCloudDepthFt", type: "double" },
  ],
  visible: false,
});

/**
 * 18 dBZ top at or above freezing. The switch under radar drives this
 * with the mosaic.
 */
export const CandidateEchoFreezeLayer = new GeoJSONLayer({
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


