// Layers
import { RESULT_ORDER } from "~/lib/layers";

// Types
import type { LayerProximity } from "~/lib/types";

const pct = (n: number, d: number) =>
  d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`;

type PropsT = {
  layers: Record<string, LayerProximity>;
};

/**
 * How many of the season's releases sat inside each layer Weatherman draws.
 *
 * Inside is inside the contour after storm-motion drift to that layer's own
 * scan. A layer that could not be built for an hour is dropped from that row
 * only, so a gap in one field never silently shrinks another's denominator.
 *
 * The rows run in `RESULT_ORDER`, so SEEDING OPPORTUNITY is the last of them
 * here for the same reason it is the last column on the day page: the fills
 * above it are the tests, and the fly fill is what they add up to.
 */
export const LayerTable = ({ layers }: PropsT) => {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Layer</th>
            <th className="text-right">Inside</th>
            <th className="text-right">Of</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {RESULT_ORDER.map((layer) => {
            const stats = layers[layer.key];
            if (!stats || stats.n === 0) {
              return (
                <tr key={layer.key}>
                  <td>{layer.legend.name}</td>
                  <td className="text-right font-mono" colSpan={3}>
                    no frame
                  </td>
                </tr>
              );
            }
            return (
              <tr key={layer.key}>
                <td>{layer.legend.name}</td>
                <td className="text-right font-mono">{stats.inside}</td>
                <td className="text-right font-mono">{stats.n}</td>
                <td className="text-right font-mono font-semibold">
                  {pct(stats.inside, stats.n)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
