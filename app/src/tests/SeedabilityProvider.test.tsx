// Testing
import { waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Providers
import { SeedabilityProvider } from "@/lib/context/SeedabilityProvider";

// Types
import type { CandidateStats } from "@/lib/types";

/**
 * A build's summary, cut down to the four times that name it.
 *
 * The provider reads nothing else off this — the panel dropped the figures and
 * what is left is a way to ask the server which build the layers are fetching.
 */
const stats = {
  run: "2026-08-12T04:00:00.000Z",
  validTime: "2026-08-12T04:00:00.000Z",
  sceneTime: "2026-08-12T04:01:17.900Z",
  radarTime: "2026-08-12T04:00:39.000Z",
  phase: { sceneTime: "2026-08-12T04:01:17.900Z" },
} as unknown as CandidateStats;

const BUILD =
  "2026-08-12T04:00:00.000Z|2026-08-12T04:01:17.900Z|" +
  "2026-08-12T04:00:39.000Z|2026-08-12T04:01:17.900Z";

const calls = () => (fetch as ReturnType<typeof vi.fn>).mock.calls;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => stats }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = (store = createTestStore()) => {
  renderWithStore(
    <SeedabilityProvider>
      <span>child</span>
    </SeedabilityProvider>,
    store
  );
  return store;
};

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

  // The layers fetch their geometry on load and a GeoJSONLayer keeps only the
  // features, so without this the map has no idea what it is drawing.
  it("names the build the layers open on", async () => {
    const store = mount();

    await waitFor(() => {
      expect(store.getState().seedability.drawn).toBe(BUILD);
    });
    expect(calls()[0][0]).toBe("/candidate/field/stats");
  });

  // StrictMode double-invokes effects, and a cold join is five parallel builds.
  it("asks once", async () => {
    const store = mount();
    await waitFor(() =>
      expect(store.getState().seedability.drawn).toBeTruthy()
    );

    mount(store);

    expect(calls().length).toBe(1);
  });

  // A page that cannot name its build still draws. It just cannot tell that the
  // build rolled until a click names one, and the readout raises the failure.
  it("leaves the build unnamed when the summary cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    const store = mount();

    await waitFor(() => expect(calls().length).toBeGreaterThan(0));
    expect(store.getState().seedability.drawn).toBe(null);
  });
});
