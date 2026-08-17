// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

// Components
import { Status } from "../Status";
import { Section } from "../Section";
import { DayPicker } from "./DayPicker";
import { LayerPanel } from "./LayerPanel";
import { PaintedMap } from "./PaintedMap";

const hhmm = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;

/** What each flare's ring and dot mean, in the words the finding is stated in. */
const KEY = [
  {
    className: "bg-success",
    label: "Liquid at both hours",
    hint: "We painted supercooled liquid here before the release and again after it.",
  },
  {
    className: "bg-warning",
    label: "One hour only",
    hint: "Painted at one analysis and not the other, so the answer depends on which.",
  },
  {
    className: "bg-error",
    label: "Neither hour",
    hint: "We painted no liquid in this cell at either end of the bracket.",
  },
];

/**
 * Finding 2 — whether a flare was released inside what we had painted.
 *
 * The page is a map and its controls, and deliberately not a table. A table of
 * verdicts answers "how many" when the question on this page is "where", and the
 * two readings a release sits between are a shape moving across the ground
 * rather than a pair of rows.
 */
export const Overlap = () => {
  const { date, day, painted, interval, loading, missing, error } =
    useAppSelector((state) => state.day);
  const dispatch = useAppDispatch();

  return (
    <div className="h-full flex">
      <aside className="w-80 shrink-0 border-r border-base-300 overflow-y-auto">
        <LayerPanel />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-5xl">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">
              Do the flares fall inside what we paint?
            </h1>
            <p className="text-sm max-w-2xl">
              Every layer below is the one Weatherman itself draws, fetched from
              the product's own server at the hours around each release. The
              flares are the operator's logged coordinates. If the two agree,
              the dots land in the paint.
            </p>
          </div>

          <Section
            heading="The day"
            subtitle="Painting a day means building every layer at every analysis its flares sit between, so only days that have been built can be opened."
          >
            <DayPicker />
          </Section>

          {date && (
            <>
              <Status
                loading={loading}
                missing={missing}
                error={error}
                what="Reading the day"
              />

              {painted && painted.intervals.length > 0 && (
                <>
                  <Section
                    heading="The bracket"
                    subtitle="The model publishes once an hour and the aircraft do not wait for it. Each button is one gap between analyses, and the count is how many of its flares had liquid painted at both ends."
                  >
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
                            onClick={() =>
                              dispatch(dayActions.setInterval(index))
                            }
                          >
                            {hhmm(entry.from)} → {hhmm(entry.to)}
                            <span className="badge badge-sm">
                              {held}/{entry.flares.length}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </Section>

                  <Section
                    heading="The map"
                    subtitle="The earlier analysis is dashed, the later one solid, and where they overlap the fills double. The black arrow runs from each release point along the storm motion, so it points at where that air had gone by the later hour."
                  >
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs items-center pb-2">
                      {KEY.map((entry) => (
                        <span
                          key={entry.label}
                          className="flex items-center gap-2"
                          title={entry.hint}
                        >
                          <span
                            className={`inline-block w-3 h-3 rounded-full ${entry.className}`}
                          />
                          {entry.label}
                        </span>
                      ))}
                      <span className="flex items-center gap-2">
                        <svg width="26" height="10" aria-hidden="true">
                          <line
                            x1="1"
                            y1="5"
                            x2="20"
                            y2="5"
                            stroke="black"
                            strokeWidth="1.6"
                          />
                          <path d="M20 1 L26 5 L20 9 z" fill="black" />
                        </svg>
                        Where that air drifted
                      </span>
                    </div>

                    <PaintedMap painted={painted} interval={interval} />
                  </Section>

                  <Section
                    heading="What this cannot show you"
                    subtitle="Limits of the picture above, so it is not read for more than it says."
                  >
                    <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
                      <li>
                        The cells are 12 km across. A release point and a mature
                        core an aircraft was standing off from land in the same
                        cell, and the map cannot separate them.
                      </li>
                      <li>
                        The drift arrow carries one storm-motion reading at
                        constant speed and bearing for the whole gap. A system
                        that turned or accelerated is not described by it.
                      </li>
                      <li>
                        Nothing here is an outcome. It says where the operator
                        flew against where we painted, not whether the seeding
                        worked.
                      </li>
                    </ul>
                  </Section>
                </>
              )}

              {day && day.unlocated.length > 0 && (
                <p className="text-xs">
                  {day.unlocated.length} more releases are logged this day
                  without a position, so they cannot be placed on the map.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
