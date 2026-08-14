// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { candidateActions } from "@/lib/store/features/candidate";

// Components
import { Liquid } from "@/app/components/candidate/Liquid";

// Types
import type { SlwStats } from "@/lib/types";

const stats: SlwStats = {
  run: "2026-07-17T03:00:00.000Z",
  hour: 0,
  validTime: "2026-07-17T03:00:00.000Z",
  coveragePct: 1.99,
  seedableKm2: 338832,
  peak: 964,
  bandTopMb: 425,
  bandBaseMb: 700,
};

const withStats = (over: Partial<SlwStats> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Liquid />, store);
  act(() => {
    store.dispatch(candidateActions.setStats({ ...stats, ...over }));
  });
  return { store, container };
};

describe("Liquid", () => {
  it("renders nothing before the stats arrive", () => {
    const { container } = renderWithStore(<Liquid />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the server integrates", () => {
    const store = createTestStore();

    const { container } = renderWithStore(<Liquid />, store);
    act(() => {
      store.dispatch(candidateActions.setLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when the build fails", () => {
    const store = createTestStore();

    renderWithStore(<Liquid />, store);
    act(() => {
      store.dispatch(candidateActions.setError("HRRR index unavailable: 404"));
    });

    expect(screen.getByText("HRRR index unavailable: 404")).toBeTruthy();
  });

  it("reports the seedable ground", () => {
    withStats();

    expect(screen.getByText("338,832 km²")).toBeTruthy();
  });

  it("reports the richest cell", () => {
    withStats();

    expect(screen.getByText("964 g/m²")).toBeTruthy();
  });

  // The altitude is the one number that tells the operator where to fly.
  it("reports the altitude the seeding band sits at", () => {
    withStats();

    expect(screen.getByText("425–700 mb")).toBeTruthy();
  });

  it("calls out a prime target when one exists", () => {
    withStats({ peak: 964 });

    expect(screen.getByText(/A prime target exists/)).toBeTruthy();
  });

  it("says so when the best cell is below the prime threshold", () => {
    withStats({ peak: 120 });

    expect(screen.getByText(/Below the prime-target threshold/)).toBeTruthy();
  });

  // A zero here is a real verdict, not a missing reading, and it should read
  // like one rather than as an empty stats block.
  it("says plainly when there is nothing to seed", () => {
    withStats({
      coveragePct: 0,
      seedableKm2: 0,
      peak: 0,
      bandTopMb: null,
      bandBaseMb: null,
    });

    expect(screen.getByText(/Nothing to seed/)).toBeTruthy();
  });

  it("goes quiet when the layer is switched off", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<Liquid />, store);
    act(() => {
      store.dispatch(candidateActions.setStats(stats));
    });
    act(() => {
      store.dispatch(candidateActions.setLiquid(false));
    });

    expect(container.innerHTML).toBe("");
  });
});
