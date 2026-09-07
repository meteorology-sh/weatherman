// Types
import type { Ascent, BandFinding } from "~/lib/types";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;
const meters = (value: number) => `${Math.round(value)} m`;

type PropsT = { band: BandFinding };

function siteName(band: BandFinding, code: string): string {
  return band.sites[code]?.name ?? code;
}

function bandSpan(pair: [number, number]): string {
  return `${meters(pair[0])} – ${meters(pair[1])}`;
}

/**
 * Every scored ascent of the season, as the overlap number the columns
 * already draw.
 *
 * One row per balloon. Overlap is shared height over combined height, so
 * a band drawn far too deep does not score 100% for covering everything.
 */
export const BandOverlap = ({ band }: PropsT) => {
  const rows: Ascent[] = band.ascents;
  if (!rows.length) return null;

  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Day</th>
            <th>Ascent</th>
            <th className="text-right">Balloon</th>
            <th className="text-right">What we drew</th>
            <th className="text-right">Overlap</th>
            <th className="text-right">Measured depth</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((ascent) => (
            <tr key={`${ascent.date}-${ascent.site}`}>
              <td className="font-mono whitespace-nowrap">{ascent.date}</td>
              <td>{siteName(band, ascent.site)}</td>
              <td className="text-right font-mono whitespace-nowrap">
                {bandSpan(ascent.measured)}
              </td>
              <td className="text-right font-mono whitespace-nowrap">
                {bandSpan(ascent.ours)}
              </td>
              <td className="text-right font-mono font-semibold">
                {pct(ascent.fraction)}
              </td>
              <td className="text-right font-mono">
                {meters(ascent.depth)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
