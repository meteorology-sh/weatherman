// Testing
import { act, waitFor } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";

// Providers
import { SoundingProvider } from "@/lib/context/SoundingProvider";

// Types
import type { Sounding } from "@/lib/types";

const sounding: Sounding = {
  run: "2026-08-12T04:00:00.000Z",
  hour: 0,
  validTime: "2026-08-12T04:00:00.000Z",
  lat: 39.8,
  lon: -98.54,
  surfaceFt: 1830,
  freezingFt: 16433,
  bandBaseFt: 18685,
  bandTopFt: 22066,
  baseC: 34.9,
  topC: -18.1,
  levels: [{ mb: 550, tempC: -1.32, heightFt: 16966 }],
  diagnostics: noDiagnostics,
};

const calls = () => (fetch as ReturnType<typeof vi.fn>).mock.calls;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => sounding }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = (store = createTestStore()) => {
  renderWithStore(
    <SoundingProvider>
      <span>child</span>
    </SoundingProvider>,
    store
  );
  return store;
};

describe("SoundingProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <SoundingProvider>
        <span>child</span>
      </SoundingProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  // It fetches on mount rather than waiting for a click, because the first
  // build is ~30 s on the server and the panel would otherwise be empty.
  it("profiles the default point without being asked", async () => {
    const store = mount();

    await waitFor(() => {
      expect(store.getState().sounding.data).toEqual(sounding);
    });
    expect(calls()[0][0]).toBe(
      "/forecast/sounding?lat=39.83&lon=-98.58&hour=0"
    );
  });

  // The candidate map is "right now", so the profile is the analysis hour.
  it("asks for the analysis hour", async () => {
    mount();

    await waitFor(() => {
      expect(calls()[0][0]).toContain("hour=0");
    });
  });

  // Unlike the other providers this one is meant to re-run: setPoint clears the
  // data, and that is what makes a click on the map fetch a new column.
  it("refetches when the point moves", async () => {
    const store = mount();
    await waitFor(() => expect(store.getState().sounding.data).toBeTruthy());

    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    await waitFor(() => {
      expect(calls()[calls().length - 1][0]).toBe(
        "/forecast/sounding?lat=39.74&lon=-104.99&hour=0"
      );
    });
  });

  it("does not refetch while the point is unchanged", async () => {
    const store = mount();
    await waitFor(() => expect(store.getState().sounding.data).toBeTruthy());
    const before = calls().length;

    mount(store);

    expect(calls().length).toBe(before);
  });

  it("dispatches the error when the column cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    const store = mount();

    await waitFor(() => {
      expect(store.getState().sounding.error).toBe(
        "Failed to fetch the sounding: 500"
      );
    });
  });

  it("clears the loading flag when done", async () => {
    const store = mount();

    await waitFor(() => {
      expect(store.getState().sounding.loading).toBe(false);
    });
  });
});
