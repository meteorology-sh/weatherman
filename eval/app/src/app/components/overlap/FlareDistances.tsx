// Layers
import { RESULT_ORDER } from "~/lib/layers";

// Types
import type { Flare } from "~/lib/types";

// Components
import { cellSize, distanceLabel, toneFor } from "./distance";

/**
 * Each release against every layer, as inside or as kilometers.
 *
 * **The row is one flare.** A release can sit in rain, under a cloud base the
 * model has at all, and still miss the fly fill that wants a reachable base
 * and an echo top past freezing as well; this is where those facts are visible
 * together, without hovering a map. Kilometers are to the nearest edge, from
 * the release for the radar and satellite layers and from the arrowhead for the
 * model ones — each layer measured against the clock that places its edge.
 *
 * **SEEDING OPPORTUNITY is the last column.** Every column left of it is one of
 * the tests that fill wants at once, so the row reads as the working and then
 * the answer.
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
            {RESULT_ORDER.map((layer) => (
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
              {RESULT_ORDER.map((layer) => {
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
