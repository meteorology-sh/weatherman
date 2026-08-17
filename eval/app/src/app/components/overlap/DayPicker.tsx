// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

/**
 * Every flying day of the season, and what has been built for each.
 *
 * **A day says what it is missing rather than looking empty.** A day nobody has
 * painted yet is not a day with no liquid, and the two have to stay
 * distinguishable or a command not yet run reads as a finding. Unpainted days
 * are listed and cannot be opened, with the command that would build one.
 */
export const DayPicker = () => {
  const days = useAppSelector((state) => state.day.days);
  const date = useAppSelector((state) => state.day.date);
  const region = useAppSelector((state) => state.day.region);
  const dispatch = useAppDispatch();

  if (!days) {
    return (
      <div className="flex items-center gap-3">
        <span className="loading loading-spinner loading-sm" />
        <span className="text-sm">Loading days…</span>
      </div>
    );
  }

  const painted = days.filter((day) => day.painted);
  const rest = days.length - painted.length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {painted.map((day) => (
          <button
            key={day.date}
            type="button"
            className={`btn btn-sm ${
              date === day.date ? "btn-active" : "btn-outline"
            }`}
            onClick={() => dispatch(dayActions.setDate(day.date))}
          >
            <span className="font-mono">{day.date}</span>
            <span className="badge badge-sm">{day.flares} flares</span>
          </button>
        ))}
      </div>

      {rest > 0 && (
        <p className="text-xs">
          {rest} more flying {rest === 1 ? "day is" : "days are"} logged this
          season and not painted yet. Building one is{" "}
          <code className="font-mono">
            node eval/held.mjs &lt;date&gt; --region={region}
          </code>
          , which fetches five layers at every analysis that day's flares sit
          between.
        </p>
      )}
    </div>
  );
};
