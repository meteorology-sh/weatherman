// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { cloudTopActions } from "@/lib/store/features/cloudtop";

// Components
import { CloudTop } from "@/app/components/candidate/CloudTop";

// Types
import type { CloudTopStats } from "@/lib/types";

const stats: CloudTopStats = {
  fetchedAt: "2026-08-13T01:48:42.658Z",
  validTime: "2026-08-13T01:41:17.900Z",
  profileRun: "2026-08-13T00:00:00.000Z",
  cloudPct: 53.66,
  seedableTopPct: 41.5,
  seedableKm2: 7083216,
  coldestTopC: -68.4,
};

/**
 * A store with the layer switched on. The map opens on the candidate field
 * alone, so every readout below is about a layer the operator has asked for —
 * switching it on is the precondition, not the thing under test.
 */
const shown = () => {
  const store = createTestStore();
  store.dispatch(cloudTopActions.setVisible(true));
  return store;
};

const withStats = (over: Partial<CloudTopStats> = {}) => {
  const store = shown();
  renderWithStore(<CloudTop />, store);
  act(() => {
    store.dispatch(cloudTopActions.setStats({ ...stats, ...over }));
  });
  return store;
};

describe("CloudTop panel", () => {
  // A share of the country's sky decides nothing. How much cloud has a top
  // cold enough is the number to fly against, and the top over the clicked
  // cell is in the point readout.
  it("does not report cloud as a share of the domain", () => {
    withStats();

    expect(screen.queryByText(/53\.66/)).toBeNull();
    expect(screen.queryByText(/41\.5%/)).toBeNull();
  });

  it("reports the seedable ground in km²", () => {
    withStats();

    expect(screen.getByText(/7,083,216 km²/)).toBeTruthy();
  });

  it("reports the coldest top", () => {
    withStats();

    expect(screen.getByText(/coldest -68.4 °C/)).toBeTruthy();
  });

  // The layer is assembled from two sources and the panel is the only place
  // that says so. An operator reading a temperature deserves to know it came
  // from a model run, not from the satellite that drew the shape.
  it("names both sources and their times", () => {
    withStats();

    expect(screen.getByText(/GOES-East/)).toBeTruthy();
    expect(screen.getByText(/2026-08-13 00:00Z/)).toBeTruthy();
  });

  it("reports the scene's own scan time, not when we fetched it", () => {
    withStats();

    expect(screen.getByText(/2026-08-13 01:41Z/)).toBeTruthy();
  });

  // A clear sky is a real answer. Reporting "0% of 0%" would read as a broken
  // feed rather than as a cloudless domain.
  it("says so plainly when there is no cloud at all", () => {
    withStats({
      cloudPct: 0,
      seedableTopPct: 0,
      seedableKm2: 0,
      coldestTopC: null,
    });

    expect(screen.getByText(/sees no cloud anywhere/)).toBeTruthy();
  });

  it("renders nothing while the layer is switched off", () => {
    const store = shown();
    const { container } = renderWithStore(<CloudTop />, store);

    act(() => {
      store.dispatch(cloudTopActions.setStats(stats));
      store.dispatch(cloudTopActions.setVisible(false));
    });

    expect(container.innerHTML).toBe("");
  });

  it("renders nothing until the layer is switched on", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<CloudTop />, store);

    act(() => {
      store.dispatch(cloudTopActions.setStats(stats));
    });

    expect(container.innerHTML).toBe("");
  });

  it("shows the error instead of the numbers", () => {
    const store = shown();
    renderWithStore(<CloudTop />, store);

    act(() => {
      store.dispatch(cloudTopActions.setError("the satellite feed is down"));
    });

    expect(screen.getByText("the satellite feed is down")).toBeTruthy();
  });

  it("shows a spinner while it loads", () => {
    const store = shown();
    renderWithStore(<CloudTop />, store);

    act(() => {
      store.dispatch(cloudTopActions.setLoading(true));
    });

    expect(screen.getByText(/Reading the satellite scene/)).toBeTruthy();
  });
});
