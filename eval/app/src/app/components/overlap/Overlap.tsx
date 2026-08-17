// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

// Components
import { Status } from "../Status";
import { DayPicker } from "./DayPicker";
import { PaintedMap } from "./PaintedMap";

const hhmm = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;

/**
 * Finding 2 — whether a flare was released inside what we had painted.
 *
 * The model publishes once an hour and the aircraft do not wait for it, so the
 * page paints both analyses a flare sits between. Where the two overlap, the
 * liquid was there across the whole gap and which hour you pick stops mattering.
 */
export const Overlap = () => {
  const overlap = useAppSelector((state) => state.findings.overlap);
  const { date, day, painted, interval, loading, missing, error } =
    useAppSelector((state) => state.day);
  const dispatch = useAppDispatch();

  return (
    <div className="h-full grid grid-cols-4">
      <aside className="col-span-1 border-r border-base-300 overflow-y-auto">
        {overlap && (
          <div className="p-4 border-b border-base-300">
            <div className="text-xs tracking-widest opacity-90 pb-2">
              THE WHOLE SEASON
            </div>
            <table className="table table-xs">
              <tbody>
                {overlap.tests.map((test) => (
                  <tr key={test.key}>
                    <td className="pl-0">{test.label}</td>
                    <td className="text-right font-mono font-semibold">
                      {overlap.tallies[test.key]?.held ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="text-xs pt-2 opacity-90">
              of {overlap.usable} flares, held at both hours
            </div>
          </div>
        )}
        <DayPicker />
      </aside>

      <main className="col-span-3 overflow-y-auto">
        {!date ? (
          <div className="p-8 prose max-w-none">
            <h1 className="mb-1">Do the flares fall inside what we paint?</h1>
            <p>
              Pick a day. The map paints the supercooled liquid we modelled at
              both analysis hours a flare sits between, and drops the release
              points on top.
            </p>
            <p className="text-sm">
              Where the two washes overlap, the liquid was there across the
              whole gap — so the answer does not depend on which hour the
              release is charged to. A day marked <em>not painted</em> needs{" "}
              <code>node eval/held.mjs &lt;date&gt;</code> first.
            </p>
          </div>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            <div className="flex items-baseline justify-between flex-wrap gap-2">
              <h1 className="text-2xl font-semibold">{date}</h1>
              {day && (
                <span className="text-sm font-mono opacity-90">
                  {day.releases.length} flares
                  {day.unlocated.length > 0 &&
                    ` · ${day.unlocated.length} without a position`}
                </span>
              )}
            </div>

            <Status
              loading={loading}
              missing={missing}
              error={error}
              what="Reading the day"
            />

            {painted && painted.intervals.length > 0 && (
              <>
                <div className="flex flex-wrap gap-2">
                  {painted.intervals.map((entry, index) => {
                    const held = entry.flares.filter(
                      (f) => f.held?.liquid === "held"
                    ).length;
                    return (
                      <button
                        key={entry.from}
                        type="button"
                        className={`btn btn-sm ${
                          index === interval ? "btn-active" : "btn-outline"
                        }`}
                        onClick={() => dispatch(dayActions.setInterval(index))}
                      >
                        {hhmm(entry.from)} → {hhmm(entry.to)}
                        <span className="badge badge-sm">
                          {held}/{entry.flares.length}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="flex flex-wrap gap-4 text-xs items-center">
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-5 h-3 bg-info/25 border border-info/40" />
                    Earlier hour
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-5 h-3 bg-info/45 border border-info" />
                    Later hour
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-success" />
                    Flare in liquid that held
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-warning" />
                    One hour only
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-3 h-3 rounded-full bg-error" />
                    Neither hour
                  </span>
                </div>

                <PaintedMap painted={painted} interval={interval} />

                <div className="text-xs opacity-90">
                  Painting {painted.label}, outermost contour. Flare
                  classifications come from the same run the season table does.
                </div>
              </>
            )}

            {day && (
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>County</th>
                      <th>Payload</th>
                      <th>Liquid</th>
                      <th>Before rain</th>
                      <th>Full join</th>
                      <th className="text-right">dBZ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {day.releases.map((release) => (
                      <tr key={release.at}>
                        <td className="font-mono">{release.timeZ}Z</td>
                        <td>{release.county}</td>
                        <td>{release.payload}</td>
                        <td>{release.held?.liquid ?? "—"}</td>
                        <td>{release.held?.cloudReady ?? "—"}</td>
                        <td>{release.held?.candidate ?? "—"}</td>
                        <td className="text-right font-mono">
                          {release.hi?.dbz?.toFixed(0) ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};
