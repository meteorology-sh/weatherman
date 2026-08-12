// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { RadarProvider } from "@/lib/context/RadarProvider";

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => stats }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RadarProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <RadarProvider>
        <span>child</span>
      </RadarProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the scene summary in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <RadarProvider>
        <span />
      </RadarProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().radar.stats).toEqual(stats);
    });
  });

  // A scene has no run and no hour to ask for.
  it("asks for the summary with no parameters", async () => {
    renderWithStore(
      <RadarProvider>
        <span />
      </RadarProvider>,
      createTestStore()
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/radar/reflectivity/stats");
    });
  });

  it("clears the loading flag when done", async () => {
    const store = createTestStore();

    renderWithStore(
      <RadarProvider>
        <span />
      </RadarProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().radar.loading).toBe(false);
    });
  });

  it("dispatches the error when the mosaic is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <RadarProvider>
        <span />
      </RadarProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().radar.error).toBe(
        "Failed to fetch radar mosaic: 503"
      );
    });
  });

  // The guard is what stops StrictMode's double-invoked effect refetching — and
  // this build costs the server ~9 s, so a redundant one is not free.
  it("does not refetch when the stats are already in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <RadarProvider>
        <span />
      </RadarProvider>,
      store
    );
    await waitFor(() => expect(store.getState().radar.stats).toEqual(stats));
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    renderWithStore(
      <RadarProvider>
        <span />
      </RadarProvider>,
      store
    );

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });
});
