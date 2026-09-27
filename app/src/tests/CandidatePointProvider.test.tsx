// Testing
import { act, waitFor } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";
import { seedabilityActions } from "@/lib/store/features/seedability";

// Providers
import { CandidatePointProvider } from "@/lib/context/CandidatePointProvider";

// Types
import type { CandidatePoint } from "@/lib/types";

const point: CandidatePoint = {
  run: "2026-08-12T04:00:00.000Z",
  validTime: "2026-08-12T04:00:00.000Z",
  sceneTime: "2026-08-12T04:01:17.900Z",
  radarTime: "2026-08-12T04:00:39.000Z",
  phaseTime: "2026-08-12T04:01:17.900Z",
  lat: 39.8,
  lon: -98.54,
  verdict: "noLiquid",
  target: "noCloudBase",
  cloudBaseAglFt: null,
  freezingFt: null,
  echoTopFt: null,
  slwGM2: 0,
  cloudBaseFt: null,
  topPhase: "supercooled",
  cloudTopC: null,
  dbz: null,
  radarCovered: true,
  cloudBaseMslFt: null,
  baseSource: null,
  baseDrawn: false,
  payload: null,
  warmCloudDepthFt: null,
  cclFt: null,
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

  // Unlike the sounding, this one waits: the readout is about the cell an
  // operator picked, and the default center of the country is not one.
  it("reads nothing until the map is clicked", () => {
    const store = mount();

    expect(calls().length).toBe(0);
    expect(store.getState().seedability.here).toBeUndefined();
  });

  // Clicking the map clears the stored point, and that is what makes this
  // provider read the new cell.
  it("reads the cell when the map is clicked", async () => {
    const store = mount();

    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    await waitFor(() => {
      expect(store.getState().seedability.here).toEqual(point);
    });
    expect(calls()[0][0]).toBe("/candidate/point?lat=39.74&lon=-104.99");
  });

  it("rereads when the point moves again", async () => {
    const store = mount();
    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });
    await waitFor(() => expect(store.getState().seedability.here).toBeTruthy());

    act(() => {
      store.dispatch(soundingActions.setPoint([-101.42, 32.05]));
    });

    await waitFor(() => {
      expect(calls()[calls().length - 1][0]).toBe(
        "/candidate/point?lat=32.05&lon=-101.42"
      );
    });
  });

  it("does not reread while the point is unchanged", async () => {
    const store = mount();
    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });
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
    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    await waitFor(() => {
      expect(store.getState().seedability.hereError).toBe(
        "Failed to fetch the point: 500"
      );
    });
  });

  it("clears its loading flag once the point is read", async () => {
    const store = mount();
    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    await waitFor(() => {
      expect(store.getState().seedability.here).toBeTruthy();
    });
    expect(store.getState().seedability.hereLoading).toBe(false);
  });

  // The map cannot tell that the server rebuilt underneath it, and the answer
  // to a click is the only thing that arrives already knowing.
  it("names the build the answer came off", async () => {
    const store = mount();
    act(() => {
      store.dispatch(soundingActions.setPoint([-104.99, 39.74]));
    });

    await waitFor(() => {
      expect(store.getState().seedability.drawn).toBe(
        [point.run, point.sceneTime, point.radarTime, point.phaseTime].join("|")
      );
    });
  });

  // A click off the edge of the model says nothing about which build is
  // current, so it must not overwrite one.
  it("leaves the build alone when the click lands off the grid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );
    const store = mount();
    act(() => {
      store.dispatch(seedabilityActions.setDrawn("named|before|the|click"));
      store.dispatch(soundingActions.setPoint([-10, 10]));
    });

    await waitFor(() => {
      expect(store.getState().seedability.hereLoading).toBe(false);
    });
    expect(store.getState().seedability.drawn).toBe("named|before|the|click");
  });
});
