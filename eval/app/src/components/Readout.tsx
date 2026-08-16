// Types
import type { Day, Observation, Release } from "~/lib/types";

/**
 * The crew's nearest word to a flare.
 *
 * Radio calls are not on the same clock as releases, so "what were they seeing
 * when this went out" is the nearest call either side rather than one at the
 * same minute. Anything more than half an hour away is a different part of the
 * flight and is not offered as context.
 */
const NEAR_MS = 30 * 60_000;

function nearestSaid(day: Day, at: string): Observation | null {
  const t = new Date(at).getTime();
  let best: Observation | null = null;
  let bestGap = Infinity;

  for (const observation of day.observations) {
    const gap = Math.abs(new Date(observation.at).getTime() - t);
    if (gap < bestGap) {
      bestGap = gap;
      best = observation;
    }
  }
  return bestGap <= NEAR_MS ? best : null;
}

const Row = ({
  label,
  ours,
  theirs,
}: {
  label: string;
  ours: string;
  theirs?: string | null;
}) => (
  <tr>
    <td className="text-xs whitespace-nowrap">{label}</td>
    <td className="text-xs font-mono">{ours}</td>
    <td className="text-xs font-mono">{theirs ?? "—"}</td>
  </tr>
);

type PropsT = { day: Day; release: Release | null };

/**
 * What we said about the cell a flare went into, beside what the crew said
 * about the same cloud.
 *
 * The two columns are the whole point. Where a number exists on both sides it
 * is put on one row; where only one side has it the other stays blank rather
 * than being filled with something derived, because a derived value would read
 * as corroboration.
 */
export const Readout = ({ day, release }: PropsT) => {
  if (!release) {
    return (
      <div className="p-4 text-sm">
        Pick a flare on the map or in the timeline to compare it against the
        crew&rsquo;s account.
      </div>
    );
  }

  const answer = release.answer;
  const said = nearestSaid(day, release.at);
  const gaps = release.gaps;

  return (
    <div className="p-3 space-y-3">
      <div>
        <div className="font-mono text-sm">
          {release.timeZ}Z · {release.plane} · {release.county}
        </div>
        <div className="text-xs">
          {release.glaciogenic} glaciogenic
          {release.hygroscopic
            ? `, ${release.hygroscopic} hygroscopic`
            : ""} · {release.lat.toFixed(3)}, {release.lon.toFixed(3)}
        </div>
      </div>

      {!answer && (
        <div className="text-warning text-xs">
          Not scored — this day has no sweep behind it yet.
        </div>
      )}

      {answer?.error && (
        <div className="text-error text-xs">Scoring failed: {answer.error}</div>
      )}

      {answer && !answer.error && (
        <>
          <div className="badge badge-outline">{answer.verdict}</div>

          <table className="table table-xs">
            <thead>
              <tr>
                <th className="text-xs">reading</th>
                <th className="text-xs">we drew</th>
                <th className="text-xs">they reported</th>
              </tr>
            </thead>
            <tbody>
              <Row
                label="cloud base"
                ours={
                  answer.cloudBaseFt === null
                    ? "no cloud modelled"
                    : `${answer.cloudBaseFt.toLocaleString("en-US")} ft`
                }
                theirs={
                  said?.pilotCloudBaseFt
                    ? `${said.pilotCloudBaseFt.toLocaleString("en-US")} ft`
                    : null
                }
              />
              <Row
                label="reflectivity"
                ours={
                  answer.dbz === null
                    ? answer.radarCovered
                      ? "no echo"
                      : "no radar"
                    : `${answer.dbz} dBZ`
                }
                theirs={said?.dbz ? `${said.dbz[0]}–${said.dbz[1]} dBZ` : null}
              />
              <Row
                label="cloud top"
                ours={
                  answer.cloudTopC === null
                    ? "no cloud seen"
                    : `${answer.cloudTopC} °C${answer.topPhase ? `, ${answer.topPhase}` : ""}`
                }
                theirs={
                  said?.echoTop
                    ? `${said.echoTop.range[0]}–${said.echoTop.range[1]} ${said.echoTop.unit} top`
                    : null
                }
              />
              <Row
                label="liquid in band"
                ours={`${answer.slwGM2} g/m²`}
                theirs={
                  said?.vilKgM2
                    ? `${said.vilKgM2[0]}–${said.vilKgM2[1]} kg/m² VIL`
                    : null
                }
              />
            </tbody>
          </table>

          {gaps && (
            <div className="text-xs">
              <span className="font-semibold">How far off the moment:</span>{" "}
              model {gaps.model! >= 0 ? "+" : ""}
              {gaps.model} min, satellite {gaps.satellite! >= 0 ? "+" : ""}
              {gaps.satellite} min, radar {gaps.radar! >= 0 ? "+" : ""}
              {gaps.radar} min. The model analyses hourly and cannot be closer;
              the satellite and radar can.
            </div>
          )}
        </>
      )}

      {said && (
        <div className="border-l-2 border-base-content/40 pl-2">
          <div className="font-mono text-xs">{said.timeZ}Z</div>
          <div className="text-xs italic">{said.said}</div>
        </div>
      )}
    </div>
  );
};
