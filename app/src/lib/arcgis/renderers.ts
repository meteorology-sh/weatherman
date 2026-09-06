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
import {
  CLOUD_BANDS,
  CLOUD_RGB,
  BASE_WINDOW_ALPHA,
  BASE_WINDOW_RGB,
  CAPE_BANDS,
  CAPE_RGB,
  CIN_BANDS,
  CIN_RGB,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  FREEZING_RGB,
  LCL_RGB,
  MINUS15_RGB,
  WARM_DEPTH_RGB,
  CLOUD_TOP_BANDS,
  CLOUD_TOP_RGB,
  FLY_ALPHA,
  FLY_RGB,
  CONFIRMED_RGB,
  CONFIRMED_WIDTH,
  ECHO_FREEZE_ALPHA,
  ECHO_FREEZE_RGB,
  FLANK_RGB,
  FLANK_WIDTH,
  LIGHTNING_RGB,
  MOTION_RGB,
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
    size: 7,
    outline: { color: [0, 0, 0, 0], width: 0 },
  }),
});

/**
 * Heading of the storm, from the heaviest-rain cell. Not a nowcast.
 *
 * A filled dart in map coordinates, so the head shrinks with the tick
 * when the view zooms out. A screen-pixel triangle would stay huge.
 */
export const stormMotionRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [...MOTION_RGB, 0.95],
    outline: { color: [...MOTION_RGB, 0], width: 0 },
  }),
});

/**
 * Raining cells on the upwind edge of the storm. Hollow, so the rain
 * fill underneath is still the rain. Empty when the storm has no heading:
 * we do not guess an inflow side.
 */
export const stormFlankRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [0, 0, 0, 0],
    outline: { color: [...FLANK_RGB, 0.95], width: FLANK_WIDTH },
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


export const candidateCloudTopRenderer = new UniqueValueRenderer({
  field: "topColdnessC",
  uniqueValueInfos: CLOUD_TOP_BANDS.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [...CLOUD_TOP_RGB, alpha],
      outline: { width: 0 },
    }),
  })),
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

const heightInfos = (rgb: readonly number[]) =>
  CLOUD_BASE_BANDS.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [...rgb, alpha],
      outline: { width: 0 },
    }),
  }));

export const capeRenderer = new UniqueValueRenderer({
  field: "mixedCapeJKg",
  uniqueValueInfos: CAPE_BANDS.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [...CAPE_RGB, alpha],
      outline: { width: 0 },
    }),
  })),
});

export const cinRenderer = new UniqueValueRenderer({
  field: "cinJKg",
  uniqueValueInfos: CIN_BANDS.map(({ value, alpha }) => ({
    value,
    symbol: new SimpleFillSymbol({
      color: [...CIN_RGB, alpha],
      outline: { width: 0 },
    }),
  })),
});

export const lclRenderer = new UniqueValueRenderer({
  field: "lclFt",
  uniqueValueInfos: heightInfos(LCL_RGB),
});

export const freezingRenderer = new UniqueValueRenderer({
  field: "freezingFt",
  uniqueValueInfos: heightInfos(FREEZING_RGB),
});

export const minus15Renderer = new UniqueValueRenderer({
  field: "minus15Ft",
  uniqueValueInfos: heightInfos(MINUS15_RGB),
});

export const warmDepthRenderer = new UniqueValueRenderer({
  field: "warmCloudDepthFt",
  uniqueValueInfos: heightInfos(WARM_DEPTH_RGB),
});

/**
 * Comptroller window: one fill. Drawn instead of the height ramp, not
 * on top of it.
 */
export const baseWindowRenderer = new SimpleRenderer({
  symbol: new SimpleFillSymbol({
    color: [...BASE_WINDOW_RGB, BASE_WINDOW_ALPHA],
    outline: { width: 0 },
  }),
});
