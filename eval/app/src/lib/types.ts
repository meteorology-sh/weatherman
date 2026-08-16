/**
 * What `eval/server.mjs` sends. Mirrors it by hand, like the app mirrors the
 * Weatherman server — there is no shared package on either side.
 */

/** How far each input sat from the moment the flare left the aircraft, in minutes. */
export type Gaps = {
  model: number | null;
  satellite: number | null;
  radar: number | null;
};

/** The join's answer for the cell a flare was released into. */
export type Answer = {
  verdict: string;
  slwGM2: number;
  cloudBaseFt: number | null;
  cloudTopC: number | null;
  topPhase: string | null;
  dbz: number | null;
  radarCovered: boolean;
  validTime: string;
  sceneTime: string;
  radarTime: string;
  error?: string;
  outsideDomain?: boolean;
};

export type Release = {
  at: string;
  timeZ: string;
  plane: string;
  located: boolean;
  lat: number;
  lon: number;
  glaciogenic: number;
  hygroscopic: number;
  county: string;
  answer: Answer | null;
  gaps: Gaps | null;
};

/**
 * A line of the crew's own account, with whatever numbers it carried.
 *
 * `said` is kept verbatim. The parsed fields beside it are a convenience for
 * lining a figure up against ours, and the sentence is what settles any
 * argument about what was meant.
 */
export type Observation = {
  at: string;
  timeZ: string;
  said: string;
  pilotCloudBaseFt?: number;
  echoTop?: { range: [number, number]; unit: string };
  vilKgM2?: [number, number];
  dbz?: [number, number];
};

export type DaySummary = {
  date: string;
  releases: number;
  located: number;
  observations: number;
  /** `void` is a sweep that lost the server partway, not a day with nothing on it. */
  state: "scored" | "unscored" | "void";
  verdicts: Record<string, number> | null;
  peakSlwGM2: number | null;
};

export type Day = {
  date: string;
  dayTotal: unknown;
  claimed: unknown;
  soundings: Record<string, Record<string, number>> | null;
  observations: Observation[];
  unlocated: Omit<Release, "answer" | "gaps">[];
  releases: Release[];
};
