// Store
import cloudTopReducer, {
  cloudTopActions,
} from "@/lib/store/features/cloudtop";

// Types
import type { CloudTopStats } from "@/lib/types";

const initialState = cloudTopReducer(undefined, { type: "@@INIT" });

const stats: CloudTopStats = {
  fetchedAt: "2026-08-13T01:48:42.658Z",
  validTime: "2026-08-13T01:41:17.900Z",
  profileRun: "2026-08-13T00:00:00.000Z",
  cloudPct: 53.66,
  seedableTopPct: 41.5,
  seedableKm2: 7083216,
  coldestTopC: -68.4,
};

describe("cloudtop reducer", () => {
  // It is the base layer the other three are read against, so it starts on for
  // the same reason the radar layer does.
  it("starts visible", () => {
    expect(initialState.visible).toBe(true);
  });

  it("starts with no stats", () => {
    expect(initialState.stats).toBeUndefined();
  });

  it("toggles the layer off", () => {
    const state = cloudTopReducer(
      initialState,
      cloudTopActions.setVisible(false)
    );

    expect(state.visible).toBe(false);
  });

  it("stores the stats", () => {
    const state = cloudTopReducer(
      initialState,
      cloudTopActions.setStats(stats)
    );

    expect(state.stats).toEqual(stats);
  });

  it("keeps the stats when the layer is hidden", () => {
    const loaded = cloudTopReducer(
      initialState,
      cloudTopActions.setStats(stats)
    );

    const state = cloudTopReducer(loaded, cloudTopActions.setVisible(false));

    expect(state.stats).toEqual(stats);
  });

  it("tracks loading", () => {
    const state = cloudTopReducer(
      initialState,
      cloudTopActions.setLoading(true)
    );

    expect(state.loading).toBe(true);
  });

  it("stores an error", () => {
    const state = cloudTopReducer(
      initialState,
      cloudTopActions.setError("the satellite feed is down")
    );

    expect(state.error).toBe("the satellite feed is down");
  });

  it("clears an error", () => {
    const failed = cloudTopReducer(
      initialState,
      cloudTopActions.setError("the satellite feed is down")
    );

    const state = cloudTopReducer(failed, cloudTopActions.setError(null));

    expect(state.error).toBeNull();
  });

  // A clear sky is a real answer, not a missing one — the whole point of the
  // layer is that "no cloud" is information rather than an absence of data.
  it("stores a scene with no cloud at all", () => {
    const empty: CloudTopStats = {
      ...stats,
      cloudPct: 0,
      seedableTopPct: 0,
      seedableKm2: 0,
      coldestTopC: null,
    };

    const state = cloudTopReducer(
      initialState,
      cloudTopActions.setStats(empty)
    );

    expect(state.stats?.coldestTopC).toBeNull();
    expect(state.stats?.cloudPct).toBe(0);
  });
});
