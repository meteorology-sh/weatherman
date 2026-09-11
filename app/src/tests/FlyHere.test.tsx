// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";

// Components
import { FlyHere } from "@/app/components/candidate/FlyHere";

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
  cloudBaseMslFt: 5800,
  baseSource: "model",
  baseDrawn: true,
  cclFt: 6400,
  payload: "both",
  warmCloudDepthFt: 8000,
  topPhase: "supercooled",
  cloudTopC: -14,
  dbz: null,
  radarCovered: true,
};

const withPoint = (over: Partial<CandidatePoint> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<FlyHere />, store);
  act(() => {
    store.dispatch(seedabilityActions.setHere({ ...point, ...over }));
  });
  return { store, container };
};

describe("FlyHere", () => {
  it("renders nothing before a point has been read", () => {
    const { container } = renderWithStore(<FlyHere />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the point is being read", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<FlyHere />, store);
    act(() => {
      store.dispatch(seedabilityActions.setHereLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when a source is down", () => {
    const store = createTestStore();
    renderWithStore(<FlyHere />, store);
    act(() => {
      store.dispatch(seedabilityActions.setHereError("MRMS unavailable: 503"));
    });

    expect(screen.getByText("MRMS unavailable: 503")).toBeTruthy();
  });

  it("leads with FLY and the tests behind it, in order", () => {
    const { container } = withPoint();

    expect(screen.getByText("FLY")).toBeTruthy();
    expect(container.textContent).toContain(
      "Cloud Base5,800 ft MSL (model)" +
        "18 dBZ Echo Top2,000 ft above freezing" +
        "Rain—" +
        "Warm-Cloud Depth8,000 ft"
    );
  });

  // Every test passed, so there is nothing to name.
  it("gives no reason on FLY", () => {
    const { container } = withPoint();

    expect(container.textContent).not.toContain("Reason");
  });

  it("leads with DON'T FLY and names the test the cell failed", () => {
    const { container } = withPoint({ target: "noStorm" });

    expect(screen.getByText("DON'T FLY")).toBeTruthy();
    expect(container.textContent).toContain("ReasonNo Rain Nearby");
  });

  it("names the ceiling a base was held under", () => {
    withPoint({ target: "baseTooHigh" });

    expect(
      screen.getByText("Cloud Base at or Above 18,000 ft MSL")
    ).toBeTruthy();
  });

  it("keeps FLY when rain is on the cell", () => {
    withPoint({ verdict: "raining", dbz: 41, target: "target" });

    expect(screen.getByText("FLY")).toBeTruthy();
    expect(screen.getByText("41 dBZ")).toBeTruthy();
  });

  it("separates a quiet radar from no radar over the cell", () => {
    const { container } = withPoint({ dbz: null, radarCovered: true });
    expect(container.textContent).toContain("Rain—");

    withPoint({ dbz: null, radarCovered: false });
    expect(screen.getByText("No Radar")).toBeTruthy();
  });

  // Both heights are model output, so the source is named rather than left
  // for a reader to assume it was HRRR's own diagnosis.
  it("names the CCL when the model had no base of its own", () => {
    const { container } = withPoint({
      cloudBaseMslFt: 7200,
      baseSource: "ccl",
    });

    expect(container.textContent).toContain("7,200 ft MSL (CCL)");
  });

  it("dashes the cloud base where neither height answered", () => {
    const { container } = withPoint({
      cloudBaseMslFt: null,
      baseSource: null,
      baseDrawn: false,
      cclFt: null,
    });

    expect(container.textContent).toContain("Cloud Base—");
  });

  // The fill answers where to go; the badge answers what to drop.
  it("badges which flare the column supports beside FLY", () => {
    const { container } = withPoint();

    expect(container.textContent).toContain("FLY");
    expect(container.textContent).toContain("ICE + SALT");
  });

  it("names salt alone on a cloud whose top never froze", () => {
    const { container } = withPoint({ payload: "salt" });

    expect(container.textContent).toContain("SALT");
    expect(container.textContent).not.toContain("ICE");
  });

  it("does not name a flare for a cell nobody is flying to", () => {
    const { container } = withPoint({ target: "noStorm", payload: "salt" });

    expect(container.textContent).toContain("DON'T FLY");
    expect(container.textContent).not.toContain("SALT");
  });

  it("says there is no warm layer rather than dashing it", () => {
    const { container } = withPoint({ warmCloudDepthFt: null });

    expect(container.textContent).toContain("Warm-Cloud DepthNone");
  });
});
