// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { CloudBaseProvider } from "@/lib/context/CloudBaseProvider";

// Types
import type { CloudBaseStats } from "@/lib/types";

const stats: CloudBaseStats = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  radarTime: "2025-05-15T18:02:00.000Z",
  drawnKm2: 182304,
  drawnPct: 4.21,
  modelKm2: 121536,
  cclKm2: 60768,
  medianFt: 3719,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => stats }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CloudBaseProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <CloudBaseProvider>
        <span>child</span>
      </CloudBaseProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the field's summary in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <CloudBaseProvider>
        <span />
      </CloudBaseProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudbase.stats).toEqual(stats);
    });
  });

  // The candidate map is "right now", and a cloud base is a state the analysis
  // holds rather than a flux needing a timestep.
  it("asks for the analysis hour, which is what the layer draws", async () => {
    renderWithStore(
      <CloudBaseProvider>
        <span />
      </CloudBaseProvider>,
      createTestStore()
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/candidate/cloudbase/stats?");
    });
  });

  it("does not refetch once the stats are loaded", async () => {
    const store = createTestStore();

    const { rerender } = renderWithStore(
      <CloudBaseProvider>
        <span />
      </CloudBaseProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudbase.stats).toEqual(stats);
    });

    rerender(
      <CloudBaseProvider>
        <span />
      </CloudBaseProvider>
    );

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("dispatches the error when the build fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <CloudBaseProvider>
        <span />
      </CloudBaseProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudbase.error).toContain("503");
    });
  });

  it("stops loading even when the build fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <CloudBaseProvider>
        <span />
      </CloudBaseProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudbase.loading).toBe(false);
    });
  });
});
