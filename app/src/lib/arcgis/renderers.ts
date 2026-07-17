// ArcGIS
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

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
 * First forecast hour with precipitation. Mirrors FIELDS.precip.firstHour on the
 * server: HRRR diagnoses PRATE by integrating a timestep forward, so the
 * analysis carries none and the layer has nothing to draw at f00.
 */
export const PRECIP_FIRST_HOUR = 1;

/**
 * Fill colours. Cloud is the neutral veil; rain is the one thing drawn on top
 * of it, so it gets a hue cloud can never be confused for. One hue per layer,
 * shaded by the stacking — a multi-hue ramp cannot work here, because a heavy
 * cell is painted by all four bands at once and the hues would blend.
 */
export const CLOUD_RGB = [255, 255, 255] as const;
export const PRECIP_RGB = [34, 211, 238] as const;

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

/** The words an operator reads, not the raw number. Parallel to PRECIP_BANDS. */
export const PRECIP_LABELS = ["trace", "light", "moderate", "heavy"] as const;
