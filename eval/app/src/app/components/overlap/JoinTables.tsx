// Layers
import { LAYERS } from "~/lib/layers";

// Types
import type { LayerProximity, StormFinding } from "~/lib/types";

const pct = (n: number, d: number) =>
  d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`;

type LayerPropsT = {
  layers: Record<string, LayerProximity>;
};

/**
 * How many releases sat inside each original Weatherman layer.
 *
 * Inside is inside the contour after storm-motion drift. A layer that
 * could not be built for an hour is dropped from that row only.
 */
export const LayerTable = ({ layers }: LayerPropsT) => {
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
          {LAYERS.map((layer) => {
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

const TEXAS_ORDER = [
  "upwind",
  "inRain",
  "nearerEdge",
  "echoPastFreezing",
] as const;

type TexasPropsT = { storms: StormFinding };

/**
 * How many releases sat in each Texas selection feature.
 *
 * Upwind of the heaviest rain, inside 20 dBZ, nearer the edge than the
 * core, and an 18 dBZ echo top at or above freezing. The same readings
 * the flares page lists per release.
 */
export const TexasTable = ({ storms }: TexasPropsT) => {
  const byKey = Object.fromEntries(
    storms.tests.map((test) => [test.key, test])
  );
  const tests = TEXAS_ORDER.map((key) => byKey[key]).filter(Boolean);

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Feature</th>
            <th className="text-right">Yes</th>
            <th className="text-right">Of</th>
            <th className="text-right">Share</th>
          </tr>
        </thead>
        <tbody>
          {tests.map((test) => (
            <tr key={test.key}>
              <td>{test.label}</td>
              <td className="text-right font-mono">{test.yes}</td>
              <td className="text-right font-mono">{test.n}</td>
              <td className="text-right font-mono font-semibold">
                {pct(test.yes, test.n)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-xs font-mono pt-2">
        {storms.scored} of {storms.flares} painted releases, {storms.days} of{" "}
        {storms.flying} flying days
      </p>
    </div>
  );
};
