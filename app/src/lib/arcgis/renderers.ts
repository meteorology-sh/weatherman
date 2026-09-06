/**
 * The ArcGIS symbols each layer is drawn with.
 *
 * One renderer per layer, built from the band tables in `bands.ts` — this file
 * decides nothing about which levels exist or what colour they are, so a layer
 * cannot be painted one way on the map and another in the legend.
 */

// ArcGIS
import UniqueValueRenderer from "@arcgis/core/renderers/UniqueValueRenderer";
import SimpleRenderer from "@arcgis/core/renderers/SimpleRenderer";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
import SimpleLineSymbol from "@arcgis/core/symbols/SimpleLineSymbol";
import {
  CLOUD_BANDS,
  CLOUD_RGB,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  FLY_ALPHA,
  FLY_RGB,
  CONFIRMED_RGB,
  CONFIRMED_WIDTH,
  ECHO_FREEZE_ALPHA,
  ECHO_FREEZE_RGB,
  LIGHTNING_RGB,
  MOTION_RGB,
  MOTION_WIDTH,
  PRECIP_BANDS,
  PRECIP_RGB,
  RADAR_BANDS,
  RADAR_RGB,
  SLW_BANDS,
  SLW_RGB,
} from "./bands";

// Types
import type { Band } from "./bands";

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
 * Texas fly: one fill. The same cells FLY names on a click.
 */
export const candidateFieldRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [...FLY_RGB, FLY_ALPHA],
    outline: { width: 0 },
  }),
});

/**
 * The observed-phase outline: one symbol for every polygon, because every
 * polygon means the same thing.
 *
 * A `SimpleRenderer` rather than a banded one on purpose — this geometry
 * carries no magnitude to band. The field underneath already says how much
 * liquid is there; this says only which of that ground the satellite still sees
 * liquid at the top of. Hollow, so the fills it encloses are read unchanged.
 */
export const candidateConfirmedRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    outline: { color: [...CONFIRMED_RGB, 0.9], width: CONFIRMED_WIDTH },
  }),
});

/**
 * Storm outline: the same cyan as the 20 dBZ radar band, so the line is
 * visibly the edge of that rain, not a second variable.
 */
/** The heaviest rain in the storm — one point at the strongest 1 km cell. */
export const stormCoreRenderer = new SimpleRenderer({
  symbol: new SimpleMarkerSymbol({
    color: [...RADAR_RGB, 0.95],
    size: 3,
    outline: { color: [0, 0, 0, 0], width: 0 },
  }),
});

/**
 * Heading of the storm, from the heaviest-rain cell. Not a nowcast.
 *
 * A line from the core along the heading, with the arrowhead the line
 * symbol draws at its end. Its length is kilometres of ground and follows
 * the speed; its width is screen points and follows nothing, so zooming in
 * on a single cell lengthens the tick without fattening it.
 */
export const stormMotionRenderer = new SimpleRenderer({
  symbol: new SimpleLineSymbol({
    color: [...MOTION_RGB, 0.95],
    width: MOTION_WIDTH,
    cap: "butt",
    marker: {
      color: [...MOTION_RGB, 0.95],
      placement: "end",
      style: "arrow",
    },
  }),
});

/**
 * 18 dBZ top at or above freezing. One fill, no ramp.
 */
export const echoFreezeRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [...ECHO_FREEZE_RGB, ECHO_FREEZE_ALPHA],
    outline: { width: 0 },
  }),
});

/** One GLM flash. Points only — lightning is not a surface. */
export const lightningRenderer = new SimpleRenderer({
  symbol: new SimpleMarkerSymbol({
    color: [...LIGHTNING_RGB, 0.95],
    size: 5,
    outline: { color: [0, 0, 0, 0], width: 0 },
  }),
});


export const candidateCloudBaseRenderer = new UniqueValueRenderer({
  field: "cloudBaseFt",
  uniqueValueInfos: CLOUD_BASE_BANDS.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [...CLOUD_BASE_RGB, alpha],
      outline: { width: 0 },
    }),
  })),
});

