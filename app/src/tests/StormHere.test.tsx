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
    expect(screen.getByText(/been on the mosaic for 12 minutes/)).toBeTruthy();
    expect(screen.getByText(/3 lightning flashes/)).toBeTruthy();
    expect(screen.getByText(/2 °C colder than five minutes ago/)).toBeTruthy();
    expect(screen.getByText(/22 g\/m² of supercooled liquid/)).toBeTruthy();
    expect(
      screen.getByText(/18 dBZ echo top is 14,000 ft above the freezing level/)
    ).toBeTruthy();
  });

  it("falls back to modelled echo top when the measurement is missing", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({
          ...reading,
          echoTopFt: null,
          modelEchoTopFt: 22000,
          freezingFt: 14000,
        })
      );
    });
    expect(screen.getByText(/No measured 18 dBZ echo top/)).toBeTruthy();
    expect(
      screen.getByText(/Modelled echo top is 8,000 ft above the freezing level/)
    ).toBeTruthy();
  });

  it("names the upwind flank when the click is inside the rain on that side", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({
          ...reading,
          inside: true,
          inWorking: true,
          coreKm: 4.2,
          edgeKm: 0.6,
        })
      );
    });
    expect(screen.getByText(/on the upwind side/)).toBeTruthy();
    expect(screen.getByText(/flank crews fly/)).toBeTruthy();
  });

  it("says age is a lower bound when the oldest scan still matched", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(
        stormsActions.setHere({
          ...reading,
          object: { ...reading.object, ageMin: 18, ageFloor: true },
        })
      );
    });
    expect(
      screen.getByText(/been on the mosaic for at least 18 minutes/)
    ).toBeTruthy();
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
