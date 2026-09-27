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
  // The map opens on the fly fill and nothing else. Every switch under radar
  // starts off with the mosaic itself, so an operator turns the rain on and
  // then decides what to read on it.
  it("starts with every radar switch off", () => {
    expect(initial.visible).toBe(false);
    expect(initial.lightning).toBe(false);
    expect(initial.heading).toBe(false);
    expect(initial.echoFreeze).toBe(false);
  });

  it("toggles lightning without touching the mosaic", () => {
    const on = reducer(initial, radarActions.setLightning(true));
    expect(on.lightning).toBe(true);
    expect(on.visible).toBe(false);
  });

  it("toggles the core and heading without touching the mosaic", () => {
    const on = reducer(initial, radarActions.setHeading(true));
    expect(on.heading).toBe(true);
    expect(on.visible).toBe(false);
    expect(on.lightning).toBe(false);
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
