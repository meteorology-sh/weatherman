// ArcGIS
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

/**
 * One contour level and the fill painted for it. The server emits one nested
 * MultiPolygon per level, so they stack: an area meeting the top level is
 * painted by every band, an area meeting only the first by one. Keeping each
 * fill faint lets the stacking do the shading and keeps the basemap readable
 * underneath, which is the whole reason these are vectors rather than a raster.
 */
type Band = { readonly value: number; readonly alpha: number };

/**
 * Cloud-cover isopleths, percent. Must stay in step with FIELDS.clouds.levels in
 * server/src/lib/services/forecast.ts — the server decides which contours exist
 * and this decides how they are painted. Overcast tops out near 47% opacity,
 * not 100%.
 *
 * There is deliberately no 10% band: on a normal day ~65% of the country has
 * at least 10% cloud, so drawing it veils the map for no information.
 */
export const CLOUD_BANDS: readonly Band[] = [
  { value: 30, alpha: 0.1 },
  { value: 50, alpha: 0.13 },
  { value: 70, alpha: 0.16 },
  { value: 90, alpha: 0.2 },
];

/**
 * Precipitation-rate isopleths, mm/hr, mirroring FIELDS.precip.levels. The NWS
 * intensity classes: trace, light, moderate, heavy.
 *
 * These run more opaque than the cloud bands and it is still the same strategy.
 * Rain covers ~2% of the country against cloud's ~65%, so the veiling risk that
 * caps the cloud ramp does not apply — and where it is raining is the strongest
 * "do not seed here" signal on the map. Heavy rain tops out near 60% opacity,
 * so the basemap still reads through the worst cell on the map.
 */
export const PRECIP_BANDS: readonly Band[] = [
  { value: 0.1, alpha: 0.15 },
  { value: 0.5, alpha: 0.18 },
  { value: 2.5, alpha: 0.22 },
  { value: 7.6, alpha: 0.26 },
];

/**
 * The seeding band, mirroring SEEDING in server/src/lib/services/forecast.ts.
 *
 * Every caption, legend bracket and readout that names the band reads it from
 * here. It was −5 to −12 °C until 2026-08-12; widening it meant touching eight
 * hardcoded strings, which is how it came to live in one place.
 *
 * −5 °C is a physical threshold (AgI barely nucleates ice above it). −18 °C is
 * a judgement about where supercooled liquid stops being worth looking for —
 * see the server's note for what that choice trades.
 */
export const BAND_WARMEST_C = -5;
export const BAND_COLDEST_C = -18;

/** The band in the app's own typography, e.g. "−5 to −18 °C". */
export const BAND_LABEL = `${BAND_WARMEST_C} to ${BAND_COLDEST_C} °C`.replace(
  /-/g,
  "−"
);

/**
 * Supercooled liquid water path in the seeding band, g/m^2, mirroring
 * SEEDING.levels in server/src/lib/services/forecast.ts. This is the seedability
 * signal itself, so unlike the other two layers the bands mean "worth flying
 * to", not "how much weather".
 *
 * Drawn over GOES Band 13 imagery rather than the basemap, which is a darker
 * backdrop than either forecast layer gets — hence the slightly stronger fills.
 * The top band still lands near 60% opacity, so cloud-top structure reads
 * through the richest cell on the map.
 */
export const SLW_BANDS: readonly Band[] = [
  { value: 10, alpha: 0.15 },
  { value: 50, alpha: 0.18 },
  { value: 150, alpha: 0.22 },
  { value: 400, alpha: 0.26 },
];

/**
 * Observed reflectivity, dBZ, mirroring REFLECTIVITY.levels in
 * server/src/lib/services/radar.ts. The NWS intensity classes: light, moderate,
 * heavy, and the top band where a summer cell is producing hail.
 *
 * Same alphas as the liquid-water bands because they share the candidate map and
 * are drawn over the same imagery — and because the two are meant to be read
 * *against* each other. Amber with cyan through it is a candidate that is
 * already raining itself out, which is the one combination on this map that says
 * "not this one".
 */
export const RADAR_BANDS: readonly Band[] = [
  { value: 20, alpha: 0.15 },
  { value: 30, alpha: 0.18 },
  { value: 40, alpha: 0.22 },
  { value: 50, alpha: 0.26 },
];

/**
 * First forecast hour with precipitation. Mirrors FIELDS.precip.firstHour on the
 * server: HRRR diagnoses PRATE by integrating a timestep forward, so the
 * analysis carries none and the layer has nothing to draw at f00.
 *
 * Supercooled liquid water has no equivalent: a mixing ratio is a state the
 * analysis holds, so CLWMR is real at f00 and the candidate map can show it for
 * "right now".
 */
export const PRECIP_FIRST_HOUR = 1;

/**
 * Fill colours. Cloud is the neutral veil; rain is the one thing drawn on top
 * of it, so it gets a hue cloud can never be confused for. One hue per layer,
 * shaded by the stacking — a multi-hue ramp cannot work here, because a heavy
 * cell is painted by all four bands at once and the hues would blend.
 *
 * Liquid water is amber because it shares the candidate map with Band 13, whose
 * published GIBS ramp already spends cyan and green on cloud-top temperature.
 */
export const CLOUD_RGB = [255, 255, 255] as const;
export const PRECIP_RGB = [34, 211, 238] as const;
export const SLW_RGB = [251, 191, 36] as const;

/**
 * Radar reflectivity is painted the same cyan as forecast precipitation,
 * deliberately: it is the same quantity, and the two never share a map. On
 * `/map/forecast` cyan is what the model says will fall; on `/map/candidate` it
 * is what a radar just watched fall. Giving observed rain its own hue would
 * imply it is a different variable.
 */
export const RADAR_RGB = PRECIP_RGB;

/**
 * Alpha of the first n bands painted over each other. Fills composite
 * multiplicatively, so a legend has to as well or it misreports the map.
 */
export const stackedAlpha = (bands: readonly Band[], n: number) =>
  1 - bands.slice(0, n).reduce((acc, b) => acc * (1 - b.alpha), 1);

/** `rgba(...)` for the first n bands stacked — what the map actually paints. */
export const stackedColor = (
  bands: readonly Band[],
  rgb: readonly number[],
  n: number
) => `rgba(${rgb.join(",")},${stackedAlpha(bands, n).toFixed(3)})`;

const fills = (bands: readonly Band[], rgb: readonly number[]) =>
  bands.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [...rgb, alpha],
      outline: { width: 0 },
    }),
  }));

export const forecastCloudRenderer = new UniqueValueRenderer({
  field: "cloudCover",
  uniqueValueInfos: fills(CLOUD_BANDS, CLOUD_RGB),
});

export const forecastPrecipRenderer = new UniqueValueRenderer({
  field: "precipRate",
  uniqueValueInfos: fills(PRECIP_BANDS, PRECIP_RGB),
});

export const candidateLiquidRenderer = new UniqueValueRenderer({
  field: "slwPath",
  uniqueValueInfos: fills(SLW_BANDS, SLW_RGB),
});

export const candidateRadarRenderer = new UniqueValueRenderer({
  field: "reflectivity",
  uniqueValueInfos: fills(RADAR_BANDS, RADAR_RGB),
});

/**
 * One icing-PIREP class: a severity rank and the marker painted for it.
 *
 * Unlike every other layer here these do not stack — a PIREP is one aircraft at
 * one point, and exactly one class applies to it. So each class carries the
 * colour it is actually drawn in, and the legend reads them straight rather than
 * compositing them.
 */
export type PirepClass = {
  /** Rank the server puts on the feature, 0-4. The renderer matches on it. */
  readonly value: number;
  readonly label: string;
  readonly alpha: number;
  /** Marker diameter, px. Size carries the ordering as well as opacity does. */
  readonly size: number;
  readonly rgb: readonly number[];
};

/**
 * Violet, because the candidate map already spends amber on modelled liquid
 * water and this is the opposite kind of claim: an aircraft that was there. The
 * two are meant to be told apart at a glance — amber with violet on it is the
 * model confirmed, amber with none is the model unchecked.
 */
export const PIREP_RGB = [167, 139, 250] as const;

/**
 * Grey, for a pilot reporting *no* ice. It is real evidence — the only
 * falsification of the model in this system — but it is not evidence of liquid
 * water, so it must not read as a hit.
 */
export const PIREP_NEG_RGB = [148, 163, 184] as const;

/**
 * Mirrors SEVERITY in server/src/lib/services/pirep.ts: the server ranks the
 * filed intensity code and this decides how each rank is drawn. A range like
 * `LGT-MOD` is ranked at its worst class, so nothing lands between these.
 */
export const PIREP_CLASSES: readonly PirepClass[] = [
  { value: 0, label: "none", alpha: 0.35, size: 6, rgb: PIREP_NEG_RGB },
  { value: 1, label: "trace", alpha: 0.55, size: 9, rgb: PIREP_RGB },
  { value: 2, label: "light", alpha: 0.7, size: 12, rgb: PIREP_RGB },
  { value: 3, label: "moderate", alpha: 0.85, size: 15, rgb: PIREP_RGB },
  { value: 4, label: "severe", alpha: 1, size: 18, rgb: PIREP_RGB },
];

/** `rgba(...)` for one unstacked class — what a single marker is painted. */
export const soloColor = (rgb: readonly number[], alpha: number) =>
  `rgba(${rgb.join(",")},${alpha.toFixed(3)})`;

/** The legend's swatches, in class order. */
export const PIREP_COLORS = PIREP_CLASSES.map((c) => soloColor(c.rgb, c.alpha));

/**
 * A pale outline on every marker. These are drawn over infrared imagery and
 * amber contours, neither of which has a hard edge anywhere — the ring is what
 * says "this is a report, not weather".
 */
const PIREP_OUTLINE = { color: [255, 255, 255, 0.85], width: 1 } as const;

export const candidatePirepRenderer = new UniqueValueRenderer({
  field: "severity",
  uniqueValueInfos: PIREP_CLASSES.map(({ value, rgb, alpha, size }) => ({
    value,
    symbol: new SimpleMarkerSymbol({
      style: "circle",
      color: [...rgb, alpha],
      size,
      outline: PIREP_OUTLINE,
    }),
  })),
});

/**
 * Show only reports inside the −5..−12 °C seeding band. The server sets `inBand`
 * on the feature, so this filter asks the same question the layer's own field
 * already answers rather than re-deriving it from temperature here.
 *
 * A report with no temperature is not in band: the server counts unknown as 0,
 * because a filter that promoted "we cannot say" to "yes" would be inventing
 * confirmations.
 */
export const PIREP_IN_BAND = "inBand = 1";

/** The words an operator reads, not the raw number. Parallel to PRECIP_BANDS. */
export const PRECIP_LABELS = ["trace", "light", "moderate", "heavy"] as const;

/**
 * Parallel to SLW_BANDS. These are seeding judgements, not measurements: a cloud
 * carrying under ~50 g/m^2 of supercooled liquid is not worth a sortie, and the
 * top band is where the classic glaciogenic-seeding literature puts a strong
 * target.
 */
export const SLW_LABELS = ["trace", "marginal", "good", "prime"] as const;

/**
 * Parallel to RADAR_BANDS. The NWS reflectivity classes, in the words an
 * operator reads: 20 dBZ is drizzle you could fly through, 50 is a cell with
 * hail in it.
 */
export const RADAR_LABELS = ["light", "moderate", "heavy", "intense"] as const;
