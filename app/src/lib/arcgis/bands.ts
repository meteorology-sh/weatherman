/**
 * What each layer's bands are, and what colour each is painted.
 *
 * Data only — no ArcGIS, no components. The renderers next door turn these into
 * symbols and the panel's ramps read the same arrays, so a swatch and a fill
 * cannot drift apart. Every band table mirrors the levels its service contours
 * on, named in the comment above it.
 */

/**
 * One contour level and the fill painted for it. The server emits one nested
 * MultiPolygon per level, so they stack: an area meeting the top level is
 * painted by every band, an area meeting only the first by one. Keeping each
 * fill faint lets the stacking do the shading and keeps the basemap readable
 * underneath, which is the whole reason these are vectors rather than a raster.
 */
export type Band = { readonly value: number; readonly alpha: number };

/**
 * Cloud-cover isopleths, percent. Must stay in step with FIELDS.clouds.levels in
 * server/src/lib/services/hrrr/forecast.ts — the server decides which contours exist
 * and this decides how they are painted. Overcast tops out near 47% opacity,
 * not 100%.
 *
 * There is deliberately no 10% band: on a normal day ~65% of the country has
 * at least 10% cloud, so drawing it veils the map for no information.
 */
export const CLOUD_BANDS: readonly Band[] = [
  { value: 30, alpha: 0.1 },
  { value: 50, alpha: 0.13 },
  { value: 70, alpha: 0.16 },
  { value: 90, alpha: 0.2 },
];

/**
 * Precipitation-rate isopleths, mm/hr, mirroring FIELDS.precip.levels. The NWS
 * intensity classes: trace, light, moderate, heavy.
 *
 * These run more opaque than the cloud bands and it is still the same strategy.
 * Rain covers ~2% of the country against cloud's ~65%, so the veiling risk that
 * caps the cloud ramp does not apply — and where it is raining is the strongest
 * "do not seed here" signal on the map. Heavy rain tops out near 60% opacity,
 * so the basemap still reads through the worst cell on the map.
 */
export const PRECIP_BANDS: readonly Band[] = [
  { value: 0.1, alpha: 0.15 },
  { value: 0.5, alpha: 0.18 },
  { value: 2.5, alpha: 0.22 },
  { value: 7.6, alpha: 0.26 },
];

/**
 * The seeding band, mirroring SEEDING in server/src/lib/services/hrrr/slw.ts.
 *
 * Every caption, legend bracket and readout that names the band reads it from
 * here. Keep it that way — the band moves, and a hardcoded copy of it goes
 * stale silently.
 *
 * −5 °C is a physical threshold (AgI barely nucleates ice above it). −18 °C is
 * a judgement about where supercooled liquid stops being worth looking for —
 * see the server's note for what that choice trades.
 */
export const BAND_WARMEST_C = -5;
export const BAND_COLDEST_C = -18;

/** The band in the app's own typography, e.g. "−5 to −18 °C". */
export const BAND_LABEL = `${BAND_WARMEST_C} to ${BAND_COLDEST_C} °C`.replace(
  /-/g,
  "−"
);

/**
 * Supercooled liquid water path in the seeding band, g/m^2, mirroring
 * SEEDING.levels in server/src/lib/services/hrrr/slw.ts. This is the seedability
 * signal itself, so unlike the other two layers the bands mean "worth flying
 * to", not "how much weather".
 *
 * Drawn over GOES Band 13 imagery rather than the basemap, which is a darker
 * backdrop than either forecast layer gets — hence the slightly stronger fills.
 * The top band still lands near 60% opacity, so cloud-top structure reads
 * through the richest cell on the map.
 */
export const SLW_BANDS: readonly Band[] = [
  { value: 10, alpha: 0.15 },
  { value: 50, alpha: 0.18 },
  { value: 150, alpha: 0.22 },
  { value: 400, alpha: 0.26 },
];

/**
 * The candidate field, g/m², mirroring CANDIDATE.levels in
 * server/src/lib/services/candidate/field.ts — which are SLW_BANDS' levels, because
 * the candidate field *is* the liquid field with the other criteria applied.
 *
 * Same levels, same nesting, deliberately stronger fills. This is the answer
 * the map exists to give, it covers a fraction of the ground the liquid layer
 * does, and it is drawn over the top of it — so where both are on, amber
 * showing through with no green over it is liquid the join rejected.
 */
export const CANDIDATE_BANDS: readonly Band[] = [
  { value: 10, alpha: 0.2 },
  { value: 50, alpha: 0.24 },
  { value: 150, alpha: 0.28 },
  { value: 400, alpha: 0.32 },
];

/**
 * Emerald, and the last hue this map has. Slate is cloud shape, violet is
 * cloud base, amber is modelled liquid, cyan is rain. The candidate field is a
 * fifth claim — "every test passed here" — and borrowing any of the four would
 * read as one of them. Green is also the only hue on the map that means go.
 */
export const CANDIDATE_RGB = [52, 211, 153] as const;

/**
 * The outline around candidate ground the satellite still sees liquid at the
 * top of.
 *
 * **A line, not a fill, and the same hue as what it encloses.** It marks which
 * part of the green has an observation behind it rather than a different
 * quantity, so it must not read as a sixth claim on the map — a new colour
 * would. Near-white emerald reads as emphasis on the green it sits on.
 *
 * Wide enough to survive over four composited fills and thin enough that a
 * small patch is still a patch rather than a blob of line.
 */
export const CONFIRMED_RGB = [209, 255, 232] as const;
export const CONFIRMED_WIDTH = 1.5;

/** Heading dart at the heaviest-rain cell. White on the dark basemap. */
export const MOTION_RGB = [255, 255, 255] as const;

/** GLM flash. Yellow so it is not the cyan rain and not the white arrow. */
export const LIGHTNING_RGB = [250, 204, 21] as const;

/**
 * Observed reflectivity, dBZ, mirroring REFLECTIVITY.levels in
 * server/src/lib/services/mrms/radar.ts. The NWS intensity classes: light, moderate,
 * heavy, and the top band where a summer cell is producing hail.
 *
 * Same alphas as the liquid-water bands because they share the candidate map and
 * are drawn over the same imagery — and because the two are meant to be read
 * *against* each other. Amber with cyan through it is a candidate that is
 * already raining itself out, which is the one combination on this map that says
 * "not this one".
 */
export const RADAR_BANDS: readonly Band[] = [
  { value: 20, alpha: 0.15 },
  { value: 30, alpha: 0.18 },
  { value: 40, alpha: 0.22 },
  { value: 50, alpha: 0.26 },
];

/**
 * First forecast hour with precipitation. Mirrors FIELDS.precip.firstHour on the
 * server: HRRR diagnoses PRATE by integrating a timestep forward, so the
 * analysis carries none and the layer has nothing to draw at f00.
 *
 * Supercooled liquid water has no equivalent: a mixing ratio is a state the
 * analysis holds, so CLWMR is real at f00 and the candidate map can show it for
 * "right now".
 */
export const PRECIP_FIRST_HOUR = 1;

/**
 * Fill colours. Cloud is the neutral veil; rain is the one thing drawn on top
 * of it, so it gets a hue cloud can never be confused for. One hue per layer,
 * shaded by the stacking — a multi-hue ramp cannot work here, because a heavy
 * cell is painted by all four bands at once and the hues would blend.
 *
 * Liquid water is amber because it shares the candidate map with Band 13, whose
 * published GIBS ramp already spends cyan and green on cloud-top temperature.
 */
export const CLOUD_RGB = [255, 255, 255] as const;
export const PRECIP_RGB = [34, 211, 238] as const;
export const SLW_RGB = [251, 191, 36] as const;

/**
 * Radar reflectivity is painted the same cyan as forecast precipitation,
 * deliberately: it is the same quantity, and the two never share a map. On
 * `/map/forecast` cyan is what the model says will fall; on `/map/candidate` it
 * is what a radar just watched fall. Giving observed rain its own hue would
 * imply it is a different variable.
 */
export const RADAR_RGB = PRECIP_RGB;

/**
 * Alpha of the first n bands painted over each other. Fills composite
 * multiplicatively, so a legend has to as well or it misreports the map.
 */
export const stackedAlpha = (bands: readonly Band[], n: number) =>
  1 - bands.slice(0, n).reduce((acc, b) => acc * (1 - b.alpha), 1);

/** `rgba(...)` for the first n bands stacked — what the map actually paints. */
export const stackedColor = (
  bands: readonly Band[],
  rgb: readonly number[],
  n: number
) => `rgba(${rgb.join(",")},${stackedAlpha(bands, n).toFixed(3)})`;

/**
 * One cloud-top temperature band: the warm edge of the interval, in degrees
 * below zero, and the fill painted for it.
 *
 * **These do not stack**, and that is the whole design. Every other polygon
 * layer here nests — an area meeting the top level is painted by every band —
 * because its field has rare extremes and "more" means "more". Cloud-top
 * temperature is bimodal instead: warm low cloud, or very cold cirrus, with
 * little between. Nested levels there cover nearly the same ground as each
 * other — four rings almost exactly on top of each other, painting a third of
 * the map at full opacity.
 *
 * So exactly one band applies to a cell, each carries the colour it is actually
 * drawn in, and the legend reads them straight rather than compositing them.
 */
export type CloudTopBand = {
  /** Warm edge of the interval, °C below zero. Matches the server's property. */
  readonly value: number;
  /** Warm and cold edges as temperatures, for the legend. */
  readonly fromC: number;
  readonly toC: number | null;
  readonly label: string;
  readonly alpha: number;
};

/**
 * Slate, deliberately colourless. This layer answers "where is cloud, and how
 * cold is its top" — context for the two layers drawn over it, not a verdict.
 * Amber is spent on modelled liquid water and cyan on observed rain; giving
 * cloud shape a hue of its own would compete with both for attention it does
 * not deserve.
 */
export const CLOUD_TOP_RGB = [148, 163, 184] as const;

/**
 * Mirrors CLOUD_TOP.levels in server/src/lib/services/goes/cloudtop.ts.
 *
 * **The opacity ramp runs backwards from every other layer here, on purpose,
 * and the reason is the ice.** Silver iodide only does something in a cloud
 * that still holds liquid. Natural ice-nucleating particles are scarce at warm
 * subzero temperatures and common well below them, so the colder a top is, the
 * likelier that cloud has already frozen on its own — and a cloud that has
 * frozen has already spent the water seeding would have converted. The warmest
 * band is the loudest because that is where the liquid is most likely still
 * there to work with.
 *
 * **This is a preference, not a test.** A colder top also means the seeding
 * band is more fully enclosed by the cloud, which cuts the other way, and
 * cloud-top temperature is the coldest part of a cloud rather than a summary of
 * it — a vigorous cell with a −60 °C anvil can carry liquid in the band. So
 * nothing is discarded for being cold and the last band is open-ended and still
 * drawn. Neither this layer nor the liquid one observes phase; the liquid layer
 * is at least about the liquid, and it is the model's opinion rather than a
 * measurement. See `MEASUREMENTS.md` §4 for the citation and for why there is
 * no cold cutoff.
 *
 * **The steps are wide because these bands do not stack.** The nested layers
 * get their separation for free — their fills composite, so four alphas of 0.15
 * to 0.26 land on the map as 0.15, 0.30, 0.46, 0.60. A disjoint band is painted
 * at the alpha written here and nothing else, so the alphas have to carry the
 * whole spread themselves. Slate is nearly colourless over a dark basemap, so
 * anything narrower separates the four bands by a few points of grey and the
 * layer reads as one flat wash.
 */
export const CLOUD_TOP_BANDS: readonly CloudTopBand[] = [
  { value: 5, fromC: -5, toC: -12, label: "−5 to −12", alpha: 0.65 },
  { value: 12, fromC: -12, toC: -18, label: "−12 to −18", alpha: 0.45 },
  { value: 18, fromC: -18, toC: -25, label: "−18 to −25", alpha: 0.28 },
  { value: 25, fromC: -25, toC: null, label: "below −25", alpha: 0.14 },
];

/**
 * `rgba(...)` for one unstacked band — what a single swatch is painted.
 *
 * The stacked layers cannot use this: their fills composite, so a legend has to
 * ask `stackedColor` what the map actually ends up painting. Only the disjoint
 * cloud-top bands are drawn one-for-one like this.
 */
export const soloColor = (rgb: readonly number[], alpha: number) =>
  `rgba(${rgb.join(",")},${alpha.toFixed(3)})`;

/**
 * The window Texas operations select cloud bases in, ft MSL. Mirrors
 * BASE_WINDOW_FT in server/src/lib/services/hrrr/diagnostics.ts.
 *
 * A cited figure the candidate summary reports and nothing draws. Read as MSL a
 * fixed window means a different thing over every cell — it is 3,997–11,997 ft
 * above ground at Galveston and underground to 1,827 ft above ground at
 * Leadville — so it describes Texas cloud rather than bounding this map.
 */
export const BASE_WINDOW_FT = [4000, 12000] as const;

/**
 * The drone's service ceiling, ft MSL. Mirrors CEILING_FT in
 * server/src/lib/services/shared/aircraft.ts — the server bands cloud base on
 * this edge and every caption here reads it from this one place.
 *
 * A property of the airframe, so unlike the window above it is the same number
 * over Denver as over Galveston. That is what makes it the one height claim
 * this map can draw across the whole domain.
 */
export const CEILING_FT = 18000;

/**
 * One cloud-base band: its lower edge in ft MSL, and the fill painted for it.
 *
 * **Disjoint, like the cloud-top bands.** A height is a position rather than an
 * accumulation, so exactly one band applies to a cell and nothing nests.
 */
export type CloudBaseBand = {
  readonly value: number;
  readonly label: string;
  readonly alpha: number;
};

/**
 * Violet, and the last hue this map has left. Slate is cloud shape, amber is
 * modelled liquid water, cyan is observed rain; cloud base is a fourth claim
 * and cannot borrow any of the three without reading as one of them.
 */
export const CLOUD_BASE_RGB = [167, 139, 250] as const;

/**
 * Mirrors CLOUD_BASE.edges in server/src/lib/services/hrrr/diagnostics.ts —
 * thirds of the service ceiling, so every edge traces to that one cited number.
 *
 * **The ramp runs loud-to-quiet, like the cloud tops and for the same reason.**
 * Brightness is not the height, it is how much of a climb there is before there
 * is cloud to work with: the lowest base is the least of it, so it is the
 * loudest. Reading brightness as the magnitude of the number would put the ramp
 * exactly the wrong way round, which is why this note exists.
 *
 * The last band is open above the ceiling and still drawn. A base too high to
 * reach and no cloud at all are different answers, and leaving the first blank
 * would make them the same.
 *
 * The steps are wide because these bands do not composite — see the cloud-top
 * note above for why a disjoint band has to carry its whole separation in the
 * alpha written here.
 */
const THIRD_OF_CEILING = CEILING_FT / 3;

export const CLOUD_BASE_BANDS: readonly CloudBaseBand[] = [
  {
    value: 0,
    label: `under ${THIRD_OF_CEILING / 1000}k`,
    alpha: 0.6,
  },
  {
    value: THIRD_OF_CEILING,
    label: `${THIRD_OF_CEILING / 1000}–${(2 * THIRD_OF_CEILING) / 1000}k`,
    alpha: 0.42,
  },
  {
    value: 2 * THIRD_OF_CEILING,
    label: `${(2 * THIRD_OF_CEILING) / 1000}–${CEILING_FT / 1000}k`,
    alpha: 0.26,
  },
  {
    value: CEILING_FT,
    label: `over ${CEILING_FT / 1000}k`,
    alpha: 0.12,
  },
];

/** The words an operator reads, not the raw number. Parallel to PRECIP_BANDS. */
export const PRECIP_LABELS = ["trace", "light", "moderate", "heavy"] as const;

/**
 * Parallel to SLW_BANDS. These are seeding judgements, not measurements: a cloud
 * carrying under ~50 g/m^2 of supercooled liquid is not worth a sortie, and the
 * top band is where the classic glaciogenic-seeding literature puts a strong
 * target.
 */
export const SLW_LABELS = ["trace", "marginal", "good", "prime"] as const;

/**
 * Parallel to CANDIDATE_BANDS. The same words as SLW_LABELS, because it is the
 * same quantity on the same levels — what differs is that these cells passed
 * every other test, not how much water is in them.
 */
export const CANDIDATE_LABELS = SLW_LABELS;

/**
 * Parallel to RADAR_BANDS. The NWS reflectivity classes, in the words an
 * operator reads: 20 dBZ is drizzle you could fly through, 50 is a cell with
 * hail in it.
 */
export const RADAR_LABELS = ["light", "moderate", "heavy", "intense"] as const;
