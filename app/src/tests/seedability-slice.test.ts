// Store
import reducer, { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";

// Types
import type { CandidatePoint, CandidateStats } from "@/lib/types";

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

  describe("the clicked point", () => {
    const here: CandidatePoint = {
      run: "2025-05-15T18:00:00.000Z",
      validTime: "2025-05-15T18:00:00.000Z",
      sceneTime: "2025-05-15T18:01:17.900Z",
      radarTime: "2025-05-15T18:00:39.000Z",
      lat: 32.05,
      lon: -101.42,
      verdict: "candidate",
      slwGM2: 140,
      cloudBaseFt: 5800,
      cloudTopC: -14,
      dbz: null,
      radarCovered: true,
    };

    it("starts with no point read", () => {
      expect(initial().here).toBeUndefined();
      expect(initial().hereError).toBe(null);
      expect(initial().hereLoading).toBe(false);
    });

    it("takes the point without touching the summary", () => {
      const loaded = reducer(initial(), seedabilityActions.setStats(stats));
      const state = reducer(loaded, seedabilityActions.setHere(here));

      expect(state.here?.verdict).toBe("candidate");
      expect(state.stats?.candidateKm2).toBe(52560);
    });

    // The old cell's answer is about somewhere else. Keeping it under new
    // coordinates would be the wrong answer, confidently labelled — and an
    // undefined point is also what makes the provider fetch the new one.
    it("forgets the point when the click moves", () => {
      const loaded = reducer(initial(), seedabilityActions.setHere(here));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.here).toBeUndefined();
    });

    it("keeps the summary when the click moves", () => {
      const loaded = reducer(initial(), seedabilityActions.setStats(stats));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.stats?.candidateKm2).toBe(52560);
    });

    it("records loading and error for the point separately", () => {
      const loading = reducer(
        initial(),
        seedabilityActions.setHereLoading(true)
      );
      expect(loading.hereLoading).toBe(true);
      expect(loading.loading).toBe(false);

      const failed = reducer(
        loading,
        seedabilityActions.setHereError("no scene")
      );
      expect(failed.hereError).toBe("no scene");
      expect(failed.error).toBe(null);
    });
  });
});
