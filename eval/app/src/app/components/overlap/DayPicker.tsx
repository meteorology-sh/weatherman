// Hooks
import { useAppSelector } from "~/lib/store/hooks";

/**
 * What has been built for this season, and what has not.
 *
 * **It states coverage; it does not select.** Switching days is one control, in
 * the bar at the top, where it is reachable without scrolling. A second picker
 * here would be two places to change one thing and two places to keep in step.
 *
 * **A day nobody has painted is not a day with nothing on it**, and the two have to
 * stay distinguishable or a command not yet run reads as a finding. So the ones
 * that are missing are counted rather than hidden, with the command that builds
 * one.
 */
export const DayPicker = () => {
  const days = useAppSelector((state) => state.day.days);
  const region = useAppSelector((state) => state.day.region);

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
      <p className="text-sm">
        {painted.length} of {days.length} flying days painted —{" "}
        <span className="font-mono">
          {painted.map((day) => day.date).join(", ")}
        </span>
        .
      </p>

      {rest > 0 && (
        <p className="text-xs">
          The other {rest} {rest === 1 ? "day is" : "days are"} logged and not
          built yet. Building one is{" "}
          <code className="font-mono">
            node eval/paint.mjs &lt;date&gt; --region={region}
          </code>
          , which fetches five layers at every analysis that day's flares are
          charged to — about a minute per analysis.
        </p>
      )}
    </div>
  );
};
