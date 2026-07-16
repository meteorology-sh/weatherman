// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { interactionsActions } from "@/lib/store/features/interactions";

// ArcGIS
import { CloudLayerLegends } from "@/lib/arcgis/legends";

// Types
import type { CloudLayerId } from "@/lib/types";

const ORDER: CloudLayerId[] = ["geocolor", "band13"];

export const CloudLayers = () => {
  const dispatch = useAppDispatch();
  const active = useAppSelector((state) => state.interactions.cloudLayer);
  const legend = CloudLayerLegends[active];

  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label="Cloud imagery" className="join w-full">
        {ORDER.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={active === id}
            className={`btn btn-sm join-item flex-1 ${
              active === id ? "btn-active" : ""
            }`}
            onClick={() => dispatch(interactionsActions.setCloudLayer(id))}
          >
            {CloudLayerLegends[id].name}
          </button>
        ))}
      </div>

      <div className="text-xs opacity-60">{legend.summary}</div>

      {legend.gradient && (
        <div>
          <div
            className="h-2 w-full rounded"
            style={{ background: legend.gradient }}
          />
          {legend.band && (
            <div className="relative h-3">
              <div
                className="absolute h-3 border-x-2 border-b-2 border-white/70"
                style={{
                  left: `${legend.band.fromPercent}%`,
                  width: `${legend.band.toPercent - legend.band.fromPercent}%`,
                }}
                title={legend.band.label}
              />
            </div>
          )}
          <div className="relative h-4 text-xs opacity-60">
            {legend.ticks?.map((tick) => (
              <span
                key={tick.label}
                className="absolute -translate-x-1/2"
                style={{ left: `${tick.percent}%` }}
              >
                {tick.label}
              </span>
            ))}
          </div>
          {legend.band && (
            <div className="text-xs opacity-60">
              Bracket marks the {legend.band.label} (−12 to −5 °C).
            </div>
          )}
        </div>
      )}

      <div className="text-xs opacity-50">{legend.caveat}</div>
    </div>
  );
};
