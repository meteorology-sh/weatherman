// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";

// Components
import { CandidateField } from "@/app/components/CandidateField";

// Types
import type { CandidateStats } from "@/lib/types";

const stats = (over: Partial<CandidateStats> = {}): CandidateStats => ({
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  coveragePct: 0.31,
  candidateKm2: 52560,
  peak: 340,
  liquidKm2: 249120,
  rejected: {
    noCloudBase: 41184,
    baseAboveBand: 8496,
    noCloudSeen: 96912,
    topTooWarm: 34848,
    raining: 15120,
  },
  blindKm2: 0,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17100,
  ceilingFt: 18000,
  reachablePct: 72.9,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
  ...over,
});

const show = (over: Partial<CandidateStats> = {}) => {
  const store = createTestStore();
  const rendered = renderWithStore(<CandidateField />, store);
  act(() => {
    store.dispatch(seedabilityActions.setStats(stats(over)));
  });
  return rendered;
};

describe("CandidateField", () => {
  it("reports the ground that passed every test", () => {
    show();

    // Twice on purpose: the stat tile, and again in the accounting underneath
    // where it is the figure the rejections are subtracted down to.
    expect(screen.getAllByText(/52,560 km²/).length).toBeGreaterThan(0);
    expect(screen.getByText(/0\.31% of the domain/)).toBeTruthy();
  });

  it("reports the richest candidate cell", () => {
    show();

    expect(screen.getByText(/340 g\/m²/)).toBeTruthy();
  });

  // Reachability is a reported attribute, never a filter — a band above the
  // ceiling in July is correct output rather than a warning.
  it("reports the band altitude against the configured ceiling", () => {
    show();

    expect(screen.getByText(/17,100 ft/)).toBeTruthy();
    expect(screen.getByText(/72\.9% below an 18,000 ft ceiling/)).toBeTruthy();
  });

  // A blank green layer over an amber one reads as a broken build unless the
  // panel names the test that emptied it.
  describe("when nothing passes", () => {
    const empty = {
      coveragePct: 0,
      candidateKm2: 0,
      peak: 0,
      medianBaseFt: null,
      medianBandBaseFt: null,
    };

    it("says the sky is not offering a target, not that the build failed", () => {
      show(empty);

      expect(screen.getByText(/the sky is not offering a target/)).toBeTruthy();
    });

    it("still accounts for what each test removed", () => {
      show(empty);

      expect(screen.getByText(/no modelled cloud base/)).toBeTruthy();
      expect(screen.getByText(/41,184 km²/)).toBeTruthy();
      expect(screen.getByText(/already raining/)).toBeTruthy();
    });

    it("explains an empty field with no liquid behind it differently", () => {
      show({
        ...empty,
        liquidKm2: 0,
        rejected: {
          noCloudBase: 0,
          baseAboveBand: 0,
          noCloudSeen: 0,
          topTooWarm: 0,
          raining: 0,
        },
      });

      expect(
        screen.getByText(/no supercooled liquid in the band anywhere/)
      ).toBeTruthy();
    });
  });

  // Absence of radar coverage is not absence of rain, and a candidate standing
  // on uncovered ground is unchecked rather than cleared.
  it("says when candidate ground has no radar over it", () => {
    show({ blindKm2: 2880 });

    expect(screen.getByText(/2,880 km².*not checked/s)).toBeTruthy();
  });

  it("says nothing about radar coverage when every cell was checked", () => {
    show({ blindKm2: 0 });

    expect(screen.queryByText(/not checked/)).toBe(null);
  });

  // The join is only as current as its slowest input, so all three times show.
  it("names all three source times", () => {
    show();

    expect(screen.getByText(/HRRR 2025-05-15 18:00Z/)).toBeTruthy();
    expect(screen.getByText(/satellite 2025-05-15 18:01Z/)).toBeTruthy();
    expect(screen.getByText(/radar 2025-05-15 18:00Z/)).toBeTruthy();
  });

  it("renders nothing while the layer is switched off", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<CandidateField />, store);
    act(() => {
      store.dispatch(seedabilityActions.setStats(stats()));
      store.dispatch(seedabilityActions.setVisible(false));
    });

    expect(container.innerHTML).toBe("");
  });

  it("shows the error rather than a stale summary", () => {
    const store = createTestStore();
    renderWithStore(<CandidateField />, store);
    act(() => {
      store.dispatch(seedabilityActions.setError("No archived GOES scene"));
    });

    expect(screen.getByText("No archived GOES scene")).toBeTruthy();
  });
});
