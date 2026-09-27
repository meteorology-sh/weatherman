// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { ForecastProvider } from "@/lib/context/ForecastProvider";

// Types
import type { ForecastMeta } from "@/lib/types";

const meta: ForecastMeta = {
  run: "2026-07-17T00:00:00.000Z",
  hours: [0, 1, 2],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => meta }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("ForecastProvider", () => {
  it("renders its children", async () => {
    const { getByText } = renderWithStore(
      <ForecastProvider>
        <span>child</span>
      </ForecastProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  it("puts the run metadata in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <ForecastProvider>
        <span />
      </ForecastProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().forecast.meta).toEqual(meta);
    });
  });

  it("clears the loading flag when done", async () => {
    const store = createTestStore();

    renderWithStore(
      <ForecastProvider>
        <span />
      </ForecastProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().forecast.loading).toBe(false);
    });
  });

  it("dispatches the error when the fetch fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    const store = createTestStore();

    renderWithStore(
      <ForecastProvider>
        <span />
      </ForecastProvider>,
      store
    );

    await waitFor(() => {
      expect(store.getState().forecast.error).toBe(
        "Failed to fetch forecast metadata: 503"
      );
    });
  });

  // The guard is what stops StrictMode's double-invoked effect refetching.
  it("does not refetch when the metadata is already in the store", async () => {
    const store = createTestStore();

    renderWithStore(
      <ForecastProvider>
        <span />
      </ForecastProvider>,
      store
    );
    await waitFor(() => expect(store.getState().forecast.meta).toEqual(meta));
    const calls = (fetch as ReturnType<typeof vi.fn>).mock.calls.length;

    renderWithStore(
      <ForecastProvider>
        <span />
      </ForecastProvider>,
      store
    );

    expect((fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(calls);
  });
});
