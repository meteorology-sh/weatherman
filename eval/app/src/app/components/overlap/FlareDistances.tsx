// Layers
import { LAYERS } from "~/lib/layers";

// Types
import type { Flare, Presence } from "~/lib/types";

// Components
import { cellSize, distanceLabel, toneFor, type Tone } from "./distance";
import { MATCH, MISS, NEUTRAL } from "./storm";

/**
 * Each release against every layer, as inside or as kilometres.
 *
 * **The row is one flare.** A release can sit in painted liquid and still miss
 * the join; this is where that pair of facts is visible at once, without
 * hovering a map. Kilometres are to the nearest edge after drifting to the
 * analysis — the same number the maps measure at the arrowhead. When the
 * hour-pair run has been stored on the flare, the last columns say whether
 * each join test held at both bounding hours, one of them, or neither.
 */

type PropsT = {
  flares: Flare[];
  cellKm: number | Record<string, number>;
};

/**
 * Join tests carried on a flare, in the order between.mjs then target.mjs
 * ask them. A key that never appears on this day stays off the table.
 */
const PRESENT_LABELS: Record<string, string> = {
  liquid: "Supercooled liquid in the band",
  cloudReady: "Seedable cloud, before the rain test",
  candidate: "Seedable, rain included",
  baseInWindow: "Cloud base in the 4,000–12,000 ft window",
  pastFreezing: "Echo top at or above freezing",
  target: "Texas target",
};

const PRESENT_ORDER = Object.keys(PRESENT_LABELS);

const ONE: Tone = {
  fill: "fill-warning",
  stroke: "stroke-warning",
  text: "text-warning",
  label: "One of the two hours",
};

function presentKeys(flares: Flare[]): string[] {
  const seen = new Set<string>();
  for (const flare of flares) {
    for (const key of Object.keys(flare.present ?? {})) seen.add(key);
  }
  return PRESENT_ORDER.filter((key) => seen.has(key));
}

function presenceTone(value: Presence | null | undefined): Tone {
  if (value === "both") return MATCH;
  if (value === "one") return ONE;
  if (value === "neither") return MISS;
  return NEUTRAL;
}

function presenceLabel(value: Presence | null | undefined): string {
  if (!value || value === "unusable") return "—";
  return value;
}

export const FlareDistances = ({ flares, cellKm }: PropsT) => {
  const rows = [...flares].sort((a, b) => a.at.localeCompare(b.at));
  const tests = presentKeys(rows);

  if (!rows.length) {
    return <p className="text-sm">No located releases this day.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      {tests.length > 0 && (
        <div className="flex flex-wrap gap-4 text-xs items-center">
          <span className={`font-mono ${MATCH.text}`}>both</span>
          <span>at both bounding hours</span>
          <span className={`font-mono ${ONE.text}`}>one</span>
          <span>at exactly one</span>
          <span className={`font-mono ${MISS.text}`}>neither</span>
        </div>
      )}
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
              {tests.map((key) => (
                <th key={key} className="text-right whitespace-normal">
                  {PRESENT_LABELS[key] ?? key}
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
                {tests.map((key) => {
                  const value = flare.present?.[key] ?? null;
                  const tone = presenceTone(value);
                  return (
                    <td
                      key={key}
                      className={`text-right font-mono whitespace-nowrap ${tone.text}`}
                    >
                      {presenceLabel(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
