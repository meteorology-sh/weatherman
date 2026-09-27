// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { stormsActions } from "@/lib/store/features/storms";

// Components
import { StormHere } from "@/app/components/candidate/StormHere";

// Types
import type { StormNear } from "@/lib/types";

const reading: StormNear = {
  validTime: "2025-08-11T18:02:00.000Z",
  inside: true,
  edgeKm: 4.2,
  slwGM2: 22,
  goesTopC: -14,
  goesTopDeltaC: -2,
  echoTopFt: 28000,
  modelEchoTopFt: 26000,
  freezingFt: 14000,
  glmFlashes: 3,
  object: {
    id: 7,
    firstSeen: "2025-08-11T17:50:00.000Z",
    nCells: 40,
    areaKm2: 36,
    maxDbz: 48,
    coreLon: -101.4,
    coreLat: 32.1,
    centroidLon: -101.42,
    centroidLat: 32.08,
    ageMin: 12,
    ageFloor: false,
    motionTowardDeg: 40,
    motionKmh: 28,
    areaDeltaKm2: 4.2,
  },
};

describe("StormHere", () => {
  it("renders nothing before a storm has been read", () => {
    const { container } = renderWithStore(<StormHere />, createTestStore());
    expect(container.innerHTML).toBe("");
  });

  it("says so when there is no storm near the click", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere(null));
    });
    expect(screen.getByText("Radar")).toBeTruthy();
    expect(screen.getByText("None Within 40 km")).toBeTruthy();
  });

  // The one thing said about where on the storm the click landed: how far it
  // is from the drawn edge, and which side of that edge it is on.
  it("reports the distance to the edge, motion, and echo top as numbers", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere(reading));
    });
    expect(container.textContent).toContain(
      "Radar" +
        "Distance to Storm Edge4.2 km inside" +
        "Storm MotionNE 28 km/h" +
        "Tallest 18 dBZ Echo Top14,000 ft above freezing" +
        "Coldest Cloud Top-14 °C · -2 °C" +
        "Lightning Flashes3"
    );
  });

  it("names the model when no 18 dBZ top was measured", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere({ ...reading, echoTopFt: null }));
    });
    expect(screen.getByText("12,000 ft above freezing (model)")).toBeTruthy();
  });

  // The edge is the only place named. A flank, a core, or an inflow notch
  // needs geometry the reading does not carry.
  it("names no place on the storm beyond the side of the edge", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere(reading));
    });

    for (const place of ["upwind flank", "near core", "heaviest rain"]) {
      expect(screen.queryByText(place)).toBeNull();
    }
  });

  it("says which side of the edge a click outside the rain is on", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({ ...reading, inside: false, edgeKm: 6.1 })
      );
    });
    expect(screen.getByText("6.1 km outside")).toBeTruthy();
  });

  it("has no distance when the storm has no drawn ring", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere({ ...reading, edgeKm: null }));
    });
    expect(screen.getByText("Distance to Storm Edge")).toBeTruthy();
    expect(screen.getByText("—")).toBeTruthy();
  });

  it("flags a cloud top that warmed", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({
          ...reading,
          goesTopC: -12,
          goesTopDeltaC: 1.5,
        })
      );
    });
    expect(screen.getByText(/-12 °C · \+1.5 °C/)).toBeTruthy();
  });
});
