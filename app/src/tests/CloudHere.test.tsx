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
  cloudBaseMslFt: 5800,
  baseSource: "model",
  baseDrawn: true,
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

  it("says the base is not modeled rather than showing a dash", () => {
    // A cell can be a target with no modeled base, so a dash here would read
    // as a reading that failed to load.
    withPoint({ cloudBaseAglFt: null, cloudBaseFt: null, dbz: 22 });

    expect(screen.getByText("not modeled")).toBeTruthy();
  });

  it("separates a quiet radar from no radar over the cell", () => {
    withPoint({ dbz: null, radarCovered: true });
    expect(screen.getByText("—")).toBeTruthy();

    withPoint({ dbz: null, radarCovered: false });
    expect(screen.getByText("no radar")).toBeTruthy();
  });

  // The merged cloud-base layer's own answer, and which of its two model
  // heights gave it. Both are model output, so the source is named rather than
  // left for a reader to assume it was HRRR's own diagnosis.
  it("reads the cloud base in MSL and names the model as its source", () => {
    const { container } = withPoint();

    expect(container.textContent).toContain("5,800 ft MSL");
    expect(container.textContent).toContain("(model)");
  });

  it("names the CCL when the model had no base of its own", () => {
    const { container } = withPoint({
      cloudBaseMslFt: 7200,
      baseSource: "ccl",
    });

    expect(container.textContent).toContain("7,200 ft MSL");
    expect(container.textContent).toContain("(CCL)");
  });

  it("dashes the cloud base where neither height answered", () => {
    const { container } = withPoint({
      cloudBaseMslFt: null,
      baseSource: null,
      baseDrawn: false,
    });

    expect(container.textContent).toContain("Cloud Base");
    expect(container.textContent).not.toContain("ft MSL");
  });

  // The one observation of phase this app has. It is reported and never allowed
  // to rule a cell out, so it sits beside the readings rather than in the
  // verdict.
  it("reports the observed cloud-top phase", () => {
    const { container } = withPoint();

    expect(container.textContent).toContain("Observed Cloud-Top Phase");
    expect(container.textContent).toContain("Supercooled liquid");
  });

  it("spells out each phase the satellite can report", () => {
    for (const [phase, label] of [
      ["ice", "Ice"],
      ["mixed", "Mixed phase"],
      ["liquid", "Liquid"],
      ["clear", "Clear"],
      ["unknown", "Unknown"],
    ] as const) {
      const { container } = withPoint({ topPhase: phase });

      expect(container.textContent).toContain(label);
    }
  });

  it("dashes the phase when no scene could be read", () => {
    const { container } = withPoint({ topPhase: null, phaseTime: null });

    expect(container.textContent).toContain("Observed Cloud-Top Phase");
    expect(container.textContent).not.toContain("Supercooled liquid");
  });
});
