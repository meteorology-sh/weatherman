// Hooks
import { useState } from "react";

// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { replayActions } from "@/lib/store/features/replay";

/**
 * Earliest hour this page will offer.
 *
 * GOES-19 became GOES-East in April 2025. Before that the eastern satellite was
 * GOES-16, in a different bucket, and the cloud-top layer would 404 while the
 * other two answered — a half-drawn map that looks like a bug rather than a
 * boundary. HRRR and MRMS both go back further; this floor is the satellite's.
 */
const EARLIEST = Date.UTC(2025, 3, 7);

/** HRRR posts ~50 min after the hour, so the last hour is not there yet. */
const PUBLISH_LAG_MS = 60 * 60_000;

const DAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * Pick an hour to replay.
 *
 * Everything is UTC and says so. The feeds are keyed on UTC cycles — an HRRR run
 * is "18z", not "1pm somewhere" — and quietly showing local time would mean the
 * date under the cursor and the date in the filename disagree for anyone west of
 * Greenwich.
 */
export const ReplayCalendar = () => {
  const at = useAppSelector((state) => state.replay.at);
  const dispatch = useAppDispatch();

  const selected = at ? new Date(at) : null;
  // Which month the grid is showing — ephemeral UI state, so local.
  const [month, setMonth] = useState(() => {
    const d = selected ?? new Date();
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const [hour, setHour] = useState(selected ? selected.getUTCHours() : 18);
  // Read the clock once, at mount, rather than on every render: `Date.now()` in
  // a render body is impure and the lint rule is right to refuse it. The bound
  // only moves an hour at a time, so a session left open simply keeps the
  // newest hour disabled slightly longer — the conservative direction.
  const [latest] = useState(() => Date.now() - PUBLISH_LAG_MS);
  const first = new Date(Date.UTC(month.year, month.month, 1));
  const days = new Date(Date.UTC(month.year, month.month + 1, 0)).getUTCDate();
  const pad = first.getUTCDay();

  const shift = (by: number) => {
    const d = new Date(Date.UTC(month.year, month.month + by, 1));
    setMonth({ year: d.getUTCFullYear(), month: d.getUTCMonth() });
  };

  const choose = (day: number, atHour: number) => {
    dispatch(
      replayActions.setAt(
        new Date(Date.UTC(month.year, month.month, day, atHour)).toISOString(),
      ),
    );
  };

  const stamp = (day: number) => Date.UTC(month.year, month.month, day, hour);
  const disabled = (day: number) =>
    stamp(day) > latest || stamp(day) < EARLIEST;
  const isSelected = (day: number) =>
    selected !== null &&
    selected.getUTCFullYear() === month.year &&
    selected.getUTCMonth() === month.month &&
    selected.getUTCDate() === day;

  return (
    <div className="bg-base-200 border-base-300 border rounded-box p-4">
      <div className="flex items-center justify-between pb-2">
        <button
          className="btn btn-xs btn-ghost"
          onClick={() => shift(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <span className="font-semibold text-sm">
          {MONTHS[month.month]} {month.year}
        </span>
        <button
          className="btn btn-xs btn-ghost"
          onClick={() => shift(1)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d, i) => (
          <span key={i} className="text-xs opacity-50 py-1">
            {d}
          </span>
        ))}
        {Array.from({ length: pad }, (_, i) => (
          <span key={`pad-${i}`} />
        ))}
        {Array.from({ length: days }, (_, i) => {
          const day = i + 1;
          const off = disabled(day);
          return (
            <button
              key={day}
              className={`btn btn-xs ${
                isSelected(day) ? "btn-primary" : "btn-ghost"
              }`}
              disabled={off}
              onClick={() => choose(day, hour)}
            >
              {day}
            </button>
          );
        })}
      </div>

      <div className="pt-4">
        <label className="text-xs opacity-70" htmlFor="replay-hour">
          Hour (UTC)
        </label>
        <select
          id="replay-hour"
          className="select select-sm w-full mt-1"
          value={hour}
          onChange={(event) => {
            const next = Number(event.target.value);
            setHour(next);
            // Keep the map and the picker in step: changing the hour of an
            // already-chosen day is a new request, not a pending edit.
            if (selected) choose(selected.getUTCDate(), next);
          }}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00 UTC
            </option>
          ))}
        </select>
      </div>

      {at && (
        <div className="pt-4 flex items-center justify-between">
          <span className="text-xs opacity-70">{at.replace(".000Z", "Z")}</span>
          <button
            className="btn btn-xs btn-ghost"
            onClick={() => dispatch(replayActions.setAt(null))}
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
};
