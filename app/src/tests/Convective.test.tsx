// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { Convective } from "@/app/components/candidate/Convective";

// Types
import type { Diagnostics, Sounding } from "@/lib/types";

const deep: Diagnostics = {
  cloudBaseFt: 3456,
  cloudBaseAglFt: 2508,
  cloudTopFt: 39562,
  depthFt: 36106,
  bandInCloud: true,
  capeJKg: 2499,
  mixedCapeJKg: 2339,
  cinJKg: 45,
  lclFt: 4200,
  stormMotionKt: 35,
  stormMotionTowardDeg: 13,
  lightning: 2,
  vilKgM2: 24.9,
  echoTopFt: 34498,
};

const sounding: Sounding = {
  run: "2025-05-15T18:00:00.000Z",
  hour: 1,
  validTime: "2025-05-15T19:00:00.000Z",
  lat: 44.91,
  lon: -93.63,
  surfaceFt: 948,
  freezingFt: 12072,
  bandBaseFt: 14604,
  bandTopFt: 21159,
  baseC: 27.2,
  topC: -38.9,
  levels: [{ mb: 550, tempC: -1.32, heightFt: 16966 }],
  diagnostics: deep,
};

const withDiagnostics = (over: Partial<Diagnostics> = {}) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Convective />, store);
  act(() => {
    store.dispatch(
      soundingActions.setData({
        ...sounding,
        diagnostics: { ...deep, ...over },
      })
    );
  });
  return { store, container };
};

describe("Convective panel", () => {
  it("renders nothing before a point has been profiled", () => {
    const { container } = renderWithStore(<Convective />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("reports CAPE, CIN, LCL, and warm-cloud depth", () => {
    withDiagnostics();

    expect(screen.getByText("2,339 J/kg")).toBeTruthy();
    expect(screen.getByText("2,499 J/kg")).toBeTruthy();
    expect(screen.getByText("45 J/kg")).toBeTruthy();
    expect(screen.getByText("4,200 ft")).toBeTruthy();
    expect(screen.getByText("8,616 ft")).toBeTruthy();
  });
});
