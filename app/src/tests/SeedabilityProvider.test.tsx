// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { SeedabilityProvider } from "@/lib/context/SeedabilityProvider";

// Types
import type { CandidateStats } from "@/lib/types";

const stats: CandidateStats = {
  run: "2026-08-14T18:00:00.000Z",
  validTime: "2026-08-14T18:00:00.000Z",
  sceneTime: "2026-08-14T18:01:17.900Z",
  radarTime: "2026-08-14T18:00:39.000Z",
  coveragePct: 1.27,
  candidateKm2: 232128,
  peak: 1260,
  liquidKm2: 377856,
  rejected: {
    noCloudBase: 0,
    baseAboveBand: 0,
    noCloudSeen: 27216,
    topTooWarm: 11376,
    raining: 107136,
  },
  blindKm2: 2880,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17891,
  ceilingFt: 18000,
  reachablePct: 52.42,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
  phase: {
    sceneTime: "2026-08-14T18:06:17.900Z",
    confirmedKm2: 63792,
    glaciatedKm2: 168336,
    unresolvedKm2: 0,
    missedKm2: 442080,
  },
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

describe("SeedabilityProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <SeedabilityProvider>
        <span>child</span>
      </SeedabilityProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the summary in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <SeedabilityProvider>
        <span />
      </SeedabilityProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().seedability.stats).toEqual(stats);
    });
  });

  // No `at`. The join reads an observed cloud top and a satellite cannot
  // forecast, so the live map has one hour available to it and asking for any
  // other would be asking for a build that cannot exist.
  it("asks for the analysis hour with no date on it", async () => {
    renderWithStore(
      <SeedabilityProvider>
        <span />
      </SeedabilityProvider>,
      createTestStore()
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/candidate/field/stats");
    });
  });

  it("clears the loading flag when done", async () => {
    const store = createTestStore();

    renderWithStore(
      <SeedabilityProvider>
        <span />
      </SeedabilityProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().seedability.statsLoading).toBe(false);
    });
  });

  it("dispatches the error when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <SeedabilityProvider>
        <span />
      </SeedabilityProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().seedability.statsError).toMatch(/503/);
    });
  });

  // The live map's summary and the replayed one are the same shape for
  // different hours, so a provider writing into both would put a replayed
  // date's numbers under a map drawn from this hour.
  it("leaves the replay slice alone", async () => {
    const store = createTestStore();

    renderWithStore(
      <SeedabilityProvider>
        <span />
      </SeedabilityProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().seedability.stats).toEqual(stats);
    });
    expect(store.getState().replay.stats).toBe(null);
  });
});
