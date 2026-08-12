// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

/** "+6 h · Fri 06:00Z" — the operator needs both the offset and the wall time. */
function label(run: string, hour: number) {
  const valid = new Date(new Date(run).getTime() + hour * 3_600_000);
  const stamp = valid.toISOString();
  const day = valid.toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: "UTC",
  });
  return `${day} ${stamp.slice(11, 16)}Z`;
}

export const TimeSlider = () => {
  const dispatch = useAppDispatch();
  const meta = useAppSelector((state) => state.forecast.meta);
  const hour = useAppSelector((state) => state.forecast.hour);
  const drawing = useAppSelector((state) => state.forecast.drawing);
  const loading = useAppSelector((state) => state.forecast.loading);
  const error = useAppSelector((state) => state.forecast.error);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Loading forecast…
      </div>
    );
  }

  if (error) {
    return <div className="text-error p-4">{error}</div>;
  }

  if (!meta) {
    return null;
  }

  const last = meta.hours[meta.hours.length - 1];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="font-semibold">
          {hour === 0 ? "Analysis" : `+${hour} h`}
        </span>
        <span className="text-sm opacity-70">{label(meta.run, hour)}</span>
      </div>

      <input
        type="range"
        className="range range-sm"
        min={0}
        max={last}
        step={1}
        value={hour}
        aria-label="Forecast hour"
        onChange={(e) =>
          dispatch(forecastActions.setHour(Number(e.target.value)))
        }
      />

      <div className="flex justify-between text-xs opacity-60">
        <span>now</span>
        <span>+{last} h</span>
      </div>

      <div className="text-xs opacity-60 h-4">
        {drawing ? (
          <span className="flex items-center gap-2">
            <span className="loading loading-spinner loading-xs"></span>
            Drawing frame…
          </span>
        ) : (
          <span>
            HRRR run {label(meta.run, 0)} &middot; 3 km, averaged to 12 km
          </span>
        )}
      </div>
    </div>
  );
};
