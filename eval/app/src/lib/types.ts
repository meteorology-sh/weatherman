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

/** Whether a condition survived both readings a flare sits between. */
export type Outcome = "held" | "flipped" | "absent" | "unusable";

export type Tally = Record<Exclude<Outcome, never>, number>;

/* ---------- regions ---------- */

/**
 * One weather modification programme.
 *
 * `evaluable` is false until its reports have been parsed into a flight record.
 * Texas licenses several programmes and only one has been read so far, so a
 * region that cannot be evaluated is still listed — the roster is the honest
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
    vetoed: number;
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
  temp700Mb: number | null;
};

export type DaySummary = {
  date: string;
  flares: number;
  unlocated: number;
  observations: number;
  scored: boolean;
  /** Whether the painted frames exist yet — `node eval/held.mjs <date>`. */
  painted: boolean;
  held: number | null;
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
  payload: "glaciogenic" | "hygroscopic" | "both";
  bracket: { from: string; to: string; into: number } | null;
  held: Record<string, Outcome> | null;
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
 * Where the air over a release point had gone by the end of the bracket.
 *
 * HRRR's own 0–6 km storm motion at that cell, carried forward at constant speed
 * and bearing. `to` is null when the model has the air standing still, because a
 * bearing off a still vector is not a direction.
 */
export type Drift = {
  stormMotionKt: number | null;
  stormMotionTowardDeg: number | null;
  hours: number;
  km?: number;
  to: [number, number] | null;
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
  held: Record<string, Outcome> | null;
  drift: Drift | null;
};

export type Painted = {
  date: string;
  region: string;
  window: { west: number; east: number; south: number; north: number };
  layers: { key: string; name: string; property: string; unit: string }[];
  hours: string[];
  /** By hour, then by layer key. */
  frames: Record<string, Record<string, Frame>>;
  intervals: { from: string; to: string; flares: Flare[] }[];
};
