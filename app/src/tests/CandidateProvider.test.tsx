// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { CandidateProvider } from "@/lib/context/CandidateProvider";

// Types
import type { SlwStats } from "@/lib/types";

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => stats }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("CandidateProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <CandidateProvider>
        <span>child</span>
      </CandidateProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the stats in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <CandidateProvider>
        <span />
      </CandidateProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().candidate.stats).toEqual(stats);
    });
  });

  // The whole point of mounting this app-wide: it warms the server's ~30 s
  // build on landing, and it can only do that by asking for the analysis hour.
  it("asks for the analysis hour, so the map's frame is already built", async () => {
    renderWithStore(
      <CandidateProvider>
        <span />
      </CandidateProvider>,
      createTestStore()
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/forecast/liquid/stats?hour=0");
    });
  });

  it("clears the loading flag when done", async () => {
    const store = createTestStore();

    renderWithStore(
      <CandidateProvider>
        <span />
      </CandidateProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().candidate.loading).toBe(false);
    });
  });

  it("dispatches the error when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <CandidateProvider>
        <span />
      </CandidateProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().candidate.error).toBe(
        "Failed to fetch liquid water stats: 500"
      );
    });
  });

  // The guard is what stops StrictMode's double-invoked effect refetching — and
  // here a refetch would mean a second ~30 s server build.
  it("does not refetch when the stats are already in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <CandidateProvider>
        <span />
      </CandidateProvider>,
      store
    );
    await waitFor(() => expect(store.getState().candidate.stats).toEqual(stats));
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    renderWithStore(
      <CandidateProvider>
        <span />
      </CandidateProvider>,
      store
    );

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });
});
