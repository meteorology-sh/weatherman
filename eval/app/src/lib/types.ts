/**
 * The shapes the eval server returns.
 *
 * These mirror `eval/server.mjs` field for field, the same way `/app`'s types
 * mirror the Weatherman server's. There is no shared package, so the contract
 * is maintained by hand on both sides.
 *
 * Weather shapes are not redeclared here — the map draws the product's own
 * layers through `@/lib/client`, so those types come from `@/lib/types`.
 */

// Types
import type { Diagnostics, SoundingLevel } from "@/lib/types";

/* ---------- regions ---------- */

/**
 * One weather modification program.
 *
 * `evaluable` is false until its reports have been parsed into a flight record.
 * A region that cannot be evaluated is still listed — the list is the honest
 * picture of coverage, and hiding the gaps would make one operator's season
 * look like the whole state.
 */
export type Region = {
  id: string;
  name: string;
  short: string;
  base: string | null;
  source: string | null;
  season: number | null;
  window: { west: number; east: number; south: number; north: number } | null;
  /** What this program briefs on — balloon sites, or a model column. */
  sounding: string[];
  evaluable: boolean;
  days: number;
  flares: number;
};

/* ---------- finding 1 ---------- */

export type Reading = {
  key: string;
  label: string;
  unit: string;
  n: number;
  bias: number;
  typical: number;
  worst: number;
  low: number;
  high: number;
};

export type Ascent = {
  date: string;
  site: string;
  /** Bottom and top of the band the balloon measured, meters. */
  measured: [number, number];
  /** The same two heights as we drew them. */
  ours: [number, number];
  depth: number;
  /** Shared height over combined height. 1 is the same layer. */
  fraction: number;
};

export type BandFinding = {
  sites: Record<string, { lat: number; lon: number; name: string }>;
  attempted: number;
  failed: number;
  readings: Reading[];
  overlap: {
    n: number;
    median: number;
    mean: number;
    worst: number;
    over90: number;
    over80: number;
    medianDepth: number;
  } | null;
  ascents: Ascent[];
};

/* ---------- days and releases ---------- */

export type Briefing = {
  freezingLevelFt: number | null;
  minus15HeightFt: number | null;
  /** The Panhandle's forecast column stops here; the balloons carry -15. */
  minus10HeightFt: number | null;
  temp700Mb: number | null;
};

export type DaySummary = {
  date: string;
  flares: number;
  unlocated: number;
  observations: number;
  /** Whether the painted frames exist yet — `node eval/paint.mjs <date>`. */
  painted: boolean;
  briefing: Briefing | null;
};

export type Release = {
  at: string;
  timeZ: string;
  lat: number;
  lon: number;
  county: string;
  plane: string;
  /** Null where the report says a flare was released and not how many. */
  payload: "glaciogenic" | "hygroscopic" | "both" | null;
};

export type Observation = {
  at: string;
  timeZ: string;
  said: string;
};

export type Day = {
  date: string;
  dayTotal: number | null;
  soundings: Record<string, Record<string, number>> | null;
  observations: Observation[];
  unlocated: { timeZ: string; county: string }[];
  painted: boolean;
  releases: Release[];
};

/* ---------- the painted frames ---------- */

export type PaintedLevel = {
  /** The band's value, which is what matches it to a color. */
  level: number;
  /** Polygons, each a list of rings, each a list of [lon, lat]. */
  polygons: [number, number][][][];
};

export type Frame = {
  validTime: string;
  levels: PaintedLevel[];
  /** Set when that layer could not be built for that hour. */
  error?: string;
};

/**
 * Where the air over a release point is at the analysis it is compared against.
 *
 * HRRR's own 0–6 km storm motion at that cell, carried over the signed offset
 * between the release minute and the analysis hour. `to` is null when the model
 * has the air standing still, because a bearing off a still vector is not a
 * direction.
 */
export type Drift = {
  stormMotionKt: number | null;
  stormMotionTowardDeg: number | null;
  offsetMinutes: number;
  km?: number;
  to: [number, number] | null;
};

/** How far a release was from one layer, in kilometers. Zero means inside. */
export type Nearness = {
  /**
   * What "any of this layer at all" meant here. Nested bands stack, so the
   * outermost contour is the whole layer; disjoint ones had to be unioned.
   */
  measuredTo: string;
  inside: boolean;
  km: number | null;
  /** The same distance without the drift correction, for comparison. */
  kmAtRelease: number | null;
  /** Distance to the nearest edge from either side, drifted and not. */
  edgeKm?: number | null;
  edgeKmAtRelease?: number | null;
  /**
   * When the frame this was measured against is true of. HRRR rounds to the
   * analysis hour; the radar and the satellite keep the scan minute, so the
   * two clocks are visible rather than averaged into one.
   */
  validTime: string | null;
  /** Minutes the release was carried to meet that frame. Signed. */
  offsetMinutes: number | null;
};

/**
 * The radar storm at a release, from `/candidate/storm`.
 *
 * Older painted files have no `storm` field. Null means that hour had no
 * 20 dBZ echo within about 40 km.
 */
export type StormAtFlare = {
  inside: boolean;
  coreKm: number | null;
  edgeKm: number | null;
  object: {
    id: number;
    maxDbz: number;
    areaKm2: number;
    ageMin: number | null;
    ageFloor: boolean;
    motionTowardDeg: number | null;
    motionKmh: number | null;
    areaDeltaKm2: number | null;
    coreLat?: number;
    coreLon?: number;
  } | null;
  slwGM2: number | null;
  goesTopC: number | null;
  goesTopDeltaC: number | null;
  glmFlashes: number | null;
  echoTopFt: number | null;
  modelEchoTopFt: number | null;
  freezingFt: number | null;
};

/**
 * What a click on the release point at its own minute would have said, from
 * `/candidate/point`.
 *
 * The same fields the operator panel prints under FLY or DON'T FLY. Null on a
 * flare means the point sits outside the model's grid, which is the answer the
 * map gives a click out there rather than an error.
 */
export type CellAtFlare = {
  validTime: string | null;
  radarTime: string | null;
  /** Start of the satellite scan read over this cell. Absent on older files. */
  sceneTime?: string | null;
  /** Start of the phase scan. Null where no scene could be read. */
  phaseTime?: string | null;
  /** The 3 km cell the click snapped to, not the release point. */
  lat?: number | null;
  lon?: number | null;

  /** "target" is the cell an operator is told to fly. */
  target: string | null;
  /**
   * Which flare the column supports: "ice", "salt" or "both". Absent on files
   * painted before the click reported it.
   */
  payload?: "ice" | "salt" | "both" | null;
  /** Base to freezing level, ft — the layer a salt flare works in. */
  warmCloudDepthFt?: number | null;
  /** The seeding-opportunity verdict from the liquid join, on the same cell. */
  verdict?: string | null;

  /** Merged cloud base, ft MSL — HRRR's own, or the CCL where it has none. */
  cloudBaseMslFt?: number | null;
  /** Which model height answered: "model" or "ccl". */
  baseSource?: "model" | "ccl" | null;
  /** Does the cloud-base layer fill this cell? */
  baseDrawn?: boolean;
  cloudBaseAglFt: number | null;
  /** HRRR's own base, ft MSL, before the CCL fallback. */
  cloudBaseFt?: number | null;
  /**
   * The convective condensation level, ft MSL, whether or not the merged base
   * took it. Absent on files painted before the click reported it.
   */
  cclFt?: number | null;

  echoTopFt: number | null;
  freezingFt: number | null;
  dbz: number | null;
  radarCovered: boolean;
  slwGM2: number | null;
  /** Observed cloud-top temperature, °C. */
  cloudTopC?: number | null;
  /** Observed cloud-top phase. Reported, never a gate. */
  topPhase?: string | null;
};

/**
 * The modeled column over the release, from `/forecast/sounding` at the
 * analysis the flare is charged to.
 *
 * `levels` is the profile whole, so the −15 °C height is interpolated here by
 * the product's own `heightAtC` rather than by a second rule.
 */
export type ColumnAtFlare = {
  validTime: string;
  surfaceFt: number | null;
  freezingFt: number | null;
  bandBaseFt: number | null;
  bandTopFt: number | null;
  levels: SoundingLevel[];
  diagnostics: Diagnostics | null;
};

export type PointMarks = {
  validTime: string;
  points: [number, number][];
  error?: string;
};

export type RingMarks = {
  validTime: string;
  rings: [number, number][][];
  error?: string;
};

/** One NWS warning in force: its kind and its polygon's rings. */
export type WarningMark = {
  /** VTEC phenomenon: SV severe thunderstorm, TO tornado, FF flash flood. */
  phenomenon: "SV" | "TO" | "FF";
  event: string;
  office: string;
  eventId: number;
  rings: [number, number][][];
};

export type WarningMarks = {
  validTime: string;
  warnings: WarningMark[];
  error?: string;
};

/** Cores, heading darts, lightning, and the warnings in force at one analysis. */
export type HourMarks = {
  cores: PointMarks;
  heading: RingMarks;
  lightning: PointMarks;
  /** Absent from a day painted before warnings were stored. */
  warnings?: WarningMarks;
};

export type Flare = {
  at: string;
  timeZ: string;
  lon: number;
  lat: number;
  county: string;
  plane: string;
  glaciogenic: number;
  hygroscopic: number;
  payload: string;
  /** Minutes from the release to its analysis. Negative means the analysis is earlier. */
  offsetMinutes: number | null;
  drift: Drift | null;
  /** Where the release point sits at the analysis time, after drifting. */
  compared: [number, number];
  near: Record<string, Nearness | null>;
  storm?: StormAtFlare | null;
  /** What a click on this release would have said. Absent on older files. */
  cell?: CellAtFlare | null;
  column?: ColumnAtFlare | null;
};

/** One analysis hour, and the releases charged to it. */
export type Analysis = { at: string; flares: Flare[] };

export type LayerProximity = {
  n: number;
  inside: number;
  withinCell: number;
  withinTwoCells: number;
  median: number | null;
  worst: number | null;
};

export type Proximity = {
  cellKm: number | Record<string, number>;
  flares: number;
  layers: Record<string, LayerProximity>;
  offset: { median: number; worst: number } | null;
};

/**
 * Layer distances over every painted day — `GET /region/:id/near`.
 *
 * The same per-layer counts the day chart uses, pooled across the season.
 * `rows` is one summary per painted day; the page does not re-derive either.
 */
export type NearFinding = {
  cellKm: number | Record<string, number>;
  days: number;
  flying: number;
  flares: number;
  located: number;
  layers: Record<string, LayerProximity>;
  offset: { median: number; worst: number } | null;
  rows: Array<{ date: string } & Proximity>;
};

export type Painted = {
  date: string;
  region: string;
  /** Which Weatherman API drew these fills. */
  server?: string;
  window: { west: number; east: number; south: number; north: number };
  /** Native cell size per layer, km. Older files carry a single number. */
  cellKm: number | Record<string, number>;
  layers: {
    key: string;
    name: string;
    property: string;
    unit: string;
    cellKm?: number;
  }[];
  hours: string[];
  /** The report's own sounding table for this day, where it printed one. */
  soundings?: Record<string, Record<string, number>> | null;
  observations?: Observation[];
  /** By hour, then by layer key. */
  frames: Record<string, Record<string, Frame>>;
  /** Cores, heading, and lightning at each analysis. Absent on older files. */
  marks?: Record<string, HourMarks>;
  analyses: Analysis[];
  /** Computed by the eval server from the file above, never by the page. */
  proximity: Proximity;
};
