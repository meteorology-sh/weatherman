// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { cloudBaseActions } from "@/lib/store/features/cloudbase";

// Components
import { CloudBase } from "@/app/components/CloudBase";

// Types
import type { CloudBaseStats } from "@/lib/types";

/** 2025-05-15 18z f00, from the live route. */
const stats: CloudBaseStats = {
  run: "2025-05-15T18:00:00.000Z",
  hour: 0,
  validTime: "2025-05-15T18:00:00.000Z",
  basePct: 55.88,
  windowPct: 17.14,
  windowKm2: 2925792,
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

  it("reports how much of the domain has a cloud base", () => {
    withStats();

    expect(screen.getByText("55.88%")).toBeTruthy();
  });

  it("reports how much of it sits in the operational window", () => {
    withStats();

    expect(screen.getByText("17.14%")).toBeTruthy();
  });

  it("names the window the figure is measured against", () => {
    withStats();

    expect(screen.getByText(/4,000–12,000 ft window/)).toBeTruthy();
  });

  it("reports the ground in the window in km²", () => {
    withStats();

    expect(screen.getByText(/2,925,792 km²/)).toBeTruthy();
  });

  // MSL, and it has to say so: the sounding's band altitudes are MSL too, and
  // C2 compares the two.
  it("reports the median base with its datum", () => {
    withStats();

    expect(screen.getByText(/median base 3,719 ft MSL/)).toBeTruthy();
  });

  // A clear domain is a real answer, not a missing one.
  it("says so plainly when the model has no cloud anywhere", () => {
    withStats({ basePct: 0, windowPct: 0, windowKm2: 0, medianFt: null });

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
