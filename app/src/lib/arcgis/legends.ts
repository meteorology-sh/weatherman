// ArcGIS
import { BAND_LABEL, BASE_WINDOW_FT, CLOUD_TOP_BANDS } from "./renderers";

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

/** The window's edges as an operator reads them, e.g. "4,000–12,000 ft". */
export const BASE_WINDOW_LABEL = `${BASE_WINDOW_FT[0].toLocaleString(
  "en-US"
)}–${BASE_WINDOW_FT[1].toLocaleString("en-US")} ft`;

export const CloudBaseLegend: LayerLegend = {
  name: "HRRR cloud base",
  summary: `Modelled cloud base, ft MSL. The lit band is the ${BASE_WINDOW_LABEL} window Texas operations select in. Nothing drawn where the model has no cloud.`,
  caveat:
    "Modelled, not observed — and it is the base of the lowest deck of any " +
    "kind, so a base above the window is usually cirrus over clear air rather " +
    "than a high convective base. Heights are MSL, matching the sounding's " +
    "band altitudes; the published Texas window does not state its datum, and " +
    "over Texas the ground itself moves through ~4,000 ft, so read the " +
    "window as this app's reading of it. Depth is not drawn: HRRR's own cloud " +
    "top is diagnosed over far less ground than its base, so a depth layer " +
    "would vanish over most of the cloud this one shows.",
};

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
