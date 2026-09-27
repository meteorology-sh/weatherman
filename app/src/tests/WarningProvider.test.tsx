// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { WarningProvider } from "@/lib/context/WarningProvider";

// Store
import reducer, { warningsActions } from "@/lib/store/features/warnings";

// Types
import type { WarningStats } from "@/lib/types";

const stats: WarningStats = {
  validTime: "2026-09-16T22:27:00.000Z",
  fetchedAt: "2026-09-16T22:27:48.353Z",
  count: 2,
  severe: 2,
  tornado: 0,
  flood: 0,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("WarningProvider", () => {
  it("puts the live count in the store", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => stats,
    }));
    vi.stubGlobal("fetch", fetchMock);
    const store = createTestStore();

    renderWithStore(
      <WarningProvider>
        <span />
      </WarningProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().warnings.stats).toEqual(stats);
    });
    expect(fetchMock).toHaveBeenCalledWith("/warnings/severe/stats");
    expect(store.getState().warnings.loading).toBe(false);
  });

  it("records a failed read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502 }))
    );
    const store = createTestStore();

    renderWithStore(
      <WarningProvider>
        <span />
      </WarningProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().warnings.error).toContain("502");
    });
    expect(store.getState().warnings.stats).toBeUndefined();
  });
});

describe("warnings slice", () => {
  const initial = reducer(undefined, { type: "@@init" });

  // The switch only exists while a warning is in force, and then it is on.
  it("opens with the layer on and no count", () => {
    expect(initial.visible).toBe(true);
    expect(initial.stats).toBeUndefined();
  });

  it("stores the switch and the count", () => {
    let state = reducer(initial, warningsActions.setVisible(false));
    state = reducer(state, warningsActions.setStats(stats));
    expect(state.visible).toBe(false);
    expect(state.stats).toEqual(stats);
  });
});
