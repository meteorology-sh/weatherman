/**
 * Which map a route is showing. Forecast is modelled; candidate is observed;
 * replay is the candidate set at a past hour rather than at this one.
 */
export type MapMode = "forecast" | "candidate" | "replay";

/** Mirrors ForecastMeta in server/src/lib/services/forecast.ts */
export interface ForecastMeta {
  /** Model run, ISO 8601. */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
}

/** Mirrors SlwStats in server/src/lib/services/forecast.ts */
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

/** Mirrors SoundingLevel in server/src/lib/services/forecast.ts */
export interface SoundingLevel {
  mb: number;
  tempC: number;
  heightFt: number;
}

/** Mirrors Sounding in server/src/lib/services/forecast.ts */
export interface Sounding {
  run: string;
  hour: number;
  validTime: string;
  /** The 12 km cell sampled — not the click, which is finer than the grid. */
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
}

/** Mirrors RadarStats in server/src/lib/services/radar.ts */
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
  /** Strongest 12 km cell, dBZ. Null when nothing reaches the lowest contour. */
  peakDbz: number | null;
}

/** Mirrors CloudTopStats in server/src/lib/services/cloudtop.ts */
export interface CloudTopStats {
  /** When the server last built the scene, ISO 8601. */
  fetchedAt: string;
  /** Start of the satellite scan, ISO 8601 — not when we fetched it. */
  validTime: string;
  /** HRRR run that supplied the temperatures, ISO 8601. */
  profileRun: string;
  /** Percent of the 12 km grid the satellite sees any cloud over. */
  cloudPct: number;
  /** Percent of the grid whose cloud top is at or below −5 °C. */
  seedableTopPct: number;
  /** Ground with a seedable top, km². */
  seedableKm2: number;
  /** Coldest cloud top on the grid, °C. Null when there is no cloud at all. */
  coldestTopC: number | null;
}
