// Testing
import { act } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";

// Components
import { Environment } from "@/app/components/candidate/Environment";
import { heightAtC } from "@/lib/format";

// Types
import type { CandidatePoint, Diagnostics, Sounding } from "@/lib/types";

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
  run: "2026-08-12T04:00:00.000Z",
  hour: 0,
  validTime: "2026-08-12T04:00:00.000Z",
  lat: 39.8,
  lon: -98.54,
  surfaceFt: 1830,
  cclFt: null,
  freezingFt: 16433,
  bandBaseFt: 18685,
  bandTopFt: 22066,
  baseC: 34.9,
  topC: -18.1,
  levels: [
    { mb: 550, tempC: -1.32, heightFt: 16966 },
    { mb: 400, tempC: -20, heightFt: 23500 },
  ],
  diagnostics: deep,
};

const withColumn = (cclFt: number | null = 6400) => {
  const store = createTestStore();
  const { container } = renderWithStore(<Environment />, store);
  act(() => {
    store.dispatch(soundingActions.setData(sounding));
    store.dispatch(
      seedabilityActions.setHere({ cclFt } as unknown as CandidatePoint)
    );
  });
  return { store, container };
};

describe("heightAtC", () => {
  it("finds the −15 °C height between two levels", () => {
    expect(
      heightAtC(
        [
          { mb: 500, tempC: -10, heightFt: 18000 },
          { mb: 400, tempC: -20, heightFt: 24000 },
        ],
        -15
      )
    ).toBe(21000);
  });
});

describe("Environment", () => {
  it("renders nothing before the profile arrives", () => {
    const { container } = renderWithStore(<Environment />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the profile is being read", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<Environment />, store);
    act(() => {
      store.dispatch(soundingActions.setLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("reads the levels, then condensation, then instability, in MSL", () => {
    const { container } = withColumn();
    const minus15 = heightAtC(sounding.levels, -15)!.toLocaleString("en-US");

    expect(container.textContent).toContain(
      "Environment" +
        "Ground Elevation1,830 ft MSL" +
        "Freezing Level16,433 ft MSL" +
        `−15 °C Level${minus15} ft MSL` +
        "Seeding Band (−5 to −12 °C)18,685–22,066 ft MSL" +
        "LCL4,200 ft MSL" +
        "CCL6,400 ft MSL" +
        "Mixed-Layer CAPE2,339 J/kg" +
        "Surface-Based CAPE2,499 J/kg" +
        "Mixed-Layer CIN45 J/kg"
    );
  });

  it("dashes the CCL where the column never saturates", () => {
    const { container } = withColumn(null);

    expect(container.textContent).toContain("CCL—");
  });

  // Warm-cloud depth is the salt flare's test, printed with the verdict.
  it("does not repeat warm-cloud depth", () => {
    const { container } = withColumn();

    expect(container.textContent).not.toContain("Warm-Cloud Depth");
  });
});
