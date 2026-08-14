// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { radarActions } from "@/lib/store/features/radar";

// Components
import { Radar } from "@/app/components/candidate/Radar";

// Types
import type { RadarStats } from "@/lib/types";

const stats: RadarStats = {
  fetchedAt: "2026-08-12T04:15:46.334Z",
  validTime: "2026-08-12T04:10:00.000Z",
  radarCoveragePct: 67.33,
  echoPct: 2.01,
  echoKm2: 309859,
  peakDbz: 57,
};

const withStats = (over: Partial<RadarStats> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Radar />, store);
  act(() => {
    store.dispatch(radarActions.setStats({ ...stats, ...over }));
  });
  return { store, container };
};

describe("Radar", () => {
  it("renders nothing before the scene arrives", () => {
    const { container } = renderWithStore(<Radar />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the mosaic is being read", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<Radar />, store);
    act(() => {
      store.dispatch(radarActions.setLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when the mosaic is down", () => {
    const store = createTestStore();

    renderWithStore(<Radar />, store);
    act(() => {
      store.dispatch(radarActions.setError("MRMS mosaic unavailable: 503"));
    });

    expect(screen.getByText("MRMS mosaic unavailable: 503")).toBeTruthy();
  });

  it("reports how much ground is precipitating", () => {
    withStats();

    expect(screen.getByText("309,859 km²")).toBeTruthy();
  });

  // The honesty of this panel: 2% of *covered* ground, not of the map. A third
  // of the map has no radar over it.
  it("measures the echo against covered ground", () => {
    withStats();

    expect(
      screen.getByText(/2.01% of covered ground over 20 dBZ/)
    ).toBeTruthy();
  });

  // Without this the empty parts of the map read as "clear", when they are
  // really "unwatched".
  it("says how much of the map the radars can see at all", () => {
    withStats();

    expect(screen.getByText(/Radars cover 67.33% of this map/)).toBeTruthy();
    expect(screen.getByText(/nobody is looking/)).toBeTruthy();
  });

  it("reports the strongest cell", () => {
    withStats();

    expect(screen.getByText("57 dBZ")).toBeTruthy();
    expect(screen.getByText(/hail is likely/)).toBeTruthy();
  });

  it("does not claim hail below the intense band", () => {
    withStats({ peakDbz: 34 });

    expect(screen.getByText(/Below the intense threshold/)).toBeTruthy();
  });

  // A quiet scene is a real answer — it means nothing is disqualified — and it
  // must not render as a stat block full of zeroes.
  it("says plainly when nothing is precipitating", () => {
    withStats({ echoKm2: 0, echoPct: 0, peakDbz: null });

    expect(screen.getByText(/Nothing is disqualified by rain/)).toBeTruthy();
  });

  it("still reports radar coverage on a quiet scene", () => {
    withStats({ echoKm2: 0, echoPct: 0, peakDbz: null });

    expect(screen.getByText(/Radars cover 67.33% of this map/)).toBeTruthy();
  });

  // A radar scene is only readable with its age attached — the panel reports the
  // scene's own valid time, never the fetch time.
  it("reports the scene's time and how old it is", () => {
    withStats();

    expect(screen.getByText(/MRMS scene 2026-08-12 04:10Z/)).toBeTruthy();
  });

  it("goes quiet when the layer is switched off", () => {
    const { store, container } = withStats();
    act(() => {
      store.dispatch(radarActions.setVisible(false));
    });

    expect(container.innerHTML).toBe("");
  });
});
