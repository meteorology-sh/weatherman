// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, noDiagnostics, renderWithStore } from "./utils";

// Store
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { Convective } from "@/app/components/Convective";

// Types
import type { Diagnostics, Sounding } from "@/lib/types";

/** A deep convective cell, 2025-05-15 19Z, from the live route. */
const deep: Diagnostics = {
  cloudBaseFt: 3456,
  cloudBaseAglFt: 2508,
  cloudTopFt: 39562,
  depthFt: 36106,
  bandInCloud: true,
  capeJKg: 2499,
  mixedCapeJKg: 2339,
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

  it("reports the cloud base with its datum", () => {
    withDiagnostics();

    expect(screen.getByText("3,456 ft")).toBeTruthy();
    expect(screen.getByText(/MSL · 2,508 ft above the ground/)).toBeTruthy();
  });

  it("reports the depth from base to top", () => {
    withDiagnostics();

    expect(screen.getByText("36,106 ft")).toBeTruthy();
    expect(screen.getByText(/Top at 39,562 ft MSL/)).toBeTruthy();
  });

  describe("C2", () => {
    it("says the band is inside the cloud when it is", () => {
      withDiagnostics();

      expect(screen.getByText(/seeding band is inside the cloud/)).toBeTruthy();
    });

    it("says the band and the cloud do not overlap when they do not", () => {
      withDiagnostics({ bandInCloud: false });

      expect(screen.getByText(/do not overlap/)).toBeTruthy();
    });

    // The common case, and the one that must not read as a "no": HRRR reports
    // a cloud top over far less ground than it reports a base.
    it("says it cannot be evaluated rather than failing it", () => {
      withDiagnostics({ bandInCloud: null, cloudTopFt: null, depthFt: null });

      expect(screen.getByText(/C2 cannot be evaluated here/)).toBeTruthy();
      expect(screen.queryByText(/do not overlap/)).toBeNull();
    });

    it("explains a missing depth by the missing cloud top", () => {
      withDiagnostics({ bandInCloud: null, cloudTopFt: null, depthFt: null });

      expect(screen.getByText(/diagnoses no cloud top here/)).toBeTruthy();
    });
  });

  it("says plainly when the model has no cloud over the point", () => {
    withDiagnostics({ ...noDiagnostics });

    expect(screen.getByText(/no cloud over this cell/)).toBeTruthy();
  });

  it("reports both CAPE parcels", () => {
    withDiagnostics();

    expect(screen.getByText("2,499 J/kg")).toBeTruthy();
    expect(screen.getByText("2,339 J/kg")).toBeTruthy();
  });

  // Storm motion is named by where it is going, and the compass point is what
  // an operator reads rather than the bearing alone.
  it("reports storm motion as a speed and a direction it moves toward", () => {
    withDiagnostics();

    expect(screen.getByText("35 kt toward N (13°)")).toBeTruthy();
  });

  it("gives no direction for still air", () => {
    withDiagnostics({ stormMotionKt: 0, stormMotionTowardDeg: null });

    expect(screen.getByText("0 kt")).toBeTruthy();
  });

  // LTNG is a 188-byte constant field at f00, so the hour genuinely does not
  // carry it. "not at the analysis hour" and "no flashes" are different claims.
  it("distinguishes an hour with no lightning field from zero flashes", () => {
    withDiagnostics({ lightning: null });

    expect(screen.getByText("not at the analysis hour")).toBeTruthy();
  });

  it("reports a diagnosed zero as a zero", () => {
    withDiagnostics({ lightning: 0 });

    expect(screen.queryByText("not at the analysis hour")).toBeNull();
  });

  it("reports the echo top, and its absence as absence", () => {
    withDiagnostics({ echoTopFt: null });

    expect(screen.getByText("—")).toBeTruthy();
  });

  // Nothing here filters the map, and the panel has to say so — a cutoff on
  // any of these would need a citation the design does not have.
  it("says these are attributes rather than gates", () => {
    withDiagnostics();

    expect(screen.getByText(/none of it gates the map/)).toBeTruthy();
  });
});
