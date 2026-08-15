// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { cloudBaseActions } from "@/lib/store/features/cloudbase";

// ArcGIS
import { CEILING_LABEL } from "@/lib/arcgis/legends";

// Components
import { CloudBase } from "@/app/components/candidate/CloudBase";

// Types
import type { CloudBaseStats } from "@/lib/types";

/** 2025-05-15 18z f00, from the live route. */
const stats: CloudBaseStats = {
  run: "2025-05-15T18:00:00.000Z",
  hour: 0,
  validTime: "2025-05-15T18:00:00.000Z",
  basePct: 55.88,
  reachablePct: 17.14,
  reachableKm2: 2925792,
  medianFt: 3719,
};

const withStats = (over: Partial<CloudBaseStats> = {}) => {
  const store = createTestStore();
  renderWithStore(<CloudBase />, store);
  act(() => {
    store.dispatch(cloudBaseActions.setVisible(true));
    store.dispatch(cloudBaseActions.setStats({ ...stats, ...over }));
  });
  return store;
};

describe("CloudBase panel", () => {
  // The layer starts off, and a panel describing a layer nobody is drawing
  // describes a map that is not there.
  it("renders nothing while the layer is hidden", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<CloudBase />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setStats(stats));
    });

    expect(container.innerHTML).toBe("");
  });

  // What share of the country has cloud over it decides nothing an operator
  // does. The ground below the ceiling is the number they choose from, and the
  // base over the cell they clicked is in the point readout.
  it("does not report cloud as a share of the domain", () => {
    withStats();

    expect(screen.queryByText(/55\.88/)).toBeNull();
    expect(screen.queryByText(/17\.14/)).toBeNull();
  });

  // The aircraft's limit, not Texas's window: a service ceiling is the same
  // height everywhere, which is what lets this figure mean one thing across the
  // whole domain.
  it("names the ceiling the figure is measured against", () => {
    withStats();

    expect(
      screen.getByText(new RegExp(`${CEILING_LABEL} ceiling`))
    ).toBeTruthy();
  });

  it("reports the reachable ground in km²", () => {
    withStats();

    expect(screen.getByText(/2,925,792 km²/)).toBeTruthy();
  });

  // MSL, and it has to say so: the sounding's band altitudes are MSL too, and
  // asking whether the band is inside the cloud compares the two.
  it("reports the median base with its datum", () => {
    withStats();

    expect(screen.getByText(/median base 3,719 ft MSL/)).toBeTruthy();
  });

  // A clear domain is a real answer, not a missing one.
  it("says so plainly when the model has no cloud anywhere", () => {
    withStats({ basePct: 0, reachablePct: 0, reachableKm2: 0, medianFt: null });

    expect(screen.getByText(/no cloud anywhere in the domain/)).toBeTruthy();
  });

  it("shows a spinner while the build is running", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<CloudBase />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
      store.dispatch(cloudBaseActions.setLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when the build fails", () => {
    const store = createTestStore();
    renderWithStore(<CloudBase />, store);
    act(() => {
      store.dispatch(cloudBaseActions.setVisible(true));
      store.dispatch(cloudBaseActions.setError("HRRR index unavailable: 404"));
    });

    expect(screen.getByText("HRRR index unavailable: 404")).toBeTruthy();
  });
});
