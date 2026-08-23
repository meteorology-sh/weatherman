// Layers
import { LAYERS } from "~/lib/layers";

// Types
import type { Flare } from "~/lib/types";

// Components
import { cellSize, distanceLabel, toneFor } from "./distance";

/**
 * Each release against every layer, as inside or as kilometres.
 *
 * **The row is one flare.** A release can sit in painted liquid and still miss
 * the join; this is where that pair of facts is visible at once, without
 * hovering a map. Kilometres are to the nearest edge after drifting to the
 * analysis — the same number the maps measure at the arrowhead.
 */

type PropsT = {
  flares: Flare[];
  cellKm: number | Record<string, number>;
};

export const FlareDistances = ({ flares, cellKm }: PropsT) => {
  const rows = [...flares].sort((a, b) => a.at.localeCompare(b.at));

  if (!rows.length) {
    return <p className="text-sm">No located releases this day.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Time</th>
            <th>County</th>
            {LAYERS.map((layer) => (
              <th key={layer.key} className="text-right whitespace-normal">
                {layer.legend.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((flare) => (
            <tr key={flare.at}>
              <td className="font-mono whitespace-nowrap">{flare.timeZ}Z</td>
              <td>{flare.county}</td>
              {LAYERS.map((layer) => {
                const near = flare.near[layer.key] ?? null;
                const tone = toneFor(near, cellSize(cellKm, layer.key));
                return (
                  <td
                    key={layer.key}
                    className={`text-right font-mono whitespace-nowrap ${tone.text}`}
                  >
                    {distanceLabel(near)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
