// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { PirepProvider } from "@/lib/context/PirepProvider";

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

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => stats }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("PirepProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <PirepProvider>
        <span>child</span>
      </PirepProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the stats in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <PirepProvider>
        <span />
      </PirepProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().pirep.stats).toEqual(stats);
    });
  });

  // An observation feed has no forecast hour to ask for — there is only the
  // window the server pulls.
  it("asks for the summary with no parameters", async () => {
    renderWithStore(
      <PirepProvider>
        <span />
      </PirepProvider>,
      createTestStore()
    );

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith("/pireps/icing/stats");
    });
  });

  it("clears the loading flag when done", async () => {
    const store = createTestStore();

    renderWithStore(
      <PirepProvider>
        <span />
      </PirepProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().pirep.loading).toBe(false);
    });
  });

  it("dispatches the error when the feed is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <PirepProvider>
        <span />
      </PirepProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().pirep.error).toBe(
        "Failed to fetch icing reports: 503"
      );
    });
  });

  // The guard is what stops StrictMode's double-invoked effect refetching.
  it("does not refetch when the stats are already in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <PirepProvider>
        <span />
      </PirepProvider>,
      store
    );
    await waitFor(() => expect(store.getState().pirep.stats).toEqual(stats));
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    renderWithStore(
      <PirepProvider>
        <span />
      </PirepProvider>,
      store
    );

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });
});
