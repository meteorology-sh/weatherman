// ArcGIS
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";

/**
 * Cloud-cover isopleths, ascending. Must stay in step with LEVELS in
 * server/src/lib/services/forecast.ts — the server decides which contours exist
 * and this decides how they are painted.
 *
 * The server emits one nested MultiPolygon per level, so they stack: a 90% area
 * is painted by all four, a 30% area by one. Keeping each fill faint lets the
 * stacking do the shading and keeps the basemap readable underneath, which is
 * the whole reason these are vectors rather than an infrared raster. Overcast
 * tops out near 47% opacity, not 100%.
 *
 * There is deliberately no 10% band: on a normal day ~65% of the country has
 * at least 10% cloud, so drawing it veils the map for no information.
 */
export const CLOUD_BANDS = [
  { value: 30, alpha: 0.1 },
  { value: 50, alpha: 0.13 },
  { value: 70, alpha: 0.16 },
  { value: 90, alpha: 0.2 },
] as const;

/**
 * Alpha of the first n bands painted over each other. Fills composite
 * multiplicatively, so the legend has to as well or it misreports the map.
 */
export const stackedAlpha = (n: number) =>
  1 - CLOUD_BANDS.slice(0, n).reduce((acc, b) => acc * (1 - b.alpha), 1);

export const forecastCloudRenderer = new UniqueValueRenderer({
  field: "cloudCover",
  uniqueValueInfos: CLOUD_BANDS.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [255, 255, 255, alpha],
      outline: { width: 0 },
    }),
  })),
});
