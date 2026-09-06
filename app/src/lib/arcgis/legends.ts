// ArcGIS
import {
  BAND_LABEL,
  BASE_WINDOW_FT,
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
   * Compact facts: what it measures and how it is sampled. The Definitions
   * dropdown and the About page both print these lines.
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

export const BaseWindowLegend: LayerLegend = {
  name: "BASE WINDOW",
  source: "NOAA HRRR",
  summary: `Cloud bottoms ${BASE_WINDOW_LABEL} above the ground — the layer a seeding aircraft can reach and work in.`,
  detail: [
    "The same modelled cloud base, measured from the ground rather than " +
      "from sea level — height above ground level, or AGL — and shaded only " +
      `where the bottom of the cloud falls inside the ${BASE_WINDOW_LABEL} ` +
      "window Texas seeding aircraft fly.",
    "National fill: it is drawn everywhere the model runs, not only over " +
      "Texas, so the window can be read across a state line.",
  ],
};

export const CloudBaseLegend: LayerLegend = {
  name: "CLOUD BASE",
  source: "NOAA HRRR",
  summary: "The height of the bottom of the lowest cloud deck, in feet above sea level (MSL).",
  detail: [
    "An estimate from the High-Resolution Rapid Refresh (HRRR), a weather " +
      "model the National Oceanic and Atmospheric Administration (NOAA) " +
      "re-runs every hour over squares 3 kilometres across. Modelled rather " +
      "than measured: no instrument reports the bottom of a cloud everywhere " +
      "at once.",
    "Heights are above sea level (MSL), and the colour bands split the " +
      `aircraft's ceiling of ${CEILING_LABEL} into thirds. Because the ` +
      "reference is the sea and not the ground, the same cloud reads " +
      "thousands of feet higher over west Texas than over the coast.",
    `The switch under this layer redraws the field as height above the ` +
      `ground and shades only the ${BASE_WINDOW_LABEL} window an aircraft ` +
      "can work in. Clicking the map reports the height above the ground " +
      "either way.",
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
    "The storm map does not draw this as a fill. A click reports the " +
      "coldest GOES top over that storm and whether it cooled. Echo top " +
      "is the top of precipitating drops, a different height, under radar.",
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
    "How hard rain is falling right now, seen by ground radar. Bigger, " +
    "heavier drops send back a stronger echo.",
  detail: [
    "Measured, not modelled. The National Oceanic and Atmospheric " +
      "Administration (NOAA) merges every weather radar in the country into " +
      "one picture, the Multi-Radar/Multi-Sensor mosaic (MRMS), refreshed " +
      "every two minutes on a grid of squares 1 kilometre across.",
    "Echo strength is reported in decibels of reflectivity (dBZ). Rain you " +
      `would notice falling starts near ${RADAR_BANDS[0].value} dBZ, and the ` +
      "darkest band is a downpour that may be carrying hail. Any connected " +
      "patch of rain is treated as a single storm.",
    "The candidate map averages four 1 km cells and rounds, which softens " +
      "the blocky edges; evaluation maps keep the native squares so the " +
      "picture matches the raw feed.",
    "Three switches sit under this layer. The core is the heaviest rain in " +
      "a storm; the arrow is the direction the storm has moved since the " +
      "previous picture; and the orange upwind raining flank is the side new " +
      "cloud is being fed into. Storms smaller than 16 square kilometres are " +
      "left out.",
    "Lightning shows flashes from the last five minutes, seen by the " +
      "Geostationary Lightning Mapper (GLM) aboard NOAA's GOES-East weather " +
      "satellite.",
    "Echo past freezing marks storms whose 18 dBZ echo top — the highest " +
      "point at which radar still sees raindrops — has reached air colder " +
      "than freezing.",
  ],
};

export const HeadingLegend: LayerLegend = {
  name: "CORE, HEADING, AND FLANK",
  source: "NOAA MRMS",
  summary:
    "The heaviest rain in a storm, the direction it is moving, and its " +
    "upwind raining edge, where new cloud is being fed in.",
  detail: [
    "The core is the strongest echo in the storm. The arrow is the " +
      "direction and speed it has travelled since the previous radar " +
      "picture, two minutes earlier. The orange line is the upwind raining " +
      "edge. Storms smaller than 16 square kilometres are left out.",
  ],
};

export const EchoFreezeLegend: LayerLegend = {
  name: "ECHO PAST FREEZING",
  source: "NOAA MRMS + NOAA HRRR",
  summary:
    "Storms lifting rain high enough that the top of the radar echo, its " +
    "18 dBZ top, sits in air colder than freezing.",
  detail: [
    "The echo top is the highest point at which radar still sees " +
      "raindrops, read here at an echo strength of 18 dBZ. That part is " +
      "measured by the national radar mosaic.",
    "The freezing level is the height at which the air first falls to " +
      "0 °C. That part comes from the hourly weather model, so it is an " +
      "estimate.",
    "Where the echo top is at or above the freezing level, the storm is " +
      "carrying water up into cold air, which is the situation seeding is " +
      "meant to work on.",
  ],
};

export const LightningLegend: LayerLegend = {
  name: "LIGHTNING",
  source: "NOAA GOES-East GLM",
  summary: "Lightning flashes seen from orbit in the last five minutes.",
  detail: [
    "Each point is one flash recorded by the Geostationary Lightning " +
      "Mapper (GLM), an instrument aboard NOAA's GOES-East weather " +
      "satellite, within the last five minutes.",
  ],
};

export const CandidateLegend: LayerLegend = {
  name: "SEEDING OPPORTUNITY",
  source: "NOAA HRRR + NOAA MRMS",
  summary:
    "Where three tests pass at once: the cloud sits in the flyable base " +
    "window, its radar echo reaches past freezing, and rain is already " +
    "falling nearby.",
  detail: [
    "Green marks a square 3 kilometres across where every test passed. " +
      `First, the bottom of the cloud is ${BASE_WINDOW_LABEL} above the ` +
      "ground, so an aircraft can fly to it.",
    "Second, radar nearby shows an 18 dBZ echo top at or above the " +
      "freezing level, so the storm is carrying water into cold air.",
    `Third, rain of at least ${RADAR_BANDS[0].value} dBZ is falling nearby, ` +
      "so the cloud is already producing rather than only promising to.",
    "Clicking a green square reports FLY along with the numbers behind the " +
      "call. The cloud figures are modelled and the radar figures are " +
      "measured.",
  ],
};

export const CloudCoverLegend: LayerLegend = {
  name: "CLOUD COVER",
  source: "NOAA HRRR",
  summary: "How much of the sky is covered by cloud, as a percentage.",
  detail: [
    "A forecast from the High-Resolution Rapid Refresh (HRRR), the hourly " +
      "weather model run by the National Oceanic and Atmospheric " +
      "Administration (NOAA), on a grid of squares 3 kilometres across.",
    "Drawn for the present hour and each of the next 18 hours. The " +
      "thinnest cloud is left off, so a lightly hazy sky does not veil the " +
      "whole map.",
  ],
};

export const PrecipLegend: LayerLegend = {
  name: "PRECIPITATION",
  source: "NOAA HRRR",
  summary: "How much rain the model expects to fall in an hour, in millimetres.",
  detail: [
    "A forecast from the same hourly weather model as cloud cover, the " +
      "High-Resolution Rapid Refresh (HRRR). The four bands are the " +
      "National Weather Service intensity classes: trace, light, moderate " +
      "and heavy.",
    "The present hour is always empty. The model works this number out by " +
      "adding rainfall up over a step forward in time, so it does not exist " +
      "until the first forecast hour.",
  ],
};

/**
 * Every layer the app names, in the order the About page reads them: the
 * storm first, then the readings on it, then the quiet-liquid join, then
 * the forecast map's two.
 *
 * The About page and the legend tests both walk this, so a new layer cannot be
 * added without a page section and the checks that come with it.
 */
export const CapeLegend: LayerLegend = {
  name: "CAPE",
  source: "NOAA HRRR",
  summary:
    "Mixed-layer convective available potential energy — how much a turret has to grow on.",
  detail: [
    "Surface-based CAPE is on the click. This layer is the mixed-layer " +
      "parcel, the one a turret grows out of, in J/kg. The bands are the " +
      "NWS instability classes at 1,000, 2,500 and 4,000 J/kg.",
    "Modelled. Not a severity gate. Quiet air is blank rather than a " +
      "zero fill, so the map shows where there is energy to work with. " +
      "CIN is a switch under this layer.",
  ],
};

export const CinLegend: LayerLegend = {
  name: "CIN",
  source: "NOAA HRRR",
  summary:
    "Mixed-layer convective inhibition — how much a parcel has to work through before it is free.",
  detail: [
    "HRRR stores CIN as zero or negative. The map reports the magnitude, " +
      "in J/kg, on the NWS classes at 50, 100 and 200. A cell with no " +
      "inhibition is blank.",
    "Modelled. Not a gate. The switch lives under CAPE and does nothing " +
      "while that layer is off.",
  ],
};

export const LclLegend: LayerLegend = {
  name: "LCL",
  source: "NOAA HRRR",
  summary:
    "Lifting condensation level, ft MSL — the height a surface parcel saturates if lifted.",
  detail: [
    "Geopotential height of the lifting condensation level, in feet " +
      "above the sea. The bands are thirds of the service ceiling, the " +
      "same edges as cloud base, so the two ramps compare.",
    "LCL is not cloud base. Cloud base is where HRRR diagnoses cloud. " +
      "This is where a lifted parcel would saturate. They often sit near " +
      "each other and they are not the same number. The switch lives " +
      "under cloud base and does nothing while that layer is off.",
  ],
};

export const FreezingLegend: LayerLegend = {
  name: "FREEZING LEVEL",
  source: "NOAA HRRR",
  summary:
    "The 0 °C isotherm, ft MSL — the height the 12Z balloon table prints.",
  detail: [
    "Taken from the same temperature profile already matched to the " +
      "Midland and Del Rio balloons. The bands are thirds of the " +
      "service ceiling, so the ramp is a height, not a targeting cutoff.",
    "A column that never crosses freezing is blank. That is a real " +
      "answer, not a missing download. Minus fifteen and warm-cloud " +
      "depth are switches under this layer.",
  ],
};

export const Minus15Legend: LayerLegend = {
  name: "MINUS FIFTEEN",
  source: "NOAA HRRR",
  summary:
    "The −15 °C isotherm, ft MSL — the cold edge the 12Z balloon table prints.",
  detail: [
    "The height Texas programmes print next to freezing. Distinct from " +
      "the seeding band's cold edge, which is −18 °C. Same temperature " +
      "profile as the freezing layer, same ceiling-third bands.",
    "A column that never reaches −15 °C is blank. The switch lives " +
      "under freezing level and does nothing while that layer is off.",
  ],
};

export const WarmDepthLegend: LayerLegend = {
  name: "WARM CLOUD DEPTH",
  source: "NOAA HRRR",
  summary:
    "Freezing level minus cloud base, in feet — how deep the warm cloud is.",
  detail: [
    "Depth, labelled as depth. Hygroscopic targeting looks at this " +
      "number; drawing it is not promoting salt to a candidate field. " +
      "A cell whose base sits at or above freezing has no warm cloud " +
      "and is blank.",
    "Cloud base is the model's deck. Freezing is the 0 °C isotherm. " +
      "The difference is only defined where both exist and the base is " +
      "the lower of the two. The switch lives under freezing level and " +
      "does nothing while that layer is off.",
  ],
};

export const ALL_LEGENDS: readonly LayerLegend[] = [
  RadarLegend,
  EchoFreezeLegend,
  CloudBaseLegend,
  BaseWindowLegend,
  CandidateLegend,
  CloudCoverLegend,
  PrecipLegend,
];
