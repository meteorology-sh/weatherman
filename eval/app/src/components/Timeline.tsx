// Types
import type { Day, Observation, Release } from "~/lib/types";

type Event =
  | { kind: "release"; at: string; timeZ: string; release: Release }
  | { kind: "said"; at: string; timeZ: string; observation: Observation };

/**
 * Everything that happened that day, in order.
 *
 * Releases and radio calls on one rail, because the comparison is between them:
 * a crew reporting bases at 1838Z and dropping two flares at 1843Z is one
 * event, and splitting them into two lists makes the reader hold the clock in
 * their head.
 */
export function events(day: Day): Event[] {
  const all: Event[] = [
    ...day.releases.map(
      (release) =>
        ({
          kind: "release",
          at: release.at,
          timeZ: release.timeZ,
          release,
        }) as const
    ),
    ...day.observations.map(
      (observation) =>
        ({
          kind: "said",
          at: observation.at,
          timeZ: observation.timeZ,
          observation,
        }) as const
    ),
  ];
  return all.sort((a, b) => a.at.localeCompare(b.at));
}

type PropsT = {
  day: Day;
  cursor: string | null;
  onCursor: (at: string) => void;
  onPick: (release: Release | null) => void;
};

/**
 * The day as a list of moments to stand at.
 *
 * **It snaps to events rather than sliding.** Every distinct cursor position is
 * a fresh join off the archive — 30 to 60 seconds of byte-range reads — so a
 * continuous scrubber would queue a build per pixel and answer none of them.
 * The moments worth standing at are finite anyway: the flares and the calls.
 */
export const Timeline = ({ day, cursor, onCursor, onPick }: PropsT) => {
  const rail = events(day);
  if (!rail.length)
    return <div className="p-4 text-sm">No flights logged.</div>;

  return (
    <ol className="menu menu-sm w-full gap-0.5 p-2">
      {rail.map((event) => {
        const here = cursor === event.at;
        return (
          <li key={`${event.kind}-${event.at}`}>
            <button
              className={`flex items-start gap-2 text-left ${here ? "menu-active" : ""}`}
              onClick={() => {
                onCursor(event.at);
                onPick(event.kind === "release" ? event.release : null);
              }}
            >
              <span className="font-mono text-xs shrink-0 pt-0.5">
                {event.timeZ}Z
              </span>
              {event.kind === "release" ? (
                <span className="text-xs">
                  <span className="badge badge-xs badge-primary mr-1">
                    {event.release.glaciogenic}G
                    {event.release.hygroscopic
                      ? `+${event.release.hygroscopic}H`
                      : ""}
                  </span>
                  {event.release.county}
                  {event.release.answer && (
                    <span className="opacity-100 ml-1">
                      — {event.release.answer.verdict}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-xs italic">{event.observation.said}</span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
};
