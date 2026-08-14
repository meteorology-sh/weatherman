// Store
import reducer, { seedabilityActions } from "@/lib/store/features/seedability";

// Types
import type { CandidateStats } from "@/lib/types";

const stats: CandidateStats = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  coveragePct: 0.31,
  candidateKm2: 52560,
  peak: 340,
  liquidKm2: 249120,
  rejected: {
    noCloudBase: 41184,
    baseAboveBand: 8496,
    noCloudSeen: 96912,
    topTooWarm: 34848,
    raining: 15120,
  },
  blindKm2: 2880,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17100,
  ceilingFt: 18000,
  reachablePct: 72.9,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
};

const initial = () => reducer(undefined, { type: "@@INIT" });

describe("seedability slice", () => {
  // The answer the map exists to give, and it covers a fraction of the ground
  // its inputs do, so it does not bury them the way a fourth fill would.
  it("starts visible", () => {
    expect(initial().visible).toBe(true);
  });

  it("starts with no summary and no error", () => {
    expect(initial().stats).toBeUndefined();
    expect(initial().error).toBe(null);
    expect(initial().loading).toBe(false);
  });

  it("takes the summary", () => {
    const state = reducer(initial(), seedabilityActions.setStats(stats));

    expect(state.stats?.candidateKm2).toBe(52560);
    expect(state.stats?.rejected.raining).toBe(15120);
  });

  it("toggles visibility without touching the summary", () => {
    const loaded = reducer(initial(), seedabilityActions.setStats(stats));
    const hidden = reducer(loaded, seedabilityActions.setVisible(false));

    expect(hidden.visible).toBe(false);
    expect(hidden.stats?.candidateKm2).toBe(52560);
  });

  it("records loading and error", () => {
    const loading = reducer(initial(), seedabilityActions.setLoading(true));
    expect(loading.loading).toBe(true);

    const failed = reducer(loading, seedabilityActions.setError("no scene"));
    expect(failed.error).toBe("no scene");
  });

  it("clears an error when a later attempt sets it back to null", () => {
    const failed = reducer(initial(), seedabilityActions.setError("no scene"));
    const cleared = reducer(failed, seedabilityActions.setError(null));

    expect(cleared.error).toBe(null);
  });
});
