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
import {
  CLOUD_BANDS,
  CLOUD_RGB,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  CLOUD_TOP_BANDS,
  CLOUD_TOP_RGB,
  CANDIDATE_BANDS,
  CANDIDATE_RGB,
  CONFIRMED_RGB,
  CONFIRMED_WIDTH,
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

export const candidateFieldRenderer = new UniqueValueRenderer({
  field: "seedableSlwPath",
  uniqueValueInfos: fills(CANDIDATE_BANDS, CANDIDATE_RGB),
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
