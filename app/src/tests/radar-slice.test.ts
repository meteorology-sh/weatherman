// Store
import reducer, { radarActions } from "@/lib/store/features/radar";

// Types
import type { RadarStats } from "@/lib/types";

const stats: RadarStats = {
  fetchedAt: "2026-08-12T04:15:46.334Z",
  validTime: "2026-08-12T04:10:00.000Z",
  radarCoveragePct: 67.33,
  echoPct: 2.01,
  echoKm2: 309859,
  peakDbz: 57,
};

const initial = reducer(undefined, { type: "@@INIT" });

describe("radar slice", () => {
  // A disqualifier the operator has to remember to switch on is not one.
  it("starts with the mosaic drawn", () => {
    expect(initial.visible).toBe(true);
  });

  it("starts with no stats and no error", () => {
    expect(initial.stats).toBeUndefined();
    expect(initial.error).toBeNull();
    expect(initial.loading).toBe(false);
  });

  it("toggles the layer", () => {
    expect(reducer(initial, radarActions.setVisible(false)).visible).toBe(
      false
    );
  });

  it("stores the scene summary", () => {
    expect(reducer(initial, radarActions.setStats(stats)).stats).toEqual(stats);
  });

  it("tracks loading", () => {
    expect(reducer(initial, radarActions.setLoading(true)).loading).toBe(true);
  });

  it("stores an error", () => {
    const state = reducer(
      initial,
      radarActions.setError("MRMS mosaic unavailable: 503")
    );

    expect(state.error).toBe("MRMS mosaic unavailable: 503");
  });

  it("clears an error", () => {
    const failed = reducer(initial, radarActions.setError("boom"));

    expect(reducer(failed, radarActions.setError(null)).error).toBeNull();
  });
});
