// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";

// Components
import { CloudHere } from "@/app/components/candidate/CloudHere";

// Types
import type { CandidatePoint } from "@/lib/types";

const point: CandidatePoint = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  phaseTime: "2025-05-15T18:01:17.900Z",
  lat: 32.05,
  lon: -101.42,
  verdict: "candidate",
  target: "target",
  cloudBaseAglFt: 4000,
  freezingFt: 16000,
  echoTopFt: 18000,
  slwGM2: 140,
  cloudBaseFt: 5800,
  topPhase: "supercooled",
  cloudTopC: -14,
  dbz: null,
  radarCovered: true,
};

const withPoint = (over: Partial<CandidatePoint> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<CloudHere />, store);
  act(() => {
    store.dispatch(seedabilityActions.setHere({ ...point, ...over }));
  });
  return { store, container };
};

describe("CloudHere", () => {
  it("renders nothing before a point has been read", () => {
    const { container } = renderWithStore(<CloudHere />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the point is being read", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<CloudHere />, store);
    act(() => {
      store.dispatch(seedabilityActions.setHereLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when a source is down", () => {
    const store = createTestStore();
    renderWithStore(<CloudHere />, store);
    act(() => {
      store.dispatch(seedabilityActions.setHereError("MRMS unavailable: 503"));
    });

    expect(screen.getByText("MRMS unavailable: 503")).toBeTruthy();
  });

  it("leads with FLY and the Texas numbers", () => {
    withPoint();

    expect(screen.getByText("FLY")).toBeTruthy();
    expect(screen.getByText("4,000 ft")).toBeTruthy();
    expect(screen.getByText("2,000 ft above freezing")).toBeTruthy();
    expect(screen.getByText("140 g/m²")).toBeTruthy();
  });

  it("leads with DON'T FLY when the column fails a Texas test", () => {
    withPoint({ target: "noStorm" });

    expect(screen.getByText("DON'T FLY")).toBeTruthy();
  });

  it("keeps FLY when rain is on the cell", () => {
    withPoint({ verdict: "raining", dbz: 41, target: "target" });

    expect(screen.getByText("FLY")).toBeTruthy();
    expect(screen.getByText("41 dBZ")).toBeTruthy();
  });

  it("reports missing cloud base as a dash", () => {
    withPoint({ cloudBaseAglFt: null, cloudBaseFt: null, dbz: 22 });

    expect(screen.getByText("—")).toBeTruthy();
  });

  it("separates a quiet radar from no radar over the cell", () => {
    withPoint({ dbz: null, radarCovered: true });
    expect(screen.getByText("—")).toBeTruthy();

    withPoint({ dbz: null, radarCovered: false });
    expect(screen.getByText("no radar")).toBeTruthy();
  });
});
