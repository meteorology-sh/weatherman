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
    expect(screen.getByText("none within 40 km")).toBeTruthy();
  });

  it("reports place, motion, and echo top as numbers", () => {
    const store = createTestStore();
    renderWithStore(<StormHere />, store);
    act(() => {
      store.dispatch(stormsActions.setHere(reading));
    });
    expect(screen.getByText("outside rain")).toBeTruthy();
    expect(screen.getByText("0.6 km")).toBeTruthy();
    expect(screen.getByText("4.2 km")).toBeTruthy();
    expect(screen.getByText("NE 28 km/h")).toBeTruthy();
    expect(screen.getByText("14,000 ft above freezing")).toBeTruthy();
    expect(screen.getByText(/-14 °C · -2 °C/)).toBeTruthy();
  });

  it("names the upwind flank", () => {
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
    expect(screen.getByText("upwind flank")).toBeTruthy();
  });

  it("names the heaviest rain when the click is on the dot", () => {
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
    expect(screen.getByText("heaviest rain")).toBeTruthy();
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
