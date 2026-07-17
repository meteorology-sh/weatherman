// Store
import candidateReducer, {
  candidateActions,
} from "@/lib/store/features/candidate";

// Types
import type { SlwStats } from "@/lib/types";

const initialState = candidateReducer(undefined, { type: "@@INIT" });

const stats: SlwStats = {
  run: "2026-07-17T03:00:00.000Z",
  hour: 0,
  validTime: "2026-07-17T03:00:00.000Z",
  coveragePct: 1.99,
  seedableKm2: 338832,
  peak: 964,
  bandTopMb: 425,
  bandBaseMb: 700,
};

describe("candidate reducer", () => {
  it("starts with both layers on", () => {
    expect(initialState.imagery).toBe(true);
    expect(initialState.liquid).toBe(true);
  });

  it("starts with no stats", () => {
    expect(initialState.stats).toBeUndefined();
  });

  it("toggles the imagery off", () => {
    const state = candidateReducer(
      initialState,
      candidateActions.setImagery(false)
    );

    expect(state.imagery).toBe(false);
  });

  it("toggles the liquid layer off", () => {
    const state = candidateReducer(
      initialState,
      candidateActions.setLiquid(false)
    );

    expect(state.liquid).toBe(false);
  });

  it("leaves the other layer alone when one toggles", () => {
    const state = candidateReducer(
      initialState,
      candidateActions.setLiquid(false)
    );

    expect(state.imagery).toBe(true);
  });

  it("stores the stats", () => {
    const state = candidateReducer(
      initialState,
      candidateActions.setStats(stats)
    );

    expect(state.stats).toEqual(stats);
  });

  it("tracks loading", () => {
    const state = candidateReducer(
      initialState,
      candidateActions.setLoading(true)
    );

    expect(state.loading).toBe(true);
  });

  it("stores an error", () => {
    const state = candidateReducer(
      initialState,
      candidateActions.setError("upstream is down")
    );

    expect(state.error).toBe("upstream is down");
  });

  it("clears an error", () => {
    const failed = candidateReducer(
      initialState,
      candidateActions.setError("upstream is down")
    );

    const state = candidateReducer(failed, candidateActions.setError(null));

    expect(state.error).toBeNull();
  });
});
