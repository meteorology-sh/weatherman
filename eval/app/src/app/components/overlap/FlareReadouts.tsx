// Components
import { MATCH, MISS, NEUTRAL } from "./storm";
import { cellRows, columnRows, environmentRows, flew } from "./readout";

// Types
import type { Flare } from "~/lib/types";
import type { Row } from "./readout";

/**
 * What a click on each release would have answered.
 *
 * **These are the operator's own panel, one row per flare.** Weatherman answers
 * a click with FLY or DON'T FLY and the numbers behind the call, plus the
 * modelled column over that point. Both blocks are formatted by `readout.ts`
 * from the product's own rules, so a figure printed here reads as the figure an
 * operator would have read. The storm a release sat in is context for the map
 * rather than a verdict, and stays on the hover there.
 *
 * A release whose painted record has no `cell` or `column` was written before
 * `paint.mjs` stored them, and every one of its numbers is an em dash rather
 * than a zero.
 */

type PropsT = { flares: Flare[] };

const verdictTone = (fly: boolean | null) =>
  fly === null ? NEUTRAL : fly ? MATCH : MISS;

const verdictLabel = (fly: boolean | null) =>
  fly === null ? "—" : fly ? "FLY" : "DON'T FLY";

function Table({
  labels,
  rows,
}: {
  labels: string[];
  rows: { flare: Flare; cells: Row[]; lead?: React.ReactNode }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="table table-sm">
        <thead>
          <tr>
            <th>Time</th>
            <th>County</th>
            {rows[0]?.lead !== undefined && (
              <th className="text-right">Verdict</th>
            )}
            {labels.map((label) => (
              <th key={label} className="text-right whitespace-normal">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ flare, cells, lead }) => (
            <tr key={flare.at}>
              <td className="font-mono whitespace-nowrap">{flare.timeZ}Z</td>
              <td>{flare.county}</td>
              {lead !== undefined && lead}
              {cells.map((cell) => (
                <td
                  key={cell.label}
                  className="text-right font-mono whitespace-nowrap"
                >
                  {cell.value}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const FlareReadouts = ({ flares }: PropsT) => {
  const sorted = [...flares].sort((a, b) => a.at.localeCompare(b.at));

  if (!sorted.length) {
    return <p className="text-sm">No located releases this day.</p>;
  }

  const answered = sorted.filter((flare) => flare.cell || flare.column).length;

  return (
    <div className="flex flex-col gap-6">
      {answered < sorted.length && (
        <p className="text-sm">
          {answered} of {sorted.length} releases carry a click readout. A row of
          dashes is a flare painted before{" "}
          <span className="font-mono">node eval/paint.mjs</span> stored one.
        </p>
      )}

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">The cell</h4>
        <Table
          labels={cellRows(null).map((row) => row.label)}
          rows={sorted.map((flare) => {
            const fly = flew(flare.cell);
            return {
              flare,
              cells: cellRows(flare.cell),
              lead: (
                <td
                  className={`text-right font-mono whitespace-nowrap ${verdictTone(fly).text}`}
                >
                  {verdictLabel(fly)}
                </td>
              ),
            };
          })}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">The column</h4>
        <Table
          labels={columnRows(null).map((row) => row.label)}
          rows={sorted.map((flare) => ({
            flare,
            cells: columnRows(flare.column),
          }))}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h4 className="text-sm font-semibold">The environment</h4>
        <Table
          labels={environmentRows(null).map((row) => row.label)}
          rows={sorted.map((flare) => ({
            flare,
            cells: environmentRows(flare.column),
          }))}
        />
      </div>
    </div>
  );
};
