/**
 * What each layer's bands are, and what color each is painted.
 *
 * Data only — no ArcGIS, no components. The renderers next door turn these into
 * symbols and the panel's ramps read the same arrays, so a swatch and a fill
 * cannot drift apart. Every band table mirrors the levels its service contours
 * on, named in the comment above it.
 */

/**
 * Every layer's base color. Change a hue here and the map and its legend follow;
 * the band tables below shade it by opacity.
 *
 * One hue per claim — borrowing another layer's reads as that layer:
 *
 * - `cloud` is the neutral veil.
 * - `rain` is forecast precipitation and observed radar alike: the same
 *   quantity, and the two never share a map.
 * - `liquid` is amber because GOES Band 13's GIBS ramp already spends cyan and
 *   green on cloud-top temperature.
 * - `cloudBase` is violet.
 * - `fly` is emerald, the only hue on the map that means go.
 * - `confirmed` outlines the part of the green with an observation behind it,
 *   so it is a near-white of that green rather than a new hue.
 * - `motion` is white on the dark basemap; `lightning` and `echoFreeze` are
 *   yellow and ice-blue so neither reads as the rain or the arrow.
 */
export const COLORS = {
  cloud: [255, 255, 255],
  rain: [34, 211, 238],
  liquid: [251, 191, 36],
  cloudBase: [167, 139, 250],
  fly: [52, 211, 153],
  confirmed: [209, 255, 232],
  echoFreeze: [56, 189, 248],
  lightning: [250, 204, 21],
  motion: [255, 255, 255],
} as const;

/** The single-fill layers, which have no band table to carry an alpha. */
export const FLY_ALPHA = 0.45;
export const ECHO_FREEZE_ALPHA = 0.28;

/** Outline width around confirmed ground, screen points. */
export const CONFIRMED_WIDTH = 1.5;

/**
 * Storm heading tick width, screen points: the heading is the same claim at
 * every zoom, so the tick is not sized in ground units.
 */
export const MOTION_WIDTH = 1.25;

/**
 * One contour level and the opacity its layer's color is painted at.
 *
 * One hue per layer, shaded by opacity — a multi-hue ramp cannot work, because
 * a heavy cell is painted by all four bands at once and the hues would blend.
 * The server emits one nested MultiPolygon per level, so they stack: an area
 * meeting the top level is painted by every band, an area meeting only the
 * first by one. Keeping each fill faint lets the stacking do the shading and
 * keeps the basemap readable underneath. Cloud base is the one disjoint table.
 */
export type Band = { readonly value: number; readonly alpha: number };

/**
 * Cloud-cover isopleths, percent, mirroring FIELDS.clouds.levels in
 * server/src/lib/services/hrrr/forecast.ts. Overcast tops out near 47% opacity.
 * There is no 10% band: ~65% of the country has at least 10% cloud on a normal
 * day, so drawing it veils the map for no information.
 */
export const CLOUD_BANDS: readonly Band[] = [
  { value: 30, alpha: 0.1 },
  { value: 50, alpha: 0.13 },
  { value: 70, alpha: 0.16 },
  { value: 90, alpha: 0.2 },
];

/**
 * Precipitation-rate isopleths, mm/hr, mirroring FIELDS.precip.levels — the NWS
 * intensity classes. More opaque than cloud because rain covers ~2% of the
 * country against cloud's ~65%; heavy rain still tops out near 60% opacity.
 */
export const PRECIP_BANDS: readonly Band[] = [
  { value: 0.1, alpha: 0.15 },
  { value: 0.5, alpha: 0.18 },
  { value: 2.5, alpha: 0.22 },
  { value: 7.6, alpha: 0.26 },
];

/**
 * Observed reflectivity, dBZ, mirroring REFLECTIVITY.levels in
 * server/src/lib/services/mrms/radar.ts — the NWS classes, the top band where a
 * summer cell is producing hail. The liquid-water alphas, because the two are
 * read against each other: amber with cyan through it is a candidate already
 * raining itself out.
 */
export const RADAR_BANDS: readonly Band[] = [
  { value: 20, alpha: 0.15 },
  { value: 30, alpha: 0.18 },
  { value: 40, alpha: 0.22 },
  { value: 50, alpha: 0.26 },
];

/**
 * Supercooled liquid water path in the seeding band, g/m², mirroring
 * SEEDING.levels in server/src/lib/services/hrrr/slw.ts. Drawn over Band 13
 * imagery, a darker backdrop than the basemap; the top band lands near 60%
 * opacity so cloud-top structure reads through the richest cell.
 */
export const SLW_BANDS: readonly Band[] = [
  { value: 10, alpha: 0.15 },
  { value: 50, alpha: 0.18 },
  { value: 150, alpha: 0.22 },
  { value: 400, alpha: 0.26 },
];

/**
 * Cloud base, ft MSL, keyed on the lower edges in MERGED_BASE.edges in
 * server/src/lib/services/candidate/cloudbase.ts: thirds of BASE_CEILING_FT,
 * the last band open above it. A base too high to work is still drawn, because
 * it and no cloud at all are different answers.
 *
 * **Disjoint.** A height is a position, not an accumulation, so the server cuts
 * each band out of the one above and exactly one paints a cell — each alpha is
 * the whole fill, not a step in a stack.
 *
 * **Brighter is lower**: the lowest base is the most opaque.
 */
export const CLOUD_BASE_BANDS: readonly Band[] = [
  { value: 0, alpha: 0.6 },
  { value: 6000, alpha: 0.45 },
  { value: 12000, alpha: 0.3 },
  { value: 18000, alpha: 0.15 },
];

/** The words an operator reads, not the raw number. Parallel to PRECIP_BANDS. */
export const PRECIP_LABELS = ["trace", "light", "moderate", "heavy"] as const;

/**
 * Parallel to SLW_BANDS. Seeding judgments, not measurements: under ~50 g/m²
 * is not worth a sortie, and the top band is where the glaciogenic-seeding
 * literature puts a strong target.
 */
export const SLW_LABELS = ["trace", "marginal", "good", "prime"] as const;

/** Parallel to RADAR_BANDS. 20 dBZ is drizzle you could fly through, 50 is hail. */
export const RADAR_LABELS = ["light", "moderate", "heavy", "intense"] as const;

/** Parallel to CLOUD_BASE_BANDS, ft MSL. */
export const CLOUD_BASE_LABELS = [
  "under 6k",
  "6–12k",
  "12–18k",
  "over 18k",
] as const;

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
 * `rgba(...)` for one unstacked band — what a disjoint band is painted. The
 * nested tables cannot use this; their legends ask `stackedColor`.
 */
export const soloColor = (rgb: readonly number[], alpha: number) =>
  `rgba(${rgb.join(",")},${alpha.toFixed(3)})`;

/**
 * The seeding band, mirroring SEEDING in server/src/lib/services/hrrr/slw.ts.
 * Every caption, legend bracket and readout that names the band reads it from
 * here — a hardcoded copy goes stale silently.
 *
 * −5 °C is a physical threshold (AgI barely nucleates ice above it). −18 °C is
 * a judgment about where supercooled liquid stops being worth looking for —
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
 * First forecast hour with precipitation, mirroring FIELDS.precip.firstHour:
 * HRRR diagnoses PRATE by integrating a timestep forward, so the analysis
 * carries none. CLWMR is a state the analysis holds, so liquid water is real
 * at f00.
 */
export const PRECIP_FIRST_HOUR = 1;

/**
 * The highest cloud base Texas operations will seed, ft above the ground,
 * mirroring SEEDABLE_BASE_FT in server/src/lib/services/hrrr/diagnostics.ts.
 * An upper bound only: rain from a higher base evaporates before it lands.
 * AGL because a fixed MSL bound means a different thing over every cell.
 */
export const SEEDABLE_BASE_FT = 12000;

/**
 * The drone's service ceiling, ft MSL, mirroring CEILING_FT in
 * server/src/lib/services/shared/aircraft.ts. A property of the airframe, the
 * same over Denver as over Galveston.
 */
export const CEILING_FT = 18000;

/**
 * The highest workable cloud base, ft MSL, mirroring BASE_CEILING_FT in
 * server/src/lib/services/candidate/cloudbase.ts. A judgment the seeding
 * opportunity makes; on the cloud-base ramp it is only where the last band
 * opens. It shares a number with the service ceiling and is not derived from it.
 */
export const BASE_CEILING_FT = 18000;
