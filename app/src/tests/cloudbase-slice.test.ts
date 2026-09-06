// Store
import cloudBaseReducer, {
  cloudBaseActions,
} from "@/lib/store/features/cloudbase";

// Types
import type { CloudBaseStats } from "@/lib/types";

const initialState = cloudBaseReducer(undefined, { type: "@@INIT" });

const stats: CloudBaseStats = {
  run: "2025-05-15T18:00:00.000Z",
  hour: 0,
  validTime: "2025-05-15T18:00:00.000Z",
  basePct: 55.88,
  reachablePct: 17.14,
  reachableKm2: 2925792,
  medianFt: 3719,
};

describe("cloudbase reducer", () => {
  // The one layer on this map that starts off: it is the newest claim, and a
  // fourth fill switched on by default lands on three an operator already
  // reads without being asked for.
  it("starts hidden", () => {
    expect(initialState.visible).toBe(false);
  });


  it("starts with no stats", () => {
    expect(initialState.stats).toBeUndefined();
  });

  it("toggles the layer on", () => {
    const state = cloudBaseReducer(
      initialState,
      cloudBaseActions.setVisible(true)
    );

    expect(state.visible).toBe(true);
  });

  it("stores the stats", () => {
    const state = cloudBaseReducer(
      initialState,
      cloudBaseActions.setStats(stats)
    );

    expect(state.stats).toEqual(stats);
  });

  it("keeps the stats when the layer is hidden", () => {
    const loaded = cloudBaseReducer(
      initialState,
      cloudBaseActions.setStats(stats)
    );

    const state = cloudBaseReducer(loaded, cloudBaseActions.setVisible(false));

    expect(state.stats).toEqual(stats);
  });

  it("tracks loading", () => {
    const state = cloudBaseReducer(
      initialState,
      cloudBaseActions.setLoading(true)
    );

    expect(state.loading).toBe(true);
  });

  it("stores an error", () => {
    const state = cloudBaseReducer(
      initialState,
      cloudBaseActions.setError("HRRR index unavailable: 404")
    );

    expect(state.error).toBe("HRRR index unavailable: 404");
  });

  it("clears an error", () => {
    const failed = cloudBaseReducer(
      initialState,
      cloudBaseActions.setError("HRRR index unavailable: 404")
    );

    const state = cloudBaseReducer(failed, cloudBaseActions.setError(null));

    expect(state.error).toBeNull();
  });

  // A domain with no cloud in it is a real answer, and its median base is
  // nothing rather than zero feet.
  it("stores a domain with no cloud at all", () => {
    const empty: CloudBaseStats = {
      ...stats,
      basePct: 0,
      reachablePct: 0,
      reachableKm2: 0,
      medianFt: null,
    };

    const state = cloudBaseReducer(
      initialState,
      cloudBaseActions.setStats(empty)
    );

    expect(state.stats?.medianFt).toBeNull();
    expect(state.stats?.basePct).toBe(0);
  });
});
