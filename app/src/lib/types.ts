export interface CloudCoverPoint {
  lat: number;
  lon: number;
  cloudCover: number;
  time: string;
}

/** The GOES imagery layers the operator can switch between on the map. */
export type CloudLayerId = "geocolor" | "band13";
