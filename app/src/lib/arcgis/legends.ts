// ArcGIS
import { BAND_LABEL, CLOUD_TOP_BANDS } from "./renderers";

/**
 * The prose half of a layer's legend: what the operator is looking at, and what
 * it does not tell them. The swatches themselves come from the renderer, so a
 * colour can never drift between the map and the panel.
 */
export type LayerLegend = {
  name: string;
  /** One line under the toggle saying what the operator is looking at. */
  summary: string;
  /** What the layer does not tell you. Shown in the panel. */
  caveat: string;
};

/** Warm edge of the mask, as a temperature — the C2 filter. */
export const CLOUD_TOP_WARMEST_C = CLOUD_TOP_BANDS[0].fromC;

export const CloudTopLegend: LayerLegend = {
  name: "GOES-East cloud tops",
  summary: `Observed cloud-top temperature, ${CLOUD_TOP_WARMEST_C} °C and colder. Nothing drawn where there is no cloud.`,
  caveat:
    "The top of the cloud, not the liquid inside it — the " +
    `${BAND_LABEL} layer sits below the top, and this cannot see it. ` +
    "Tops warmer than " +
    `${CLOUD_TOP_WARMEST_C} °C are left out because the seeding band is then ` +
    "above the cloud entirely. The shape is observed; the temperature comes " +
    "from HRRR's profile at that height, so a cloud the model has misplaced " +
    "vertically will read the wrong temperature.",
};
