// Testing
import { act, waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";

// Providers
import { CandidatePointProvider } from "@/lib/context/CandidatePointProvider";

// Types
import type { CandidatePoint } from "@/lib/types";

const point: CandidatePoint = {
  run: "2026-08-12T04:00:00.000Z",
  validTime: "2026-08-12T04:00:00.000Z",
  sceneTime: "2026-08-12T04:01:17.900Z",
  radarTime: "2026-08-12T04:00:39.000Z",
  lat: 39.8,
  lon: -98.54,
  verdict: "noLiquid",
  slwGM2: 0,
  cloudBaseFt: null,
  cloudTopC: null,
  dbz: null,
  radarCovered: true,
};

const calls = () => (fetch as ReturnType<typeof vi.fn>).mock.calls;

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => point }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const mount = (store = createTestStore()) => {
  renderWithStore(
    <CandidatePointProvider>
      <span>child</span>
    </CandidatePointProvider>,
    store
  );
  return store;
};

describe("CandidatePointProvider", () => {
  it("renders its children", () => {
    const { getByText } = renderWithStore(
      <CandidatePointProvider>
        <span>child</span>
      </CandidatePointProvider>,
      createTestStore()
    );

    expect(getByText("child")).toBeTruthy();
  });

  // Like the sounding, it reads the default point on mount rather than waiting
  // for a click: a panel that starts empty teaches nobody that the map is
  // clickable.
  it("reads the default point without being asked", async () => {
    const store = mount();

    await waitFor(() => {
      expect(store.getState().seedability.here).toEqual(point);
    });
    expect(calls()[0][0]).toBe("/candidate/point?lat=39.83&lon=-98.58");
  });

  // Clicking the map clears the stored point, and that is what makes this
  // provider read the new cell.
  it("rereads when the point moves", async () => {
    const store = mount();
    await waitFor(() => expect(store.getState().seedability.here).toBeTruthy());

    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    await waitFor(() => {
      expect(calls()[calls().length - 1][0]).toBe(
        "/candidate/point?lat=39.74&lon=-104.99"
      );
    });
  });

  it("does not reread while the point is unchanged", async () => {
    const store = mount();
    await waitFor(() => expect(store.getState().seedability.here).toBeTruthy());
    const before = calls().length;

    mount(store);

    expect(calls().length).toBe(before);
  });

  it("dispatches the error when the join cannot be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    const store = mount();

    await waitFor(() => {
      expect(store.getState().seedability.hereError).toBe(
        "Failed to fetch the point: 500"
      );
    });
  });

  // The field's own summary has its own flags, and a click must not make the
  // layer's panel look like it is still loading.
  it("keeps its loading flag separate from the field's", async () => {
    const store = mount();

    await waitFor(() => {
      expect(store.getState().seedability.hereLoading).toBe(false);
    });
    expect(store.getState().seedability.loading).toBe(false);
  });
});
