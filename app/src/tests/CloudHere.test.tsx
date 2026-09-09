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
    // Several rows can be empty at once, so the dash is read off the Rain row
    // rather than off the panel.
    const { container } = withPoint({ dbz: null, radarCovered: true });
    expect(container.textContent).toContain("Rain—");

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

  // The fill answers where to go; the badge answers what to drop. The two are
  // independent — a deep warm layer says nothing about whether the top froze —
  // so the payload is its own badge rather than part of the verdict.
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

  it("prints the warm layer a salt flare would work in", () => {
    const { container } = withPoint();

    expect(container.textContent).toContain("Warm-Cloud Depth8,000 ft");
  });

  it("says there is no warm layer rather than dashing it", () => {
    const { container } = withPoint({ warmCloudDepthFt: null });

    expect(container.textContent).toContain("Warm-Cloud Depthnone");
  });

  // The height behind the source name. A CCL well above a modeled base is a
  // different cloud from one whose base is already there, and the panel cannot
  // say so while printing only which of the two answered.
  it("prints the CCL beside the base the layer took", () => {
    const { container } = withPoint();

    expect(container.textContent).toContain("CCL6,400 ft MSL");
  });

  it("dashes the CCL where the column never saturates", () => {
    const { container } = withPoint({ cclFt: null });

    expect(container.textContent).toContain("CCL—");
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
