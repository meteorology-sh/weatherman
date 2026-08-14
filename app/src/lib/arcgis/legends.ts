// ArcGIS
import {
  BAND_LABEL,
  BASE_WINDOW_FT,
  CANDIDATE_BANDS,
  CLOUD_TOP_BANDS,
  RADAR_BANDS,
} from "./renderers";

/**
 * The prose half of a layer's legend: its name, what it measures, how it is
 * made, and what it does not tell you. The swatches themselves come from the
 * renderer, so a colour can never drift between the map and the panel.
 *
 * Both maps read these, which is the point — the candidate map and the replay
 * map draw the same layers at different hours, so only the hour may differ.
 */
export type LayerLegend = {
  /** The layer's name on screen. */
  name: string;
  /** Which feed it comes from, shown under the name. */
  source: string;
  /** What the layer measures and how it is made. */
  about: string;
  /** What the layer does not tell you. */
  caveat: string;
};

/** Warm edge of the mask: above this the seeding band is above the cloud. */
export const CLOUD_TOP_WARMEST_C = CLOUD_TOP_BANDS[0].fromC;

/** The window's edges as an operator reads them, e.g. "4,000–12,000 ft". */
export const BASE_WINDOW_LABEL = `${BASE_WINDOW_FT[0].toLocaleString(
  "en-US"
)}–${BASE_WINDOW_FT[1].toLocaleString("en-US")} ft`;

export const CloudBaseLegend: LayerLegend = {
  name: "CLOUD_BASE",
  source: "NOAA HRRR",
  about:
    "The height of the bottom of the lowest cloud deck, in feet MSL. HRRR " +
    "diagnoses it in the same wrfsfc file the forecast layers already read, " +
    "at 3 km, block-averaged to 12 km and banded on three intervals. The lit " +
    `band is the ${BASE_WINDOW_LABEL} window Texas operations select in.`,
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
  name: "CLOUD_TOPS",
  source: "NOAA GOES-East + NOAA HRRR",
  about:
    "The temperature at the top of the cloud, in °C. GOES-East scans " +
    "cloud-top pressure every 5 minutes at 2 km; the server reprojects that " +
    "onto the 12 km grid and turns each pressure into a temperature using " +
    `HRRR's profile at that height. Only tops at ${CLOUD_TOP_WARMEST_C} °C ` +
    "and colder are drawn.",
  caveat:
    "The top of the cloud, not the liquid inside it — the " +
    `${BAND_LABEL} layer sits below the top, and this cannot see it. ` +
    "Tops warmer than " +
    `${CLOUD_TOP_WARMEST_C} °C are left out because the seeding band is then ` +
    "above the cloud entirely. The shape is observed; the temperature comes " +
    "from HRRR's profile at that height, so a cloud the model has misplaced " +
    "vertically will read the wrong temperature.",
};

export const LiquidLegend: LayerLegend = {
  name: "SUPERCOOLED_LIQUID_WATER",
  source: "NOAA HRRR",
  about:
    "Liquid water colder than freezing, in g/m² — the water silver iodide " +
    "turns to ice, and the reason to fly. HRRR carries cloud water on 40 " +
    "pressure levels; the server adds up the levels whose temperature falls " +
    `in the ${BAND_LABEL} band, so the total follows the band up and down ` +
    "the column instead of sitting at a fixed altitude.",
  caveat:
    "Modelled, not observed: this is HRRR's analysis of what is inside the " +
    "cloud, which no satellite can see. It is drawn for the analysis hour, " +
    "so it is the model's estimate of right now rather than a forecast.",
};

export const RadarLegend: LayerLegend = {
  name: "RADAR_REFLECTIVITY",
  source: "NOAA MRMS",
  about:
    "How hard it is raining, in dBZ. MRMS merges every NEXRAD radar into one " +
    "national mosaic at 1 km, replaced every 2 minutes; the server " +
    "block-averages it to 12 km and contours it on the NWS intensity " +
    "classes.",
  caveat:
    "Measured, not modelled — the only layer here that is. Radar sees the " +
    "water that is already falling, not the liquid inside a cloud, so it can " +
    "cross a candidate off but never confirm one. A third of this map has no " +
    "radar over it at all, and no coverage is not a report of clear air.",
};

export const CandidateLegend: LayerLegend = {
  name: "SEEDING_OPPORTUNITY",
  source: "NOAA HRRR + NOAA GOES-East + NOAA MRMS",
  about:
    "Supercooled liquid water in the cells that pass every test at once: the " +
    `model has at least ${CANDIDATE_BANDS[0].value} g/m² in the seeding ` +
    `band, the satellite sees a cloud top at ${CLOUD_TOP_WARMEST_C} °C or ` +
    "colder, the cloud base sits below the band's cold edge, and the radar " +
    `is not already watching the cell rain at ${RADAR_BANDS[0].value} dBZ or ` +
    "more. The value drawn is the liquid water path itself, on the same " +
    "levels as the liquid layer, so the two read against each other.",
  caveat:
    "It exists at the analysis hour only, because it reads an observed cloud " +
    "top and a satellite cannot forecast. It is also only as current as its " +
    "slowest source. Where the radar cannot see, a cell stays a candidate " +
    "and the panel reports how much ground went unchecked.",
};

export const CloudCoverLegend: LayerLegend = {
  name: "CLOUD_COVER",
  source: "NOAA HRRR",
  about:
    "The share of sky HRRR fills with cloud in each cell, in percent, at the " +
    "forecast hour on the slider. Read at 3 km, block-averaged to 12 km and " +
    "contoured into nested bands — denser white is more cloud.",
  caveat:
    "Modelled out to 18 hours, and satellites cannot forecast, so nothing " +
    "on this map is observed. For observed cloud shape, use the candidate " +
    "map.",
};

export const PrecipLegend: LayerLegend = {
  name: "PRECIPITATION",
  source: "NOAA HRRR",
  about:
    "The rate HRRR expects rain to fall, in mm/hr, from the same run and " +
    "hour as the cloud layer. Contoured the same way and drawn over it, on " +
    "the NWS intensity classes.",
  caveat:
    "HRRR works precipitation out by stepping the model forward, so the " +
    "analysis hour carries none and this layer has nothing to draw there. A " +
    "cloud that is already raining is not a seeding candidate.",
};
