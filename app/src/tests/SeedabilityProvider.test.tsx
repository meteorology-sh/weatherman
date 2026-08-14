// Testing
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createTestStore } from "./utils";

// Providers
import { SeedabilityProvider } from "@/lib/context/SeedabilityProvider";

// Types
import type { CandidateStats } from "@/lib/types";

const stats: CandidateStats = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  coveragePct: 0.31,
  candidateKm2: 52560,
  peak: 340,
  liquidKm2: 249120,
  rejected: {
    noCloudBase: 41184,
    baseAboveBand: 8496,
    noCloudSeen: 96912,
    topTooWarm: 34848,
    raining: 15120,
  },
  blindKm2: 0,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17100,
  ceilingFt: 18000,
  reachablePct: 72.9,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
};

const mount = (store: ReturnType<typeof createTestStore>) =>
  render(
    <Provider store={store}>
      <SeedabilityProvider>
        <div />
      </SeedabilityProvider>
    </Provider>
  );

describe("SeedabilityProvider", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("loads the summary into the store", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(stats), { status: 200 })
    );
    const store = createTestStore();

    mount(store);

    await waitFor(() =>
      expect(store.getState().seedability.stats?.candidateKm2).toBe(52560)
    );
    expect(store.getState().seedability.loading).toBe(false);
  });

  // The join is a five-source build, so a duplicate fetch is expensive rather
  // than merely wasteful. StrictMode double-invokes effects.
  it("does not refetch once the summary is loaded", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(stats), { status: 200 }));
    const store = createTestStore();

    const { rerender } = mount(store);
    await waitFor(() =>
      expect(store.getState().seedability.stats).toBeTruthy()
    );

    rerender(
      <Provider store={store}>
        <SeedabilityProvider>
          <div />
        </SeedabilityProvider>
      </Provider>
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("asks for the live field, with no hour and no date", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify(stats), { status: 200 }));

    mount(createTestStore());

    await waitFor(() => expect(fetcher).toHaveBeenCalled());
    expect(fetcher.mock.calls[0][0]).toBe("/candidate/field/stats");
  });

  it("puts a failure in the store rather than throwing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 500 })
    );
    const store = createTestStore();

    mount(store);

    await waitFor(() =>
      expect(store.getState().seedability.error).toMatch(/500/)
    );
    expect(store.getState().seedability.loading).toBe(false);
  });
});
