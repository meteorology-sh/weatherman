// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { CloudTopProvider } from "@/lib/context/CloudTopProvider";

// Types
import type { CloudTopStats } from "@/lib/types";

const stats: CloudTopStats = {
  fetchedAt: "2026-08-13T01:48:42.658Z",
  validTime: "2026-08-13T01:41:17.900Z",
  profileRun: "2026-08-13T00:00:00.000Z",
  cloudPct: 53.66,
  seedableTopPct: 41.5,
  seedableKm2: 7083216,
  coldestTopC: -68.4,
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

describe("CloudTopProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <CloudTopProvider>
        <span>child</span>
      </CloudTopProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the scene summary in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <CloudTopProvider>
        <span />
      </CloudTopProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudtop.stats).toEqual(stats);
    });
  });

  // A satellite scene has no run and no hour to ask for.
  it("asks for the summary with no parameters", async () => {
    renderWithStore(
      <CloudTopProvider>
        <span />
      </CloudTopProvider>,
      createTestStore()
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/cloudtop/temperature/stats");
    });
  });

  // StrictMode double-invokes effects, and a cold build here is the slowest on
  // the map — firing it twice would double the wait.
  it("does not refetch once the stats are loaded", async () => {
    const store = createTestStore();

    const { rerender } = renderWithStore(
      <CloudTopProvider>
        <span />
      </CloudTopProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudtop.stats).toEqual(stats);
    });

    rerender(
      <CloudTopProvider>
        <span />
      </CloudTopProvider>
    );

    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("dispatches the error when the feed fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <CloudTopProvider>
        <span />
      </CloudTopProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudtop.error).toContain("503");
    });
  });

  it("stops loading even when the feed fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <CloudTopProvider>
        <span />
      </CloudTopProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().cloudtop.loading).toBe(false);
    });
  });
});
