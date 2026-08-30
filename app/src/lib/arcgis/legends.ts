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
      "diagnoses it at 3 km and the server contours that grid. The bands " +
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
      "cloud-top pressure every 5 minutes at 2 km; the server contours that " +
      "grid and reads each pressure as a temperature from the nearest HRRR " +
      "3 km column.",
    `Tops warmer than ${CLOUD_TOP_WARMEST_C} °C are left out, and that is the ` +
      "only thing this layer excludes: a top that warm puts the whole seeding " +
      "band above the cloud, so there is nothing inside it to seed.",
    "Below that edge the bands fade as they get colder, and the reason is the " +
      "ice. Silver iodide only does something in a cloud that still holds " +
      "liquid water. Natural ice-forming particles are scarce in the warmest " +
      "part of the subzero range and common well below it, so the colder a " +
      "top is, the likelier that cloud has already frozen on its own — and a " +
      "cloud that has frozen has already spent the water seeding would have " +
      "converted. The brightest band is where the liquid is most likely still " +
      "there to work with.",
    "That is a preference and not a test, so nothing is dropped for being " +
      "cold and the coldest band stays on the map. It cuts both ways: a " +
      `colder top also means more of the ${BAND_LABEL} band sits inside the ` +
      "cloud rather than above it. And this reads the coldest part of a cloud " +
      "rather than summarising it, so a vigorous cell with a very cold anvil " +
      "can still be carrying liquid lower down. A faint band here under bright " +
      "supercooled liquid water contours is that case, not a contradiction — " +
      "prefer the layer that is about the liquid, and read it as the model's " +
      "estimate rather than a measurement. Nothing here measures the phase of " +
      "a cloud directly.",
    "The top of the cloud, not the liquid inside it — the " +
      `${BAND_LABEL} band sits below the top and this cannot see into it. ` +
      "It is built from two sources doing separate jobs: the satellite gives " +
      "the cloud's outline and the pressure at its top, and HRRR gives the " +
      "temperature at that pressure. So the cloud is where the satellite says " +
      "it is, but the number in °C is the model's — and where HRRR has the " +
      "temperature profile wrong, a correctly placed cloud is labelled with " +
      "the wrong temperature.",
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

export const StormLegend: LayerLegend = {
  name: "RADAR STORMS",
  source: "NOAA MRMS",
  summary:
    "One storm per outline. The line is the edge of the rain (20 dBZ). " +
    "The dot is the heaviest rain in that storm.",
  detail: [
    "Contiguous cells of the 1 km MRMS mosaic at 20 dBZ or more, the same " +
      "threshold and the same colour as the lowest radar-reflectivity band. " +
      "The outline is the edge of that rain. The dot is the 1 km cell with " +
      "the strongest echo.",
    "This is a 2D composite, not a volume scan. These objects have area and " +
      "a strongest cell, not a 3D top or a precipitation mass. Age and " +
      "direction of travel are computed when consecutive scans are kept; " +
      "they are not shown on this page yet.",
    "Click a storm to read how far the click is from the dot and from the " +
      "edge, and what the model says about supercooled liquid over that " +
      "point. Liquid is a reading, not a test that hides the storm.",
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
      "replaced every 2 minutes; the server contours that mosaic on the NWS " +
      "intensity classes.",
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
    "Where every test passes: enough supercooled liquid, a cold " +
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
      "slowest source. Where the radar cannot see, a cell stays a candidate: " +
      "it was not cleared of rain, it was simply never checked.",
    "Everything this layer says about liquid water is the model's. The " +
      "satellite also classifies each cloud top as liquid, supercooled, " +
      "freezing over or frozen, and that classification is measured rather " +
      "than simulated — so the panel reports it beside the answer. It reads " +
      "both ways: candidate ground whose top has already frozen may be cloud " +
      "that has spent its liquid, and a supercooled top this layer drew " +
      "nothing over is cloud that never reached the map to be ruled out. That " +
      "second reading covers more ground than this layer does and is the " +
      "weaker of the two — a top is one surface, the liquid is a path through " +
      "the whole band, and a thin deck can sit under the lowest band honestly.",
    "That classification is drawn, not just counted: a pale outline encloses " +
      "the ground whose top is still liquid, at the lowest level only, because " +
      "the fills already say how much liquid is there and the line says only " +
      "which of it has an observation behind it. Texas seeds growing turrets " +
      "with tops between −5 and −10 °C, and this layer's mask has no cold edge " +
      "at all, so it admits a young turret and an anvil-topped complex alike. " +
      "The outline is the first thing here that separates them, and it does it " +
      "with a measurement rather than a cutoff nobody can cite.",
    "It cannot rule anything out, and the reason is geometry rather than " +
      "caution. The classification is of the cloud top, and the seeding band " +
      "is inside the cloud, so it never sees the thing this layer claims. It " +
      "also describes the highest deck only: cirrus over a growing turret " +
      "reads as frozen, and the turret underneath is invisible to it. So green " +
      "outside the outline is still a candidate, and one scene still cannot " +
      "say whether a cloud is growing. Where no phase scan can be read the " +
      "panel says so rather than showing zeroes.",
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
      "forecast hour on the slider. Read at 3 km and contoured into nested " +
      "bands.",
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
  StormLegend,
  LiquidLegend,
  CloudTopLegend,
  CloudBaseLegend,
  RadarLegend,
  CloudCoverLegend,
  PrecipLegend,
];
