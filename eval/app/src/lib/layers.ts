/**
 * The layers the map draws, wired to Weatherman's own definitions.
 *
 * **Nothing here describes a layer. Everything here points at the description
 * the product already has.** The levels, the colors, the alphas, the on-screen
 * name and the prose all come out of `@/lib/arcgis`, so a band that moves in the
 * product moves here, and a page built to find disagreements between the map and
 * an operator cannot introduce one between itself and the map it is inspecting.
 *
 * **The list is the product's list, and nothing else.** Weatherman's panel has
 * four switches: the Texas fly fill it names SEEDING OPPORTUNITY, radar with
 * three gates under it, cloud base, and supercooled liquid water. This page
 * carries the same four. The fifth, severe weather warnings, is a stored mark
 * rather than a painted fill, and `LayerPanel` carries its switch. A layer this page drew that the product does not draw
 * would be a claim about a map nobody flies, so a fill the product does not
 * draw is neither painted nor read.
 *
 * A gate is one fill rather than a ramp: the test passed on that 3 km square or
 * it did not, and shading it by a value would invent a quantity the route does
 * not return.
 */

// ArcGIS
import {
  CLOUD_BASE_BANDS,
  CLOUD_BASE_LABELS,
  COLORS,
  ECHO_FREEZE_ALPHA,
  FLY_ALPHA,
  RADAR_BANDS,
  RADAR_LABELS,
  SLW_BANDS,
  SLW_LABELS,
} from "@/lib/arcgis/bands";
import {
  CandidateLegend,
  CloudBaseLegend,
  EchoFreezeLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";

// Types
import type { Band } from "@/lib/arcgis/bands";
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

type Common = {
  /** Matches the key `paint.mjs` writes each frame under. */
  key: string;
  legend: LayerLegend;
  /**
   * The switch this one hangs under in Weatherman's own panel, or null when it
   * is a layer in its own right. A gate is drawn only while its parent is on,
   * the same rule `Map.tsx` applies.
   */
  under: string | null;
};

/** A ramped field: several contour levels, each its own band. */
export type BandedLayer = Common & {
  kind: "bands";
  bands: readonly Band[];
  rgb: readonly number[];
  shape: BandShape;
  /** One caption per band, in the operator's units. */
  captions: readonly string[];
  /** Hover text per band, where the numbers have words behind them. */
  titles?: readonly string[];
  unit: string;
};

/** A pass/fail field: one fill wherever the test held. */
export type GateLayer = Common & {
  kind: "gate";
  rgb: readonly number[];
  alpha: number;
};

export type EvalLayer = BandedLayer | GateLayer;

/**
 * The layers, in the order Weatherman's own panel lists them.
 *
 * Tables read this order too, so a row on the program page and a switch on
 * the map name the same layers in the same sequence.
 */
export const LAYERS: readonly EvalLayer[] = [
  {
    key: "target",
    legend: CandidateLegend,
    under: null,
    kind: "gate",
    rgb: COLORS.fly,
    alpha: FLY_ALPHA,
  },
  {
    key: "radar",
    legend: RadarLegend,
    under: null,
    kind: "bands",
    bands: RADAR_BANDS,
    rgb: COLORS.rain,
    shape: "nested",
    captions: RADAR_BANDS.map((band) => String(band.value)),
    titles: RADAR_LABELS,
    unit: "dBZ",
  },
  {
    key: "echoFreeze",
    legend: EchoFreezeLegend,
    under: "radar",
    kind: "gate",
    rgb: COLORS.echoFreeze,
    alpha: ECHO_FREEZE_ALPHA,
  },
  {
    key: "cloudBase",
    legend: CloudBaseLegend,
    under: null,
    kind: "bands",
    bands: CLOUD_BASE_BANDS,
    rgb: COLORS.cloudBase,
    shape: "disjoint",
    captions: CLOUD_BASE_LABELS,
    unit: "ft MSL",
  },
  {
    key: "liquid",
    legend: LiquidLegend,
    under: null,
    kind: "bands",
    bands: SLW_BANDS,
    rgb: COLORS.liquid,
    shape: "nested",
    captions: SLW_BANDS.map((band) => String(band.value)),
    titles: SLW_LABELS,
    unit: "g/m²",
  },
];

export const layerFor = (key: string) =>
  LAYERS.find((layer) => layer.key === key);

/** The layers with a switch of their own, each with the gates under it. */
export const PANEL: readonly { layer: EvalLayer; gates: EvalLayer[] }[] =
  LAYERS.filter((layer) => layer.under === null).map((layer) => ({
    layer,
    gates: LAYERS.filter((gate) => gate.under === layer.key),
  }));

/**
 * Bottom to top, the order `Map.tsx` adds the fills to the view.
 *
 * Cloud base under the rain, echo past freezing over the rain it annotates,
 * and the fly fill last — the same stack the operator's map composites, so a
 * color that comes out on top there comes out on top here.
 */
export const DRAW_ORDER: readonly string[] = [
  "cloudBase",
  "liquid",
  "radar",
  "echoFreeze",
  "target",
];

/**
 * The fill the storm marks are drawn under.
 *
 * Cores, heading ticks and lightning go into the view after echo past freezing
 * and before the fly fill, so the fill an operator is being asked to click is
 * the top thing on the map. Drawing the marks last would put a lightning dot
 * over green that is painted over it in Weatherman.
 */
export const MARKS_UNDER = "target";

/**
 * Is this layer actually on the map?
 *
 * A gate needs its own switch and its parent's, because that is what the
 * product does: echo past freezing is an annotation on the rain and is not
 * drawn without it.
 */
export function isDrawn(
  layer: EvalLayer,
  visible: Record<string, boolean>
): boolean {
  if (!visible[layer.key]) return false;
  return layer.under === null || Boolean(visible[layer.under]);
}

/**
 * The layers made of model alone, whose answer is an hour rather than a minute.
 *
 * These are as old as their analysis, so a release is carried over the gap on
 * storm motion before it is measured against them. Every other layer here has
 * its edge placed by radar or satellite valid at the release minute — the fill
 * has already followed the storm — and is measured where the flare fell. The
 * drift arrow is drawn only while one of these is on, because it describes only
 * these.
 */
export const HOURLY: readonly string[] = ["liquid"];

/**
 * Which layers a fresh map opens with — the fly fill, and nothing else.
 *
 * This page exists to ask one question: does the fill the operator map names
 * SEEDING OPPORTUNITY sit where Texas flew? Opening on that fill alone is what
 * puts the answer on screen unaccompanied. The rain, its echo past freezing and
 * cloud base are the inputs behind the call rather than the call, so they are a
 * switch away — drawn when a reader wants to know *why* the fill is where it
 * is, not before the fill has been read.
 */
export const OPEN_WITH: Record<string, boolean> = {
  radar: false,
  echoFreeze: false,
  cloudBase: false,
  liquid: false,
  target: true,
};

/**
 * The order the per-release table reads the layers in — the fly fill last.
 *
 * The panel lists the fill first, because that is the order Weatherman's own
 * panel lists it and a switch is reached by eye. A table is read the other way:
 * the inputs are the working, and SEEDING OPPORTUNITY is the answer they add up
 * to, so it belongs in the rightmost column where a conclusion goes.
 */
export const RESULT_ORDER: readonly EvalLayer[] = [
  ...LAYERS.filter((layer) => layer.key !== "target"),
  ...LAYERS.filter((layer) => layer.key === "target"),
];
