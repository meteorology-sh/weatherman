// Store
import reducer, { pirepActions } from "@/lib/store/features/pirep";

// Types
import type { IcingStats } from "@/lib/types";

const stats: IcingStats = {
  fetchedAt: "2026-08-12T03:30:00.000Z",
  windowHours: 12,
  reports: 400,
  icing: 38,
  positive: 20,
  inBand: 3,
  latest: "2026-08-12T03:20:00.000Z",
};

const initial = reducer(undefined, { type: "@@INIT" });

describe("pirep slice", () => {
  it("starts with the reports drawn", () => {
    expect(initial.visible).toBe(true);
  });

  // Hiding the out-of-band reports by default would make the handful that are
  // in band look like the whole picture, which overstates the confirmation.
  it("starts showing every report, not just the in-band ones", () => {
    expect(initial.bandOnly).toBe(false);
  });

  it("starts with no stats and no error", () => {
    expect(initial.stats).toBeUndefined();
    expect(initial.error).toBeNull();
    expect(initial.loading).toBe(false);
  });

  it("toggles the layer", () => {
    const state = reducer(initial, pirepActions.setVisible(false));

    expect(state.visible).toBe(false);
  });

  it("narrows to the seeding band", () => {
    const state = reducer(initial, pirepActions.setBandOnly(true));

    expect(state.bandOnly).toBe(true);
  });

  it("stores the stats", () => {
    const state = reducer(initial, pirepActions.setStats(stats));

    expect(state.stats).toEqual(stats);
  });

  it("stores the loading flag", () => {
    const state = reducer(initial, pirepActions.setLoading(true));

    expect(state.loading).toBe(true);
  });

  it("stores the error", () => {
    const state = reducer(
      initial,
      pirepActions.setError("Icing PIREPs unavailable: 503")
    );

    expect(state.error).toBe("Icing PIREPs unavailable: 503");
  });

  it("clears the error", () => {
    const failed = reducer(initial, pirepActions.setError("boom"));
    const state = reducer(failed, pirepActions.setError(null));

    expect(state.error).toBeNull();
  });

  // Turning the layer off must not throw away what was fetched — the operator
  // toggling it back on should not cost another pull.
  it("keeps the stats when the layer is switched off", () => {
    const loaded = reducer(initial, pirepActions.setStats(stats));
    const state = reducer(loaded, pirepActions.setVisible(false));

    expect(state.stats).toEqual(stats);
  });
});
