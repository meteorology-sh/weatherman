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

/** Which of the two analysis hours a flare sits between had the condition. */
export type Presence = "both" | "one" | "neither" | "unusable";

export type Tally = Record<Presence, number>;

/* ---------- regions ---------- */

/**
 * One weather modification programme.
 *
 * `evaluable` is false until its reports have been parsed into a flight record.
 * Texas licenses several programmes and only one has been read so far, so a
 * region that cannot be evaluated is still listed — the list is the honest
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
  /** What this programme briefs on — balloon sites, or a model column. */
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
  /** Bottom and top of the band the balloon measured, metres. */
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

/* ---------- finding 2 ---------- */

export type Test = { key: string; label: string };

export type OverlapFinding = {
  tests: Test[];
  releases: number;
  usable: number;
  tallies: Record<string, Tally>;
  rain: {
    surviving: number;
    raining: number;
    readings: number;
    low: number | null;
    median: number | null;
    high: number | null;
    atOrOver: number;
  };
  days: {
    date: string;
    flares: number;
    hours: number;
    tallies: Record<string, Tally>;
  }[];
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
  scored: boolean;
  /** Whether the painted frames exist yet — `node eval/paint.mjs <date>`. */
  painted: boolean;
  present: number | null;
  briefing: Briefing | null;
};

export type Verdict =
  | "noLiquid"
  | "noCloudBase"
  | "baseAboveBand"
  | "noCloudSeen"
  | "topTooWarm"
  | "raining"
  | "candidate";

/** What the join read over one cell at one hour. */
export type Answer = {
  verdict: Verdict;
  slwGM2: number | null;
  cloudBaseFt: number | null;
  cloudTopC: number | null;
  topPhase: string | null;
  dbz: number | null;
  validTime: string | null;
  sceneTime: string | null;
  radarTime: string | null;
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
  hours: { from: string; to: string; into: number } | null;
  present: Record<string, Presence> | null;
  lo: Answer | null;
  hi: Answer | null;
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
  /** The band's value, which is what matches it to a colour. */
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

/** How far a release was from one layer, in kilometres. Zero means inside. */
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
  /** Which hours had the condition, for lining one release up against the table. */
  present: Record<string, Presence> | null;
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
  cellKm: number;
  flares: number;
  layers: Record<string, LayerProximity>;
  offset: { median: number; worst: number } | null;
};

export type Painted = {
  date: string;
  region: string;
  window: { west: number; east: number; south: number; north: number };
  /** The grid the layers are contoured on — the yardstick for "near". */
  cellKm: number;
  layers: { key: string; name: string; property: string; unit: string }[];
  hours: string[];
  /** By hour, then by layer key. */
  frames: Record<string, Record<string, Frame>>;
  analyses: Analysis[];
  /** Computed by the eval server from the file above, never by the page. */
  proximity: Proximity;
};
