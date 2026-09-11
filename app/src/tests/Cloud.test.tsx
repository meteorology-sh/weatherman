// Testing
import { act } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { Cloud } from "@/app/components/candidate/Cloud";

// Types
import type { CandidatePoint, Sounding } from "@/lib/types";

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

const sounding: Sounding = {
  run: "2025-05-15T18:00:00.000Z",
  hour: 0,
  validTime: "2025-05-15T18:00:00.000Z",
  lat: 32.05,
  lon: -101.42,
  surfaceFt: 2500,
  cclFt: null,
  freezingFt: 16000,
  bandBaseFt: 18000,
  bandTopFt: 21000,
  baseC: 30,
  topC: -30,
  levels: [],
  diagnostics: { ...noDiagnostics, vilKgM2: 24.9 },
};

const withPoint = (
  over: Partial<CandidatePoint> = {},
  column: Sounding | null = sounding
) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Cloud />, store);
  act(() => {
    if (column) store.dispatch(soundingActions.setData(column));
    store.dispatch(seedabilityActions.setHere({ ...point, ...over }));
  });
  return { store, container };
};

describe("Cloud", () => {
  it("renders nothing before a point has been read", () => {
    const { container } = renderWithStore(<Cloud />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  // FLY shows the spinner for the same read.
  it("stays quiet while the point is being read", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<Cloud />, store);
    act(() => {
      store.dispatch(seedabilityActions.setHereLoading(true));
    });

    expect(container.innerHTML).toBe("");
  });

  it("reads the base above ground, the top, and the liquid, in order", () => {
    const { container } = withPoint();

    expect(container.textContent).toContain(
      "Cloud" +
        "Base Above Ground4,000 ft AGL" +
        "Cloud-Top Temperature-14 °C" +
        "Cloud-Top PhaseSupercooled Liquid" +
        "Supercooled Liquid Water140 g/m²" +
        "Vertically Integrated Liquid24.9 kg/m²"
    );
  });

  it("dashes the base above ground where neither height answered", () => {
    const { container } = withPoint({ cloudBaseAglFt: null });

    expect(container.textContent).toContain("Base Above Ground—");
  });

  it("spells out each phase the satellite can report", () => {
    for (const [phase, label] of [
      ["ice", "Ice"],
      ["mixed", "Mixed Phase"],
      ["liquid", "Liquid"],
      ["clear", "Clear"],
      ["unknown", "Unknown"],
    ] as const) {
      const { container } = withPoint({ topPhase: phase });

      expect(container.textContent).toContain(`Cloud-Top Phase${label}`);
    }
  });

  it("dashes the phase when no scene could be read", () => {
    const { container } = withPoint({ topPhase: null, phaseTime: null });

    expect(container.textContent).toContain("Cloud-Top Phase—");
  });

  it("dashes integrated liquid until the column arrives", () => {
    const { container } = withPoint({}, null);

    expect(container.textContent).toContain("Vertically Integrated Liquid—");
  });
});
