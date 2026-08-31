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
  inside: false,
  coreKm: 4.2,
  edgeKm: 0.6,
  upwindEdgeKm: 0.8,
  inWorking: false,
  slwGM2: 22,
  goesTopC: -14,
  goesTopDeltaC: -2,
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
    expect(
      screen.getByText(/No rain at 20 dBZ within about 40 km/)
    ).toBeTruthy();
  });

  it("says how far the click is from the heaviest rain and from the edge", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere(reading));
    });
    expect(screen.getByText("48 dBZ")).toBeTruthy();
    expect(screen.getByText(/0.6 km from the edge/)).toBeTruthy();
    expect(screen.getByText(/outside the rain/)).toBeTruthy();
    expect(screen.getByText(/Moving toward NE at 28 km\/h/)).toBeTruthy();
    expect(screen.getByText(/4.2 km² more than the previous scan/)).toBeTruthy();
    expect(screen.getByText(/2 °C colder than five minutes ago/)).toBeTruthy();
    expect(screen.getByText(/22 g\/m² of supercooled liquid/)).toBeTruthy();
  });

  it("names the working area when the click is in quiet upwind air", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({
          ...reading,
          inWorking: true,
        })
      );
    });
    expect(screen.getByText(/working area/)).toBeTruthy();
    expect(screen.getByText(/not rain/)).toBeTruthy();
  });

  it("says you clicked the heaviest rain when the click is on the dot", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({
          ...reading,
          inside: true,
          coreKm: 0.1,
          edgeKm: 0.6,
        })
      );
    });
    expect(
      screen.getByText(/You clicked the heaviest rain in this storm/)
    ).toBeTruthy();
  });
});
