/**
 * Which map a route is showing. Forecast is modelled; candidate is observed;
 * replay is the candidate set at a past hour rather than at this one.
 */
export type MapMode = "forecast" | "candidate" | "replay";

/** Mirrors ForecastMeta in server/src/lib/services/hrrr/forecast.ts */
export interface ForecastMeta {
  /** Model run, ISO 8601. */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
}

/** Mirrors Rejected in server/src/lib/services/candidate/join.ts */
export interface Rejected {
  /** The model has no cloud base over the cell — nothing to climb into. */
  noCloudBase: number;
  /** The base sits above the band's cold edge: the cloud is colder than the band. */
  baseAboveBand: number;
  /** The satellite sees no cloud at all, contradicting the model outright. */
  noCloudSeen: number;
  /** The observed top is warmer than −5 °C, so the band is above the cloud. */
  topTooWarm: number;
  /** Radar is already watching it precipitate. */
  raining: number;
}

/** Mirrors CloudPhase in server/src/lib/services/goes/phase.ts */
export type CloudPhase =
  "clear" | "liquid" | "supercooled" | "mixed" | "ice" | "unknown";

/** Mirrors PhaseCheck in server/src/lib/services/candidate/join.ts */
export interface PhaseCheck {
  /** Start of the phase scan, ISO 8601. Null when no scene could be read. */
  sceneTime: string | null;
  /** Candidate ground whose top is observed supercooled or mixed, km². */
  confirmedKm2: number;
  /** Candidate ground whose top the satellite already sees frozen, km². */
  glaciatedKm2: number;
  /** Candidate ground the observation neither confirms nor contradicts, km². */
  unresolvedKm2: number;
  /**
   * Ground with an observed supercooled top carrying less modelled in-band
   * liquid than the lowest contour draws, km². Routinely larger than the
   * candidate field: a thin supercooled deck can be honestly below it.
   */
  missedKm2: number;
}

/** Mirrors CandidateStats in server/src/lib/services/candidate/join.ts */
export interface CandidateStats {
  run: string;
  validTime: string;
  /** Start of the satellite scan the observed half came from. */
  sceneTime: string;
  /** Time of the radar scan that vetoed. */
  radarTime: string;
  /** Percent of the HRRR domain that passes every test. */
  coveragePct: number;
  /** Ground that passes every test, km². */
  candidateKm2: number;
  /** Richest candidate cell, g/m². */
  peak: number;
  /** Ground holding in-band liquid before the join, km². */
  liquidKm2: number;
  /** Ground each test removed, km². These partition liquidKm2 − candidateKm2. */
  rejected: Rejected;
  /** Candidate ground no radar covers, km² — unchecked rather than cleared. */
  blindKm2: number;
  /** Median cloud base over candidate ground, ft MSL. */
  medianBaseFt: number | null;
  /** Percent of candidate ground whose base is inside the operational window. */
  windowPct: number;
  /** Median height of the band's warm edge over candidate ground, ft MSL. */
  medianBandBaseFt: number | null;
  /** The ceiling reachability is reported against, ft MSL. */
  ceilingFt: number;
  /** Percent of candidate ground whose band base is below that ceiling. */
  reachablePct: number;
  /** Strongest mixed-layer CAPE over candidate ground, J/kg. */
  peakMixedCapeJKg: number;
  /** Strongest vertically integrated liquid over candidate ground, kg/m². */
  peakVilKgM2: number;
  /** Storm motion at the richest candidate cell, knots. */
  stormMotionKt: number;
  /** Bearing that cell is moving toward, degrees. Null when still. */
  stormMotionTowardDeg: number | null;
  /** What the observed cloud-top phase says about all of the above. */
  phase: PhaseCheck;
}

/** Mirrors TargetStats in server/src/lib/services/candidate/target.ts */
export interface TargetStats {
  run: string;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  /** Percent of the counted ground that passed every Texas test. */
  coveragePct: number;
  /** Ground that passed, km². */
  targetKm2: number;
  /** Ground that was asked, km² — the box, or the whole domain. */
  boxKm2: number;
  rejected: {
    noCloudBase: number;
    baseOutsideWindow: number;
    noFreezingLevel: number;
    topBelowFreezing: number;
    noStorm: number;
  };
}

/** Mirrors Verdict in server/src/lib/services/candidate/join.ts */
export type Verdict =
  | "candidate"
  | "noLiquid"
  | "noCloudBase"
  | "baseAboveBand"
  | "noCloudSeen"
  | "topTooWarm"
  | "raining";

/** Mirrors TargetVerdict in server/src/lib/services/candidate/target.ts */
export type TargetVerdict =
  | "target"
  | "noCloudBase"
  | "baseOutsideWindow"
  | "noFreezingLevel"
  | "topBelowFreezing"
  | "noStorm";

/** Mirrors CandidatePoint in server/src/lib/services/candidate/join.ts */
export interface CandidatePoint {
  run: string;
  validTime: string;
  /** Start of the satellite scan read over this cell. */
  sceneTime: string;
  /** Time of the radar scan read over this cell. */
  radarTime: string;
  /** Start of the phase scan read over this cell. Null where there was none. */
  phaseTime: string | null;
  /** The 3 km cell sampled — not the click, which is finer than the grid. */
  lat: number;
  lon: number;
  /** A candidate, nothing to seed, or the first test the cell failed. */
  verdict: Verdict;
  /**
   * Does this column look like the cloud Texas programmes say they seed?
   * Independent of `verdict` — rain and missing liquid do not reject it.
   */
  target: TargetVerdict;
  /** Cloud base above the terrain, ft. Null where there is no base. */
  cloudBaseAglFt: number | null;
  /** Freezing level, ft MSL. Null where the column never crosses 0 °C. */
  freezingFt: number | null;
  /** Modelled echo top, ft MSL. Null where the model diagnoses no echo. */
  echoTopFt: number | null;
  /** Supercooled liquid water path in the seeding band over this cell, g/m². */
  slwGM2: number;
  /** Cloud base, ft MSL. Null where the model has no cloud over the cell. */
  cloudBaseFt: number | null;
  /** Observed cloud-top temperature, °C. Null where the satellite sees no cloud. */
  cloudTopC: number | null;
  /** Observed phase at the cloud top. Null where no phase scene could be read. */
  topPhase: CloudPhase | null;
  /** Measured reflectivity, dBZ. Null where the radars see no echo, or nothing. */
  dbz: number | null;
  /** Is any radar looking at this cell at all? */
  radarCovered: boolean;
}

/** Mirrors SlwStats in server/src/lib/services/hrrr/slw.ts */
export interface SlwStats {
  run: string;
  hour: number;
  validTime: string;
  /** Percent of the HRRR domain at or above the lowest contour. */
  coveragePct: number;
  /** Ground at or above the lowest contour, km^2. */
  seedableKm2: number;
  /** Peak supercooled liquid water path, g/m^2. */
  peak: number;
  /** Pressure window the -5..-12 C band occupied, mb. Null when it is absent. */
  bandTopMb: number | null;
  bandBaseMb: number | null;
}

/** Mirrors CloudBaseStats in server/src/lib/services/hrrr/diagnostics.ts */
export interface CloudBaseStats {
  run: string;
  hour: number;
  validTime: string;
  /** Percent of the HRRR domain with a cloud base at all. */
  basePct: number;
  /**
   * Percent of the domain whose base is below the aircraft's ceiling — cloud a
   * sortie could enter. Not `CandidateStats.reachablePct`, which asks the same
   * question of the seeding band's base over candidate ground only.
   */
  reachablePct: number;
  /** Ground with a base below the ceiling, km². */
  reachableKm2: number;
  /** Median base where there is one, ft MSL. Null when there is no cloud. */
  medianFt: number | null;
}

/** Mirrors Diagnostics in server/src/lib/services/hrrr/diagnostics.ts */
export interface Diagnostics {
  /** Cloud base, ft MSL. Null where the model has no cloud over the cell. */
  cloudBaseFt: number | null;
  /** The same base above the terrain, which is what a ceiling report means. */
  cloudBaseAglFt: number | null;
  /** HRRR's own cloud top, ft MSL — one deck, not necessarily the highest. */
  cloudTopFt: number | null;
  /** Top minus base. Null when either is missing, or when they invert. */
  depthFt: number | null;
  /** Is the band's base between cloud base and cloud top over this point? */
  bandInCloud: boolean | null;
  /** Surface-based CAPE, J/kg. */
  capeJKg: number;
  /** Mixed-layer (180–0 mb) CAPE, J/kg. */
  mixedCapeJKg: number;
  /** 0–6 km storm motion, knots. */
  stormMotionKt: number;
  /** Compass bearing the storm is moving toward, degrees. Null when still. */
  stormMotionTowardDeg: number | null;
  /** HRRR's lightning field, dimensionless. Null at f00. */
  lightning: number | null;
  /** Vertically integrated liquid, kg/m². */
  vilKgM2: number;
  /** Model radar echo top, ft MSL. Null where the model diagnoses no echo. */
  echoTopFt: number | null;
}

/** Mirrors SoundingLevel in server/src/lib/services/hrrr/profile.ts */
export interface SoundingLevel {
  mb: number;
  tempC: number;
  heightFt: number;
}

/** Mirrors Sounding in server/src/lib/services/hrrr/forecast.ts */
export interface Sounding {
  run: string;
  hour: number;
  validTime: string;
  /** The 3 km cell sampled — not the click, which is finer than the grid. */
  lat: number;
  lon: number;
  /** Terrain height at that cell, ft. Isotherms below it are underground. */
  surfaceFt: number;
  /** 0 °C, ft MSL. Null when the column never crosses it. */
  freezingFt: number | null;
  /** Warm edge of the seeding band, −5 °C. */
  bandBaseFt: number | null;
  /** Cold edge of the seeding band, −12 °C. */
  bandTopFt: number | null;
  /** Temperature at the bottom and top of the column read, °C. */
  baseC: number;
  topC: number;
  levels: SoundingLevel[];
  /** The wrfsfc diagnostics over the same cell — attributes, never gates. */
  diagnostics: Diagnostics;
}

/** Mirrors RadarStats in server/src/lib/services/mrms/radar.ts */
export interface RadarStats {
  /** When the server last built the scene, ISO 8601. */
  fetchedAt: string;
  /** Time of the scene itself, ISO 8601 — not when we fetched it. */
  validTime: string;
  /** Percent of the mosaic's box any radar covers. */
  radarCoveragePct: number;
  /** Percent of covered ground at or above the lowest contour. */
  echoPct: number;
  /** Ground at or above the lowest contour, km². */
  echoKm2: number;
  /** Strongest 1 km cell, dBZ. Null when nothing reaches the lowest contour. */
  peakDbz: number | null;
}

/** Mirrors CloudTopStats in server/src/lib/services/goes/cloudtop.ts */
export interface CloudTopStats {
  /** When the server last built the scene, ISO 8601. */
  fetchedAt: string;
  /** Start of the satellite scan, ISO 8601 — not when we fetched it. */
  validTime: string;
  /** HRRR run that supplied the temperatures, ISO 8601. */
  profileRun: string;
  /** Percent of the 2 km scene the satellite sees any cloud over. */
  cloudPct: number;
  /** Percent of the grid whose cloud top is at or below −5 °C. */
  seedableTopPct: number;
  /** Ground with a seedable top, km². */
  seedableKm2: number;
  /** Coldest cloud top on the grid, °C. Null when there is no cloud at all. */
  coldestTopC: number | null;
}

/** Mirrors DomainFrame in server/src/lib/services/hrrr/forecast.ts */
export interface DomainFrame {
  type: "FeatureCollection";
  features: {
    type: "Feature";
    properties: Record<string, never>;
    geometry: { type: "Polygon"; coordinates: [number, number][][] };
  }[];
}

/**
 * The model's edge as a closed ring of [lon, lat] — the order an ArcGIS click
 * gives a point in, so the two go straight into a point-in-ring test.
 */
export type DomainRing = [number, number][];
