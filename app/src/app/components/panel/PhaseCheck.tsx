// Types
import type { CandidateStats } from "@/lib/types";

const km2 = new Intl.NumberFormat("en-US");

type PropsT = { stats: CandidateStats };

/**
 * What the satellite's observed cloud-top phase says about the hour's answer.
 *
 * Every figure above this one comes from a model. This is the only observed
 * statement about phase available nationally, and it is here to be disagreed
 * with.
 *
 * **It says the share, and it says what to make of it.** Two areas in km² leave
 * the reader to divide one by the other and then to know that a frozen top over
 * deep cloud is ordinary rather than disqualifying. That is three steps of
 * meteorology before the number means anything, and an operator reading this
 * panel between sorties should not have to take them.
 *
 * **Nothing here changed the map.** The satellite sees the top of the cloud and
 * the seeding band is inside it, so this cannot check the claim the candidate
 * field actually makes. It is reported beside that claim, never folded into it.
 */
export const PhaseCheck = ({ stats }: PropsT) => {
  const { phase } = stats;

  // A missing scan and a scan that confirmed nothing are different, and a
  // column of zeroes would read as the second.
  if (phase.sceneTime === null) {
    return (
      <div className="text-xs">
        No cloud-top phase scan was available at this hour, so nothing observed
        checks the model.
      </div>
    );
  }

  const confirmedPct = stats.candidateKm2
    ? Math.round((100 * phase.confirmedKm2) / stats.candidateKm2)
    : 0;

  return (
    <div className="flex flex-col gap-2">
      {/* Nothing passed, so there is no candidate ground to describe — but the
          satellite was still looking, and what it saw over the ground the model
          emptied is the reading that matters most on a blank hour. */}
      {stats.candidateKm2 > 0 && (
        <>
          <div className="text-xs">
            The satellite still sees liquid at the top of{" "}
            <strong>
              {confirmedPct}% of that candidate ground —{" "}
              {km2.format(phase.confirmedKm2)} km²
            </strong>
            . The other {km2.format(phase.glaciatedKm2)} km² has already frozen
            over
            {phase.unresolvedKm2 > 0 && (
              <>
                , and it could not classify {km2.format(phase.unresolvedKm2)}{" "}
                km²
              </>
            )}
            .
          </div>
          {/* The part a reader cannot supply for themselves, and the part that
              decides whether they fly. A frozen top reads as bad news until
              someone says why it usually is not. */}
          <div className="text-xs">
            A frozen top is not a reason to stay away. The seeding band sits
            well below the top of the cloud, and an anvil spreading downwind
            reads as ice over whatever is still growing underneath it. Treat the{" "}
            {confirmedPct}% as where the evidence is strongest, not as the only
            ground worth flying.
          </div>
        </>
      )}
      {phase.missedKm2 > 0 && (
        <div className="text-xs">
          {stats.candidateKm2 > 0 ? "It also sees" : "The satellite sees"} a
          supercooled top over {km2.format(phase.missedKm2)} km² carrying less
          modeled liquid than the lowest band draws — cloud that never reached
          this map to be ruled out. A thin supercooled deck can sit under that
          band honestly, so this is ground worth a look rather than a count of
          mistakes.
        </div>
      )}
    </div>
  );
};
