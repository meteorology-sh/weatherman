// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { interactionsActions } from "@/lib/store/features/interactions";

// Types
import type { CloudCoverPoint } from "@/lib/types";

export const Clouds = () => {
  const dispatch = useAppDispatch();
  const points = useAppSelector((state) => state.weather.CloudPoints);
  const loading = useAppSelector((state) => state.weather.loading);
  const error = useAppSelector((state) => state.weather.error);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Loading cloud cover...
      </div>
    );
  }

  if (error) {
    return <div className="text-error p-4">{error}</div>;
  }

  if (!points || points.length === 0) {
    return null;
  }

  const average = Math.round(
    points.reduce((sum, p) => sum + p.cloudCover, 0) / points.length
  );
  const cloudiest = [...points]
    .sort((a, b) => b.cloudCover - a.cloudCover)
    .slice(0, 10);

  const handleSelect = (point: CloudCoverPoint) => {
    dispatch(interactionsActions.setCoordinates([point.lon, point.lat]));
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="stats bg-base-200">
        <div className="stat py-2">
          <div className="stat-title">Grid points</div>
          <div className="stat-value text-lg">{points.length}</div>
        </div>
        <div className="stat py-2">
          <div className="stat-title">National average</div>
          <div className="stat-value text-lg">{average}%</div>
        </div>
      </div>

      <div>
        <div className="text-xs opacity-60 mb-1">Cloud cover</div>
        <div
          className="h-2 w-full rounded"
          style={{
            background:
              "linear-gradient(to right, rgba(56,168,255,0.3), rgba(200,205,215,0.6), rgba(255,255,255,0.95))",
          }}
        />
        <div className="flex justify-between text-xs opacity-60">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div className="text-xs opacity-60">
        Observed {points[0].time} UTC &middot; Open-Meteo
      </div>

      <div className="prose">
        <h4>Cloudiest right now</h4>
      </div>
      <div className="flex flex-col gap-1 max-h-[40vh] overflow-y-auto">
        {cloudiest.map((p) => (
          <button
            key={`${p.lat},${p.lon}`}
            className="btn btn-ghost btn-sm justify-start text-left h-auto py-2 normal-case"
            onClick={() => handleSelect(p)}
          >
            <div className="flex w-full items-center justify-between">
              <span className="text-sm">
                {p.lat.toFixed(1)}°, {p.lon.toFixed(1)}°
              </span>
              <span className="text-xs opacity-60">{p.cloudCover}%</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
