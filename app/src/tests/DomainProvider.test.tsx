// Testing
import { render, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createTestStore } from "./utils";

// Providers
import { DomainProvider } from "@/lib/context/DomainProvider";

const ring = [
  [-120, 25],
  [-70, 25],
  [-70, 50],
  [-120, 25],
];

const frame = {
  type: "FeatureCollection",
  features: [
    {
      type: "Feature",
      properties: {},
      geometry: { type: "Polygon", coordinates: [ring] },
    },
  ],
};

const ok = () =>
  vi.fn(async () => ({ ok: true, status: 200, json: async () => frame }));

describe("DomainProvider", () => {
  it("loads the model's edge into the store", async () => {
    vi.stubGlobal("fetch", ok());
    const store = createTestStore();

    render(
      <Provider store={store}>
        <DomainProvider>
          <div />
        </DomainProvider>
      </Provider>
    );

    await waitFor(() => expect(store.getState().domain.ring).toEqual(ring));
  });

  // The grid is the same shape for every run, so a second fetch could only ever
  // return what is already held.
  it("does not fetch again once it has the ring", async () => {
    const fetcher = ok();
    vi.stubGlobal("fetch", fetcher);
    const store = createTestStore();

    const { rerender } = render(
      <Provider store={store}>
        <DomainProvider>
          <div />
        </DomainProvider>
      </Provider>
    );
    await waitFor(() => expect(store.getState().domain.ring).toEqual(ring));
    rerender(
      <Provider store={store}>
        <DomainProvider>
          <div />
        </DomainProvider>
      </Provider>
    );

    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  // Nothing waits on this, so a failure must not stop the map: the click guard
  // falls back to letting the server decide, which is what it did before the
  // ring existed.
  it("records the failure and leaves the ring empty", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    const store = createTestStore();

    render(
      <Provider store={store}>
        <DomainProvider>
          <div />
        </DomainProvider>
      </Provider>
    );

    await waitFor(() => expect(store.getState().domain.error).toBeTruthy());
    expect(store.getState().domain.ring).toBe(null);
  });
});
