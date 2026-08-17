// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

/**
 * Every flying day of the season, and what has been built for each.
 *
 * **A day says what it is missing rather than looking empty.** A day nobody has
 * painted yet is not a day with no liquid, and the two have to stay
 * distinguishable or a command not yet run reads as a finding.
 */
export const DayPicker = () => {
  const days = useAppSelector((state) => state.day.days);
  const date = useAppSelector((state) => state.day.date);
  const dispatch = useAppDispatch();

  if (!days) {
    return (
      <div className="p-4 flex items-center gap-3">
        <span className="loading loading-spinner loading-sm" />
        <span className="text-sm">Loading days…</span>
      </div>
    );
  }

  return (
    <ul className="menu menu-sm w-full p-0">
      {days.map((day) => (
        <li key={day.date}>
          <button
            type="button"
            className={`flex justify-between items-center rounded-none ${
              date === day.date ? "active" : ""
            }`}
            onClick={() => dispatch(dayActions.setDate(day.date))}
          >
            <span className="font-mono">{day.date}</span>
            <span className="flex items-center gap-2">
              <span className="text-xs opacity-80">{day.flares} flares</span>
              {day.held !== null && day.held > 0 && (
                <span className="badge badge-success badge-sm">{day.held}</span>
              )}
              {day.painted ? (
                <span className="badge badge-info badge-sm badge-outline">
                  painted
                </span>
              ) : (
                <span className="badge badge-ghost badge-sm">not painted</span>
              )}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
};
