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
  // the 3 km grid does not have.
  it("reports the cell it read, and when each source saw it", () => {
    withPoint();

    expect(
      screen.getByText(/32.05, -101.42 · the 3 km cell containing your click/)
    ).toBeTruthy();
    expect(
      screen.getByText(/Model 18:00Z, satellite 18:01Z, radar 18:00Z/)
    ).toBeTruthy();
  });

  /**
   * The observed cross-check. It is the one measured statement about phase on
   * this panel, and the thing it must never do is read as a sixth test.
   */
  describe("what the satellite measured at the cloud top", () => {
    it("says the top is the water seeding works on", () => {
      withPoint({ topPhase: "supercooled" });

      expect(
        screen.getByText(/The top of this cloud is supercooled liquid/)
      ).toBeTruthy();
    });

    it("says the top has frozen, and that the band below is unchecked", () => {
      withPoint({ topPhase: "ice" });

      expect(
        screen.getByText(/The top of this cloud has already frozen/)
      ).toBeTruthy();
    });

    it("says the top is freezing over as it is watched", () => {
      withPoint({ topPhase: "mixed" });

      expect(screen.getByText(/part liquid and part ice/)).toBeTruthy();
    });

    // A frozen top is evidence, not a verdict. If this ever starts reading as a
    // rejection the panel is claiming something the satellite cannot see.
    it("leaves the cell a candidate when the observed top has frozen", () => {
      withPoint({ topPhase: "ice" });

      expect(screen.getByText("SEEDING OPPORTUNITY")).toBeTruthy();
      expect(
        screen.getByText(/Everything a seeding pass needs is over this point/)
      ).toBeTruthy();
    });

    // The limit travels with the reading rather than living on the About page,
    // because it is what stops "already frozen" being read as "do not fly".
    it("says the reading is the top deck only", () => {
      withPoint({ topPhase: "ice" });

      expect(
        screen.getByText(
          /Under layered cloud this describes whatever is on top/
        )
      ).toBeTruthy();
    });

    // Silence would read as agreement.
    it("says so when no phase scan was available", () => {
      withPoint({ topPhase: null, phaseTime: null });

      expect(
        screen.getByText(/No phase scan was available for this hour/)
      ).toBeTruthy();
    });

    it("names the phase scan's own time, not the cloud-top scan's", () => {
      withPoint({ phaseTime: "2025-05-15T18:06:17.900Z" });

      expect(
        screen.getByText(/satellite 18:01Z, radar 18:00Z, phase 18:06Z/)
      ).toBeTruthy();
    });
  });
});
