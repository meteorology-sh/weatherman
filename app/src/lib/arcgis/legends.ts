// ArcGIS
import {
  BAND_LABEL,
  BASE_WINDOW_FT,
  CANDIDATE_BANDS,
  CEILING_FT,
  CLOUD_TOP_BANDS,
  RADAR_BANDS,
} from "./bands";

/**
 * The prose half of a layer's legend: its name, where it comes from, the one
 * sentence the panel shows, and the longer read the About page shows. The
 * swatches themselves come from the renderer, so a colour can never drift
 * between the map and the panel.
 *
 * Both maps read these, which is the point — the candidate map and the replay
 * map draw the same layers at different hours, so only the hour may differ.
 */
export type LayerLegend = {
  /** The layer's name on screen. */
  name: string;
  /** Which feed it comes from, shown under the name. */
  source: string;
  /**
   * One sentence: what this layer gives you. This is what an operator reads
   * under the switch, so it says the thing rather than how it was built.
   */
  summary: string;
  /**
   * The longer read, one paragraph per entry, shown only on the About page.
   * What it measures and how it is made, then what it does not tell you — as
   * prose, because a reader does not need those labelled to follow them.
   */
  detail: readonly string[];
};

/** Warm edge of the mask: above this the seeding band is above the cloud. */
export const CLOUD_TOP_WARMEST_C = CLOUD_TOP_BANDS[0].fromC;

/** The window's edges as an operator reads them, e.g. "4,000–12,000 ft". */
export const BASE_WINDOW_LABEL = `${BASE_WINDOW_FT[0].toLocaleString(
  "en-US"
)}–${BASE_WINDOW_FT[1].toLocaleString("en-US")} ft`;

/** The ceiling as an operator reads it, e.g. "18,000 ft". */
export const CEILING_LABEL = `${CEILING_FT.toLocaleString("en-US")} ft`;

export const CloudBaseLegend: LayerLegend = {
  name: "CLOUD BASE",
  source: "NOAA HRRR",
  summary:
    "How high the bottom of the cloud sits, in feet MSL. The brightest band " +
    "is the shortest climb; the last one is above the " +
    `${CEILING_LABEL} ceiling.`,
  detail: [
    "The height of the bottom of the lowest cloud deck, in feet MSL. HRRR " +
      "diagnoses it at 3 km and the server averages that to 12 km. The bands " +
      `are thirds of the aircraft's ${CEILING_LABEL} service ceiling, so ` +
      "every edge traces back to one cited number rather than to a coverage " +
      "table. The last band is open above the ceiling and still drawn, " +
      "because a base too high to reach and no cloud at all are different " +
      "answers.",
    "Feet above sea level, because that is the datum a sortie is planned in — " +
      "a service ceiling, air density and climb performance all refer to it. " +
      "The cost is that height above sea level says nothing about what kind " +
      "of cloud this is: 6,000 ft is a low convective base at the Gulf coast " +
      "and near-surface fog on the Llano Estacado. Click a point to read the " +
      "same base as a height above the ground.",
    "This is the bottom of the cloud, not the bottom of the seeding band. " +
      "Where the column first reaches the seeding temperature is a different " +
      "altitude, often thousands of feet higher, and the candidate summary " +
      "reports it separately.",
    `The ${BASE_WINDOW_LABEL} window Texas operations select convective ` +
      "bases in is reported in the candidate summary and drawn nowhere. Read " +
      "against sea level it means a different height above the ground over " +
      "every cell — most of an 8,000 ft layer at the coast, and a sliver over " +
      "high terrain where its lower edge is underground.",
    "Modelled, not observed. It is the base of the lowest deck of any kind, " +
      "so a base near the top of the ramp is usually cirrus over clear air " +
      "rather than a high convective base.",
  ],
};

export const CloudTopLegend: LayerLegend = {
  name: "CLOUD TOPS",
  source: "NOAA GOES-East + NOAA HRRR",
  summary:
    "How cold the top of the cloud is, in °C. Colder is deeper cloud; only " +
    `tops at ${CLOUD_TOP_WARMEST_C} °C and colder are drawn.`,
  detail: [
    "The temperature at the top of the cloud, in °C. GOES-East scans " +
      "cloud-top pressure every 5 minutes at 2 km; the server puts that on " +
      "the 12 km grid and reads each pressure as a temperature from HRRR's " +
      "profile at that height.",
    "The top of the cloud, not the liquid inside it — the " +
      `${BAND_LABEL} band sits below the top and this cannot see into it. ` +
      `Tops warmer than ${CLOUD_TOP_WARMEST_C} °C are left out because the ` +
      "seeding band is then above the cloud entirely. The shape is observed " +
      "but the temperature comes from HRRR, so a cloud the model has " +
      "misplaced vertically will read the wrong temperature.",
  ],
};

export const LiquidLegend: LayerLegend = {
  name: "SUPERCOOLED LIQUID WATER",
  source: "NOAA HRRR",
  summary:
    `How much liquid water sits in the ${BAND_LABEL} band, in g/m² — the ` +
    "water silver iodide turns to ice, and the reason to fly.",
  detail: [
    "Liquid water colder than freezing, in g/m². HRRR carries cloud water on " +
      "40 pressure levels and the server adds up the levels whose " +
      `temperature falls in the ${BAND_LABEL} band, so the total follows the ` +
      "band up and down the column instead of sitting at a fixed altitude.",
    "Modelled, not observed: this is HRRR's analysis of what is inside the " +
      "cloud, which no satellite can see. It is drawn for the analysis hour, " +
      "so it is the model's estimate of right now rather than a forecast.",
  ],
};

export const RadarLegend: LayerLegend = {
  name: "RADAR REFLECTIVITY",
  source: "NOAA MRMS",
  summary:
    "How hard it is raining, in dBZ. Rain already falling crosses a " +
    "candidate off.",
  detail: [
    "MRMS merges every NEXRAD radar into one national mosaic at 1 km, " +
      "replaced every 2 minutes; the server averages it to 12 km and contours " +
      "it on the NWS intensity classes.",
    "Measured, not modelled — the only layer here that is. Radar sees the " +
      "water that is already falling, not the liquid inside a cloud, so it " +
      "can cross a candidate off but never confirm one. A third of this map " +
      "has no radar over it at all, and no coverage is not a report of clear " +
      "air.",
  ],
};

export const CandidateLegend: LayerLegend = {
  name: "SEEDING OPPORTUNITY",
  source: "NOAA HRRR + NOAA GOES-East + NOAA MRMS",
  summary:
    "Where every test passes at once: enough supercooled liquid, a cold " +
    "enough cloud top, a low enough cloud base, and no rain already falling.",
  detail: [
    "Supercooled liquid water in the cells that pass every test at once: the " +
      `model has at least ${CANDIDATE_BANDS[0].value} g/m² in the seeding ` +
      `band, the satellite sees a cloud top at ${CLOUD_TOP_WARMEST_C} °C or ` +
      "colder, the cloud base sits below the band's cold edge, and the radar " +
      `is not already watching the cell rain at ${RADAR_BANDS[0].value} dBZ ` +
      "or more. The value drawn is the liquid water path itself, on the same " +
      "levels as the liquid layer, so the two read against each other.",
    "It exists at the analysis hour only, because it reads an observed cloud " +
      "top and a satellite cannot forecast. It is also only as current as its " +
      "slowest source. Where the radar cannot see, a cell stays a candidate " +
      "and the panel reports how much ground went unchecked.",
  ],
};

export const CloudCoverLegend: LayerLegend = {
  name: "CLOUD COVER",
  source: "NOAA HRRR",
  summary:
    "How much of the sky HRRR fills with cloud at the hour on the slider, in " +
    "percent. Denser white is more cloud.",
  detail: [
    "The share of sky HRRR fills with cloud in each cell, in percent, at the " +
      "forecast hour on the slider. Read at 3 km, averaged to 12 km and " +
      "contoured into nested bands.",
    "Modelled out to 18 hours, and satellites cannot forecast, so nothing on " +
      "this map is observed. For observed cloud shape, use the candidate map.",
  ],
};

export const PrecipLegend: LayerLegend = {
  name: "PRECIPITATION",
  source: "NOAA HRRR",
  summary:
    "How hard HRRR expects rain to fall at the hour on the slider, in mm/hr.",
  detail: [
    "The rate HRRR expects rain to fall, in mm/hr, from the same run and hour " +
      "as the cloud layer. Contoured the same way and drawn over it, on the " +
      "NWS intensity classes.",
    "HRRR works precipitation out by stepping the model forward, so the " +
      "analysis hour carries none and this layer has nothing to draw there. A " +
      "cloud that is already raining is not a seeding candidate.",
  ],
};

/**
 * Every layer the app names, in the order the About page reads them: the
 * seeding layer first, then the four inputs it joins, then the forecast map's
 * two.
 *
 * The About page and the legend tests both walk this, so a new layer cannot be
 * added without a page section and the checks that come with it.
 */
export const ALL_LEGENDS: readonly LayerLegend[] = [
  CandidateLegend,
  LiquidLegend,
  CloudTopLegend,
  CloudBaseLegend,
  RadarLegend,
  CloudCoverLegend,
  PrecipLegend,
];
