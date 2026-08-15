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
  phase: {
    sceneTime: "2025-05-15T18:01:17.900Z",
    confirmedKm2: 31680,
    glaciatedKm2: 15840,
    unresolvedKm2: 5040,
    missedKm2: 8640,
  },
};

const initial = () => reducer(undefined, { type: "@@INIT" });

describe("seedability slice", () => {
  // The answer the map exists to give, and it covers a fraction of the ground
  // its inputs do, so it does not bury them the way a fourth fill would.
  it("starts visible", () => {
    expect(initial().visible).toBe(true);
  });

  describe("the clicked point", () => {
    const here: CandidatePoint = {
      run: "2025-05-15T18:00:00.000Z",
      validTime: "2025-05-15T18:00:00.000Z",
      sceneTime: "2025-05-15T18:01:17.900Z",
      radarTime: "2025-05-15T18:00:39.000Z",
      phaseTime: "2025-05-15T18:01:17.900Z",
      lat: 32.05,
      lon: -101.42,
      verdict: "candidate",
      slwGM2: 140,
      cloudBaseFt: 5800,
      topPhase: "supercooled",
      cloudTopC: -14,
      dbz: null,
      radarCovered: true,
    };

    it("starts with no point read", () => {
      expect(initial().here).toBeUndefined();
      expect(initial().hereError).toBe(null);
      expect(initial().hereLoading).toBe(false);
    });

    it("takes the point", () => {
      const state = reducer(initial(), seedabilityActions.setHere(here));

      expect(state.here?.verdict).toBe("candidate");
      expect(state.here?.slwGM2).toBe(140);
    });

    it("takes the point without touching the layer's visibility", () => {
      const hidden = reducer(initial(), seedabilityActions.setVisible(false));
      const state = reducer(hidden, seedabilityActions.setHere(here));

      expect(state.visible).toBe(false);
      expect(state.here?.verdict).toBe("candidate");
    });

    // The old cell's answer is about somewhere else. Keeping it under new
    // coordinates would be the wrong answer, confidently labelled — and an
    // undefined point is also what makes the provider fetch the new one.
    it("forgets the point when the click moves", () => {
      const loaded = reducer(initial(), seedabilityActions.setHere(here));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.here).toBeUndefined();
    });

    it("leaves the layer drawn when the click moves", () => {
      const loaded = reducer(initial(), seedabilityActions.setHere(here));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.visible).toBe(true);
    });

    it("records loading and error for the point", () => {
      const loading = reducer(
        initial(),
        seedabilityActions.setHereLoading(true)
      );
      expect(loading.hereLoading).toBe(true);

      const failed = reducer(
        loading,
        seedabilityActions.setHereError("no scene")
      );
      expect(failed.hereError).toBe("no scene");
    });

    // A failed read is about the cell that failed. The next click has to be
    // able to clear it, or one dead source leaves an error over every later
    // point.
    it("clears the error when the click moves", () => {
      const failed = reducer(
        initial(),
        seedabilityActions.setHereError("no scene")
      );
      const moved = reducer(failed, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.hereError).toBe(null);
    });
  });

  /**
   * The whole domain's summary, which the live map carries alongside the point.
   * It is a different question from the clicked cell, so it has its own fields
   * and its own loading and error rather than sharing the point's.
   */
  describe("the domain summary", () => {
    it("starts empty", () => {
      expect(initial().stats).toBe(undefined);
      expect(initial().statsLoading).toBe(false);
      expect(initial().statsError).toBe(null);
    });

    it("holds the summary it is given", () => {
      const state = reducer(initial(), seedabilityActions.setStats(stats));

      expect(state.stats).toEqual(stats);
    });

    it("carries its own loading and error", () => {
      const loading = reducer(
        initial(),
        seedabilityActions.setStatsLoading(true)
      );
      expect(loading.statsLoading).toBe(true);
      expect(loading.hereLoading).toBe(false);

      const failed = reducer(
        loading,
        seedabilityActions.setStatsError("GOES listing failed")
      );
      expect(failed.statsError).toBe("GOES listing failed");
      expect(failed.hereError).toBe(null);
    });

    // The summary is about the hour, not about the cell, so moving the click
    // must not throw it away — clearing it would refetch a ~40 s build on every
    // click.
    it("survives the click moving", () => {
      const loaded = reducer(initial(), seedabilityActions.setStats(stats));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.stats).toEqual(stats);
    });
  });
});
