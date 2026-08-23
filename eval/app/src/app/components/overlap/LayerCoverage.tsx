// React
import { useState } from "react";

// Layers
import { LAYERS } from "~/lib/layers";

// Types
import type { LayerProximity } from "~/lib/types";

/**
 * How many releases sat in each layer, and how far the rest were.
 *
 * **A bar per layer, not per flare.** One far release used to set the scale of
 * a whole chart, so four flares in a raining cell ten cells away looked like
 * the finding. Counts do not have a scale that a miss can steal. Median
 * distance sits on the row so a layer nobody landed in still says how close
 * they came.
 *
 * Figures come from the eval server's `proximity` summary. Nothing here
 * re-derives a count from the flares.
 */

type PropsT = {
  cellKm: number;
  layers: Record<string, LayerProximity>;
};

function km(value: number | null): string {
  if (value === null) return "—";
  return `${Math.round(value)} km`;
}

export const LayerCoverage = ({ cellKm, layers }: PropsT) => {
  const [hover, setHover] = useState<string | null>(null);
  const hovered = hover ? LAYERS.find((layer) => layer.key === hover) : null;
  const hoveredStats = hover ? layers[hover] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs items-center">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-success" />
          Inside
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-info" />
          Within one {cellKm} km cell
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-base-content/20" />
          Further
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {LAYERS.map((layer) => {
          const stats = layers[layer.key];
          if (!stats || stats.n === 0) {
            return (
              <div key={layer.key} className="flex items-center gap-3">
                <div className="w-56 shrink-0 text-xs font-semibold">
                  {layer.legend.name}
                </div>
                <div className="text-xs">No frame to measure against.</div>
              </div>
            );
          }

          const near = Math.max(0, stats.withinCell - stats.inside);
          const further = Math.max(0, stats.n - stats.withinCell);
          const on = hover === layer.key;

          return (
            <div
              key={layer.key}
              className="flex items-center gap-3"
              onMouseEnter={() => setHover(layer.key)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="w-56 shrink-0 text-xs font-semibold">
                {layer.legend.name}
              </div>
              <div
                className={`flex h-4 flex-1 overflow-hidden rounded bg-base-300 ${
                  hover && !on ? "opacity-55" : ""
                }`}
                role="img"
                aria-label={`${layer.legend.name}: ${stats.inside} of ${stats.n} inside, median ${km(stats.median)}`}
              >
                {stats.inside > 0 && (
                  <div
                    className="bg-success min-w-[3px]"
                    style={{ flexGrow: stats.inside, flexBasis: 0 }}
                  />
                )}
                {near > 0 && (
                  <div
                    className="bg-info min-w-[3px]"
                    style={{ flexGrow: near, flexBasis: 0 }}
                  />
                )}
                {further > 0 && (
                  <div
                    className="bg-base-content/20"
                    style={{ flexGrow: further, flexBasis: 0 }}
                  />
                )}
              </div>
              <div className="w-16 shrink-0 text-right font-mono text-xs">
                {stats.inside}/{stats.n}
              </div>
              <div className="w-16 shrink-0 text-right font-mono text-xs">
                {km(stats.median)}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 text-[10px] font-mono opacity-70 -mt-1">
        <span className="w-16 text-right">inside</span>
        <span className="w-16 text-right">median</span>
      </div>

      <div className="text-xs font-mono min-h-[2.5rem] bg-base-200 p-2">
        {hovered && hoveredStats ? (
          <>
            {hovered.legend.name} — {hoveredStats.inside} inside ·{" "}
            {Math.max(0, hoveredStats.withinCell - hoveredStats.inside)} more
            within {cellKm} km ·{" "}
            {Math.max(0, hoveredStats.n - hoveredStats.withinCell)} further ·
            median {km(hoveredStats.median)}, worst {km(hoveredStats.worst)}
          </>
        ) : (
          <span className="opacity-70">
            Hover a layer for the split and the furthest miss.
          </span>
        )}
      </div>
    </div>
  );
};
