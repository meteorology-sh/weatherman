/**
 * The eval map's layers.
 *
 * **Every weather layer here is the app's own.** The url builders and the
 * renderers are imported from `/app` rather than rewritten, so a band drawn
 * amber on this page is amber for the same reason and at the same threshold it
 * is on the candidate map. A tool built to show where we disagree with an
 * operator must not introduce a disagreement of its own between itself and the
 * thing it is inspecting.
 *
 * Two layers are this page's own, because they are not weather: the flare
 * releases and the county outlines.
 */

// ArcGIS
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

// App — the layers under test, drawn exactly as the app draws them
import {
  candidateCloudBaseRenderer,
  candidateCloudTopRenderer,
  candidateFieldRenderer,
  candidateLiquidRenderer,
  candidateRadarRenderer,
} from "@/lib/arcgis/renderers";
import {
  ReplayCandidateUrl,
  ReplayCloudBaseUrl,
  ReplayCloudTopUrl,
  ReplayLiquidUrl,
  ReplayRadarUrl,
} from "@/lib/client";

// Client — this page's own
import { CountiesUrl } from "./client";

/**
 * What a flare was, as a marker.
 *
 * This is the sparse-point shape: one marker where the observation was, discrete
 * classes, nothing interpolated between them. There is no contour to trace —
 * a flare is a point in space and a minute in time, and drawing it as anything
 * else would invent coverage the record does not claim.
 *
 * **Classified by payload, not by our verdict.** The payload says which layer
 * the crew was betting on — glaciogenic seeds supercooled liquid in the seeding
 * band, hygroscopic works the cloud base — so the marker states the operator's
 * intent and the fills underneath state ours. Painting the marker with our own
 * answer would put our conclusion on the map twice and leave nothing to compare.
 */
const marker = (rgb: number[]) =>
  new SimpleMarkerSymbol({
    style: "circle",
    size: 11,
    color: [...rgb, 0.95],
    outline: { color: [10, 10, 10, 1], width: 1.5 },
  });

export const releaseRenderer = new UniqueValueRenderer({
  field: "payload",
  uniqueValueInfos: [
    // Silver iodide, aimed at supercooled liquid — cold white.
    { value: "glaciogenic", symbol: marker([235, 245, 255]) },
    // Salt, aimed at the warm cloud base — warm orange.
    { value: "hygroscopic", symbol: marker([255, 150, 40]) },
    { value: "both", symbol: marker([235, 90, 235]) },
  ],
});

/**
 * The counties the aircraft are permitted to work.
 *
 * An outline with no fill: this is the boundary of the programme, not a
 * measurement, and a fill would composite with the layers it sits over and
 * change what they look like.
 */
export const countyRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    outline: { color: [120, 140, 160, 0.8], width: 1 },
  }),
});

const RELEASE_FIELDS = [
  { name: "OBJECTID", type: "oid" as const },
  { name: "at", type: "string" as const },
  { name: "timeZ", type: "string" as const },
  { name: "plane", type: "string" as const },
  { name: "county", type: "string" as const },
  { name: "payload", type: "string" as const },
  { name: "glaciogenic", type: "integer" as const },
  { name: "hygroscopic", type: "integer" as const },
  { name: "verdict", type: "string" as const },
  { name: "slwGM2", type: "double" as const },
  { name: "cloudBaseFt", type: "double" as const },
  { name: "cloudTopC", type: "double" as const },
  { name: "topPhase", type: "string" as const },
  { name: "dbz", type: "double" as const },
];

export const ReleaseLayer = new GeoJSONLayer({
  title: "Flare releases",
  copyright: "West Texas Weather Modification Association",
  renderer: releaseRenderer,
  geometryType: "point",
  objectIdField: "OBJECTID",
  fields: RELEASE_FIELDS,
  // Off until a day is picked. A GeoJSONLayer with no url has nothing to load,
  // and a visible layer with nothing in it reads as a day with no flights.
  visible: false,
});

/**
 * The counties the aircraft are permitted to work.
 *
 * The only layer here with a url at construction: the boundaries are the same
 * whichever day is being looked at, so nothing ever repoints it.
 */
export const CountyLayer = new GeoJSONLayer({
  title: "Target counties",
  url: CountiesUrl(),
  copyright: "US Census TIGERweb",
  renderer: countyRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "BASENAME", type: "string" },
    { name: "GEOID", type: "string" },
  ],
  visible: true,
});

/**
 * The weather under the flares, one layer per input the join reads.
 *
 * They start with no url for the same reason the app's replay layers do: the
 * page opens with no day chosen, and a layer built against "now" would fetch a
 * frame nobody asked for. `url` is the only thing that moves as the cursor
 * moves — the renderer never does.
 */
export const LIQUID = new GeoJSONLayer({
  title: "Supercooled liquid water",
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

export const CLOUD_BASE = new GeoJSONLayer({
  title: "Cloud base",
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

export const CLOUD_TOP = new GeoJSONLayer({
  title: "Cloud-top temperature",
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

export const RADAR = new GeoJSONLayer({
  title: "Base reflectivity",
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

export const FIELD = new GeoJSONLayer({
  title: "Seeding opportunity",
  copyright: "NOAA HRRR / NOAA GOES-East / NOAA MRMS",
  renderer: candidateFieldRenderer,
  geometryType: "polygon",
  objectIdField: "OBJECTID",
  fields: [
    { name: "OBJECTID", type: "oid" },
    { name: "seedableSlwPath", type: "double" },
  ],
  visible: false,
});

/**
 * Which layers exist, in draw order, and how each is pointed at a moment.
 *
 * Bottom to top: the cloud the satellite sees, then the model's base and
 * liquid inside it, then the radar over all of it, then the join. Same stacking
 * the candidate map uses, so the composite reads the same way.
 */
export const WEATHER = [
  {
    key: "cloudTop",
    label: "CLOUD TOP",
    layer: CLOUD_TOP,
    url: ReplayCloudTopUrl,
  },
  {
    key: "cloudBase",
    label: "CLOUD BASE",
    layer: CLOUD_BASE,
    url: ReplayCloudBaseUrl,
  },
  { key: "liquid", label: "LIQUID WATER", layer: LIQUID, url: ReplayLiquidUrl },
  { key: "radar", label: "REFLECTIVITY", layer: RADAR, url: ReplayRadarUrl },
  { key: "field", label: "OPPORTUNITY", layer: FIELD, url: ReplayCandidateUrl },
] as const;

export type LayerKey = (typeof WEATHER)[number]["key"];
