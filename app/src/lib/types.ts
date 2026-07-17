export interface CloudCoverPoint {
  lat: number;
  lon: number;
  cloudCover: number;
  time: string;
}

/** The GOES imagery layers the operator can switch between on the map. */
export type CloudLayerId = "geocolor" | "band13";

/** Which map a route is showing. Forecast is modelled; candidate is observed. */
export type MapMode = "forecast" | "candidate";

/** Mirrors CloudForecastMeta in server/src/lib/services/forecast.ts */
export interface ForecastMeta {
  /** Model run, ISO 8601. */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
}
