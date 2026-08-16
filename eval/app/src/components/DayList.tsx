// Types
import type { DaySummary } from "~/lib/types";

/**
 * How a day's scoring came out, small enough to sit in a list.
 *
 * Candidates first because they are the rare case, then the radar veto because
 * it is the common disagreement. A day with neither had no liquid to begin
 * with, and the empty row says that by staying empty.
 */
const Chips = ({ day }: { day: DaySummary }) => {
  if (day.state === "unscored")
    return <span className="badge badge-xs badge-ghost">not scored</span>;
  if (day.state === "void")
    return <span className="badge badge-xs badge-warning">void</span>;

  const verdicts = day.verdicts ?? {};
  return (
    <span className="flex gap-1 flex-wrap">
      {verdicts.candidate ? (
        <span className="badge badge-xs badge-success">
          {verdicts.candidate} candidate
        </span>
      ) : null}
      {verdicts.raining ? (
        <span className="badge badge-xs badge-info">
          {verdicts.raining} raining
        </span>
      ) : null}
      {verdicts.noLiquid ? (
        <span className="badge badge-xs badge-ghost">
          {verdicts.noLiquid} no liquid
        </span>
      ) : null}
    </span>
  );
};

type PropsT = {
  days: DaySummary[];
  selected: string | null;
  onSelect: (date: string) => void;
};

export const DayList = ({ days, selected, onSelect }: PropsT) => (
  <ul className="menu menu-sm w-full gap-0.5 p-2">
    {days.map((day) => (
      <li key={day.date}>
        <button
          className={`flex flex-col items-start gap-1 ${day.date === selected ? "menu-active" : ""}`}
          onClick={() => onSelect(day.date)}
        >
          <span className="flex w-full justify-between gap-2">
            <span className="font-mono text-xs">{day.date}</span>
            <span className="text-xs">{day.located} flares</span>
          </span>
          <Chips day={day} />
        </button>
      </li>
    ))}
  </ul>
);
