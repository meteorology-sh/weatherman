// Testing
import { act, screen } from "@testing-library/react";
import { createTestStore, renderWithStore } from "./utils";

// Store
import { seedabilityActions } from "@/lib/store/features/seedability";

// Components
import { Field } from "@/app/components/candidate/Field";

// Types
import type { CandidateStats } from "@/lib/types";

/** The hour in the reference screenshot: a mature system over the Midwest. */
const stats: CandidateStats = {
  run: "2026-08-14T18:00:00.000Z",
  validTime: "2026-08-14T18:00:00.000Z",
  sceneTime: "2026-08-14T18:01:17.900Z",
  radarTime: "2026-08-14T18:00:39.000Z",
  coveragePct: 1.27,
  candidateKm2: 232128,
  peak: 1260,
  liquidKm2: 377856,
  rejected: {
    noCloudBase: 0,
    baseAboveBand: 0,
    noCloudSeen: 27216,
    topTooWarm: 11376,
    raining: 107136,
  },
  blindKm2: 2880,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17891,
  ceilingFt: 18000,
  reachablePct: 52.42,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
  phase: {
    sceneTime: "2026-08-14T18:06:17.900Z",
    confirmedKm2: 63792,
    glaciatedKm2: 168336,
    unresolvedKm2: 0,
    missedKm2: 442080,
  },
};

const withStats = (over: Partial<CandidateStats> = {}) => {
  const store = createTestStore();
  const rendered = renderWithStore(<Field />, store);
  act(() => {
    store.dispatch(seedabilityActions.setStats({ ...stats, ...over }));
  });
  return rendered;
};

describe("Field", () => {
  it("renders nothing before the summary has loaded", () => {
    const { container } = renderWithStore(<Field />, createTestStore());

    expect(container.innerHTML).toBe("");
  });

  it("shows a spinner while the join is building", () => {
    const store = createTestStore();
    const { container } = renderWithStore(<Field />, store);
    act(() => {
      store.dispatch(seedabilityActions.setStatsLoading(true));
    });

    expect(container.querySelector(".loading")).toBeTruthy();
  });

  it("shows the error when a source is down", () => {
    const store = createTestStore();
    renderWithStore(<Field />, store);
    act(() => {
      store.dispatch(seedabilityActions.setStatsError("GOES listing failed"));
    });

    expect(screen.getByText("GOES listing failed")).toBeTruthy();
  });

  it("reports the ground that passed and the richest cell", () => {
    withStats();

    expect(screen.getByText("232,128 km²")).toBeTruthy();
    expect(screen.getByText(/richest cell 1,260 g\/m²/)).toBeTruthy();
  });

  it("reports reachability against the ceiling", () => {
    withStats();

    expect(
      screen.getByText(/Band base 17,891 ft MSL · 52.42% below an 18,000 ft/)
    ).toBeTruthy();
  });

  // The accounting that makes an empty map explainable, and the observed
  // cross-check on what survived. Both were reachable only through the replay
  // page until this panel carried them.
  it("carries the rejection accounting on the live map", () => {
    withStats();

    expect(screen.getByText(/already raining/)).toBeTruthy();
    expect(screen.getByText("107,136 km²")).toBeTruthy();
  });

  it("carries the observed phase check on the live map", () => {
    withStats();

    expect(screen.getByText(/27% of that candidate ground/)).toBeTruthy();
  });

  it("says plainly when nothing passed", () => {
    withStats({ coveragePct: 0, candidateKm2: 0 });

    expect(
      screen.getByText(/No ground in the domain passed every test/)
    ).toBeTruthy();
  });
});
