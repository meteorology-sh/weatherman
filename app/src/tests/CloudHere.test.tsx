// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";

// Components
import { CloudHere } from "@/app/components/candidate/CloudHere";

// Types
import type { CandidatePoint } from "@/lib/types";

/** A candidate cell over west Texas, from the live route. */
const point: CandidatePoint = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  lat: 32.05,
  lon: -101.42,
  verdict: "candidate",
  slwGM2: 140,
  cloudBaseFt: 5800,
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

  it("reports what each source measured over the cell", () => {
    withPoint();

    expect(screen.getByText("140 g/m²")).toBeTruthy();
    expect(screen.getByText("5,800 ft MSL")).toBeTruthy();
    expect(screen.getByText("-14 °C")).toBeTruthy();
  });

  it("says plainly that the cell passed every test", () => {
    withPoint();

    expect(
      screen.getByText(/Everything a seeding pass needs is over this point/)
    ).toBeTruthy();
  });

  // A cell fails more than one test as often as not, and the join charges it to
  // the first. Naming a different one would send an operator after the wrong
  // fix — and the reason has to be a sentence, not a field name.
  it("names the test that ruled the cell out", () => {
    withPoint({ verdict: "raining" });

    expect(screen.getByText(/already watching this cell rain/)).toBeTruthy();
    expect(screen.getByText("RULED OUT")).toBeTruthy();
  });

  it("says there is nothing to seed rather than nothing at all", () => {
    withPoint({ verdict: "noLiquid", slwGM2: 0 });

    expect(screen.getByText(/nothing to seed/)).toBeTruthy();
  });

  it("reports the model's silence as no cloud, not as zero feet", () => {
    withPoint({ verdict: "noCloudBase", cloudBaseFt: null });

    expect(screen.getByText("no cloud modelled here")).toBeTruthy();
  });

  it("reports the satellite's silence as no cloud seen", () => {
    withPoint({ verdict: "noCloudSeen", cloudTopC: null });

    expect(screen.getByText("no cloud seen here")).toBeTruthy();
  });

  // The two ways a cell has no reflectivity mean opposite things: a radar
  // watching clear air, and no radar looking at all. This readout is where that
  // distinction is made, so it must not collapse to one phrase.
  it("separates a quiet radar from no radar over the cell", () => {
    withPoint({ dbz: null, radarCovered: true });
    expect(screen.getByText("no echo")).toBeTruthy();

    withPoint({ dbz: null, radarCovered: false });
    expect(screen.getByText("no radar over this cell")).toBeTruthy();
  });

  it("says when the radar is watching the cell precipitate", () => {
    withPoint({ verdict: "raining", dbz: 41 });

    expect(screen.getByText(/41 dBZ — precipitating/)).toBeTruthy();
  });

  // The cell, not the click: reporting the click back would imply a precision
  // the 12 km grid does not have.
  it("reports the cell it read, and when each source saw it", () => {
    withPoint();

    expect(
      screen.getByText(/32.05, -101.42 · the 12 km cell containing your click/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Model 18:00Z, satellite 18:01Z, radar 18:00Z/)
    ).toBeTruthy();
  });
});
