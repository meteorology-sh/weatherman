// ArcGIS
import {
  BAND_LABEL,
  FLIGHT_WINDOW_FT,
  CEILING_FT,
  RADAR_BANDS,
} from "./bands";

/**
 * The prose half of a layer's legend: its name, where it comes from, the one
 * sentence the panel shows, and the longer read the About page shows. The
 * swatches themselves come from the renderer, so a color can never drift
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
   * Compact facts: what the layer is, what it is measured or modeled from,
   * its units and resolution, what it excludes, and what the switches under
   * it do. The Definitions dropdown and the About page both print these.
   *
   * A paragraph or two of plain description. No argument for the layer and
   * no reading of what it implies — the operator does that.
   */
  detail: readonly string[];
};

/** The window's edges as an operator reads them, e.g. "4,000–12,000 ft". */
export const FLIGHT_WINDOW_LABEL = `${FLIGHT_WINDOW_FT[0].toLocaleString(
  "en-US"
)}–${FLIGHT_WINDOW_FT[1].toLocaleString("en-US")} ft`;

/** The ceiling as an operator reads it, e.g. "18,000 ft". */
export const CEILING_LABEL = `${CEILING_FT.toLocaleString("en-US")} ft`;

export const CloudBaseLegend: LayerLegend = {
  name: "CLOUD BASE",
  source: "HRRR",
  summary: "The height of the lowest cloud deck, in feet above sea level (MSL).",
  detail: [
    `Modeled at 3 km resolution. The bands are thirds of the ${CEILING_LABEL} service ceiling.`,
  ],
};

export const LiquidLegend: LayerLegend = {
  name: "SUPERCOOLED LIQUID WATER",
  source: "HRRR",
  summary: `Liquid water held in the ${BAND_LABEL} band, in grams over each square meter of ground.`,
  detail: [
    `HRRR carries cloud water on 40 pressure levels. The server integrates the liquid content through temperatures in the ${BAND_LABEL} band.`,
    `The result is a column amount, not a concentration and not an area: g/m² is the whole depth of in-band liquid above a square meter of ground, so a thin rich layer and a deep thin one can read the same. The same figure answers a click on the map.`,
  ],
};

export const RadarLegend: LayerLegend = {
  name: "RADAR REFLECTIVITY",
  source: "MRMS",
  summary: `Rainfall intensity measured by ground radar. Larger drops return a stronger echo.`,
  detail: [
    `MRMS is a national radar mosaic, refreshed every two minutes at 1 km resolution.`,
    `Echo strength in decibels of reflectivity (dBZ), banded from ${RADAR_BANDS[0].value} dBZ. Three switches sit under this layer: core and heading, lightning, and echo past freezing.`,
  ],
};

export const HeadingLegend: LayerLegend = {
  name: "CORE AND HEADING",
  source: "MRMS",
  summary: "The heaviest rain in a storm and the direction it is moving.",
  detail: [
    `The core is the strongest echo cell in the storm. The vector illustrates the velocity and direction the storm has traveled since the previous radar scan, two minutes earlier.`,
    `Storms smaller than 16 km² are excluded.`,
  ],
};

export const EchoFreezeLegend: LayerLegend = {
  name: "ECHO PAST FREEZING",
  source: "MRMS + HRRR",
  summary: `Storms whose 18 dBZ echo top reaches freezing altitudes.`,
  detail: [
    `The echo top is the highest altitude at which radar detects raindrops, read here at 18 dBZ. It is measured. Joined with HRRR for the modeled freezing level 0 °C.`
  ],
};

export const LightningLegend: LayerLegend = {
  name: "LIGHTNING",
  source: "GOES-East GLM",
  summary: "Lightning flashes seen from orbit in the last five minutes.",
  detail: [
    `Each point is one flash detected in the last five minutes.`,
  ],
};

export const CandidateLegend: LayerLegend = {
  name: "SEEDING OPPORTUNITY",
  source: "HRRR + MRMS",
  summary: `Where three tests pass at once: the cloud base is under the aircraft's ceiling, its radar echo reaches past freezing, and rain is falling nearby.`,
  detail: [
    `Green marks a 3 km cell where three tests pass: cloud base below the ${CEILING_LABEL} service ceiling; an 18 dBZ echo top at or above the freezing level nearby; and reflectivity of at least ${RADAR_BANDS[0].value} dBZ nearby.`
,
    `There is no lower bound on the base. A low cloud is still cloud an aircraft can climb into, and the ceiling is read in feet above sea level, so terrain does not move it.`,
    `Clicking a cell reports a judgment call with the value behind each test.`,
  ],
};

export const CloudCoverLegend: LayerLegend = {
  name: "CLOUD COVER",
  source: "HRRR",
  summary: "How much of the sky is covered by cloud, as a percentage.",
  detail: [
    `Hourly modeled forecast at 3 km resolution, for the present hour and each of the next 18 hours.`
  ],
};

export const PrecipLegend: LayerLegend = {
  name: "PRECIPITATION",
  source: "HRRR",
  summary: "How much rain the model expects to fall in an hour, in millimeters.",
  detail: [
    `Forecast by the same hourly model as cloud cover. The four bands are the National Weather Service intensity classes: trace, light, moderate and heavy.`,
    `The present hour is empty. The value accumulates over a forecast step, so it does not exist at the analysis.`,
  ],
};

/**
 * Every layer the app names, in the order the About page reads them: the
 * storm first, then the readings on it, then the joined answer, then the
 * forecast map's two.
 *
 * The About page and the legend tests both walk this, so a new layer cannot be
 * added without a page section and the checks that come with it.
 */
export const ALL_LEGENDS: readonly LayerLegend[] = [
  RadarLegend,
  EchoFreezeLegend,
  CloudBaseLegend,
  LiquidLegend,
  CandidateLegend,
  CloudCoverLegend,
  PrecipLegend,
];
