// Testing
import { render, screen } from "@testing-library/react";

// Components
import { PhaseCheck } from "@/app/components/panel/PhaseCheck";

// Types
import type { CandidateStats, PhaseCheck as PhaseCheckT } from "@/lib/types";

const phase = (over: Partial<PhaseCheckT> = {}): PhaseCheckT => ({
  sceneTime: "2025-05-15T18:01:17.900Z",
  confirmedKm2: 31680,
  glaciatedKm2: 15840,
  unresolvedKm2: 5040,
  missedKm2: 0,
  ...over,
});

/** A rainy-season hour with candidate ground on it. */
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
  blindKm2: 2880,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17100,
  ceilingFt: 18000,
  reachablePct: 72.9,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
  phase: phase(),
  ...over,
});

describe("PhaseCheck", () => {
  // 31,680 of 52,560 km². Two areas would leave the operator to work that out
  // between sorties, which is the whole complaint this readout answers.
  it("does the division rather than printing two areas", () => {
    render(<PhaseCheck stats={stats()} />);

    expect(screen.getByText(/60% of that candidate ground/)).toBeTruthy();
  });

  it("still gives the areas the share is drawn from", () => {
    const { container } = render(<PhaseCheck stats={stats()} />);

    expect(container.textContent).toContain("31,680 km²");
    expect(container.textContent).toContain("15,840 km²");
  });

  it("reports ground it could not classify only when there is some", () => {
    const some = render(<PhaseCheck stats={stats()} />);
    expect(some.container.textContent).toContain("could not classify");

    const none = render(
      <PhaseCheck stats={stats({ phase: phase({ unresolvedKm2: 0 }) })} />
    );
    expect(none.container.textContent).not.toContain("could not classify");
  });

  // The step a reader cannot take for themselves, and the one that decides
  // whether they fly: a frozen top reads as bad news until someone says why it
  // usually is not.
  it("says a frozen top is not a reason to stay away", () => {
    render(<PhaseCheck stats={stats()} />);

    expect(
      screen.getByText(/A frozen top is not a reason to stay away/)
    ).toBeTruthy();
    expect(
      screen.getByText(/an anvil spreading downwind\s+reads as ice/)
    ).toBeTruthy();
  });

  // The direction no amount of reading the map finds: this cloud never reached
  // the map to be rejected.
  it("reports supercooled tops the layer drew nothing over", () => {
    render(<PhaseCheck stats={stats({ phase: phase({ missedKm2: 8640 }) })} />);

    expect(
      screen.getByText(
        /supercooled top over 8,640 km² carrying less modelled liquid/
      )
    ).toBeTruthy();
  });

  // It is routinely larger than the candidate field, so a reader who takes it
  // for a count of model errors reads the panel as saying the model is broken.
  it("says that count is ground to look at rather than mistakes", () => {
    render(<PhaseCheck stats={stats({ phase: phase({ missedKm2: 8640 }) })} />);

    expect(screen.getByText(/rather than a count of\s+mistakes/)).toBeTruthy();
  });

  // A blank hour is exactly when a miss matters, so the reading survives one.
  it("still reports misses when nothing passed every test", () => {
    render(
      <PhaseCheck
        stats={stats({
          candidateKm2: 0,
          phase: phase({
            confirmedKm2: 0,
            glaciatedKm2: 0,
            unresolvedKm2: 0,
            missedKm2: 8640,
          }),
        })}
      />
    );

    expect(
      screen.getByText(/The satellite sees a supercooled top/)
    ).toBeTruthy();
    expect(screen.queryByText(/of candidate ground/)).toBe(null);
  });

  // Zeroes with a scan time on them would say the satellite looked and
  // confirmed nothing, which is a different claim from not having looked.
  it("says when no phase scan was read at all", () => {
    render(<PhaseCheck stats={stats({ phase: phase({ sceneTime: null }) })} />);

    expect(
      screen.getByText(/No cloud-top phase scan was available at this hour/)
    ).toBeTruthy();
    expect(screen.queryByText("31,680 km²")).toBe(null);
  });

  // The whole reason this is a readout and not a sixth test.
  it("frames the share as where evidence is strongest, not as a filter", () => {
    render(<PhaseCheck stats={stats()} />);

    expect(
      screen.getByText(/not as the only\s+ground worth flying/)
    ).toBeTruthy();
  });
});
