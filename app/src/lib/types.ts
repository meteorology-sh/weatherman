/** Which map a route is showing. Forecast is modelled; candidate is observed. */
export type MapMode = "forecast" | "candidate";

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
