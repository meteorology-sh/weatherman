/**
 * The five layers the map draws, wired to Weatherman's own definitions.
 *
 * **Nothing here describes a layer. Everything here points at the description
 * the product already has.** The levels, the colours, the alphas, the on-screen
 * name and the prose all come out of `@/lib/arcgis`, so a band that moves in the
 * product moves here, and a page built to find disagreements between the map and
 * an operator cannot introduce one between itself and the map it is inspecting.
 *
 * The order is the order `Map.tsx` stacks them on the replay route: cloud base
 * underneath, modelled liquid over observed tops, measured radar over both, the
 * join on top.
 */

// ArcGIS
import {
  CANDIDATE_BANDS,
  CANDIDATE_LABELS,
  CANDIDATE_RGB,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  CLOUD_TOP_BANDS,
  CLOUD_TOP_RGB,
  RADAR_BANDS,
  RADAR_LABELS,
  RADAR_RGB,
  SLW_BANDS,
  SLW_LABELS,
  SLW_RGB,
} from "@/lib/arcgis/bands";
import {
  CandidateLegend,
  CloudBaseLegend,
  CloudTopLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";

// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

/**
 * How a layer's bands relate to each other, which decides how both the map and
 * its ramp are drawn.
 *
 * `nested` bands stack — an area meeting the top level is painted by every band
 * below it, so the fills composite and the ramp has to composite too. `disjoint`
 * bands do not: exactly one applies to a cell, and each swatch is the literal
 * fill. Getting this wrong paints a legend that misreports the map.
 */
export type BandShape = "nested" | "disjoint";

export type EvalLayer = {
  /** Matches the key `held.mjs` writes each frame under. */
  key: string;
  legend: LayerLegend;
  bands: readonly { value: number; alpha: number }[];
  rgb: readonly number[];
  shape: BandShape;
  /** One caption per band, in the operator's units. */
  captions: string[];
  /** Hover text per band, where the numbers have words behind them. */
  titles?: readonly string[];
  unit: string;
};

export const LAYERS: readonly EvalLayer[] = [
  {
    key: "cloudBase",
    legend: CloudBaseLegend,
    bands: CLOUD_BASE_BANDS,
    rgb: CLOUD_BASE_RGB,
    shape: "disjoint",
    captions: CLOUD_BASE_BANDS.map((band) => band.label),
    unit: "ft MSL",
  },
  {
    key: "cloudTop",
    legend: CloudTopLegend,
    bands: CLOUD_TOP_BANDS,
    rgb: CLOUD_TOP_RGB,
    shape: "disjoint",
    captions: CLOUD_TOP_BANDS.map((band) => band.label),
    unit: "°C",
  },
  {
    key: "liquid",
    legend: LiquidLegend,
    bands: SLW_BANDS,
    rgb: SLW_RGB,
    shape: "nested",
    captions: SLW_BANDS.map((band) => String(band.value)),
    titles: SLW_LABELS,
    unit: "g/m²",
  },
  {
    key: "radar",
    legend: RadarLegend,
    bands: RADAR_BANDS,
    rgb: RADAR_RGB,
    shape: "nested",
    captions: RADAR_BANDS.map((band) => String(band.value)),
    titles: RADAR_LABELS,
    unit: "dBZ",
  },
  {
    key: "candidate",
    legend: CandidateLegend,
    bands: CANDIDATE_BANDS,
    rgb: CANDIDATE_RGB,
    shape: "nested",
    captions: CANDIDATE_BANDS.map((band) => String(band.value)),
    titles: CANDIDATE_LABELS,
    unit: "g/m²",
  },
];

export const layerFor = (key: string) =>
  LAYERS.find((layer) => layer.key === key);

/**
 * Which layers a fresh map opens with.
 *
 * The liquid field and the join, because those are the two the evaluation turns
 * on — the question is whether a flare fell in liquid we painted, and then what
 * the rest of the join did to it. Turning all five on at once opens to a map
 * with five fills over each other and no reading.
 */
export const OPEN_WITH: Record<string, boolean> = {
  cloudBase: false,
  cloudTop: false,
  liquid: true,
  radar: false,
  candidate: true,
};
