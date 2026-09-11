// Components
import { MATCH, MISS, NEUTRAL } from "./storm";
import {
  clickExtraRows,
  cloudRows,
  decisionRows,
  environmentRows,
  flew,
  payloadLabel,
  radarRows,
  SECTIONS,
} from "./readout";

// Types
import type { Flare } from "~/lib/types";
import type { Row } from "./readout";

/**
 * What a click on each release would have answered.
 *
 * **These are the operator's own panel, one row per flare, in the panel's
 * order:** FLY or DON'T FLY with the tests behind it, then Radar, Cloud and
 * Environment. Every row is built by the product's own `@/lib/readout`, so a
 * figure printed here reads as the figure an operator would have read. The
 * last table is the evaluation's own — what the click carries that the panel
 * does not print.
 *
 * A release whose painted record has no `cell`, `storm` or `column` was written
 * before `paint.mjs` stored them, and every one of its numbers is an em dash
 * rather than a zero.
 */

type PropsT = { flares: Flare[] };

type LeadT = { label: string; cell: (flare: Flare) => React.ReactNode };

const verdictTone = (fly: boolean | null) =>
  fly === null ? NEUTRAL : fly ? MATCH : MISS;

const verdictLabel = (fly: boolean | null) =>
  fly === null ? "—" : fly ? "FLY" : "DON'T FLY";

/** The badge columns the panel prints in its heading. */
const VERDICT: LeadT[] = [
  {
    label: "Verdict",
    cell: (flare) => {
      const fly = flew(flare.cell);
      return (
        <span className={verdictTone(fly).text}>{verdictLabel(fly)}</span>
      );
    },
  },
  { label: "Payload", cell: (flare) => payloadLabel(flare.cell) ?? "—" },
];

function Table({
  title,
  flares,
  rows,
  lead = [],
}: {
  title: string;
  flares: Flare[];
  rows: (flare: Flare | null) => Row[];
  lead?: LeadT[];
}) {
  const labels = rows(null).map((row) => row.label);
  return (
    <div className="flex flex-col gap-2">
      <h4 className="text-sm font-semibold">{title}</h4>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Time</th>
              <th>County</th>
              {[...lead.map((column) => column.label), ...labels].map(
                (label) => (
                  <th key={label} className="text-right whitespace-normal">
                    {label}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {flares.map((flare) => (
              <tr key={flare.at}>
                <td className="font-mono whitespace-nowrap">{flare.timeZ}Z</td>
                <td>{flare.county}</td>
                {lead.map((column) => (
                  <td
                    key={column.label}
                    className="text-right font-mono whitespace-nowrap"
                  >
                    {column.cell(flare)}
                  </td>
                ))}
                {rows(flare).map((cell) => (
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

      <Table
        title="Fly or Don't Fly"
        flares={sorted}
        lead={VERDICT}
        rows={(flare) => decisionRows(flare?.cell)}
      />
      <Table
        title={SECTIONS.radar}
        flares={sorted}
        rows={(flare) => radarRows(flare?.storm)}
      />
      <Table
        title={SECTIONS.cloud}
        flares={sorted}
        rows={(flare) => cloudRows(flare?.cell, flare?.column)}
      />
      <Table
        title={SECTIONS.environment}
        flares={sorted}
        rows={(flare) => environmentRows(flare?.cell, flare?.column)}
      />
      <Table
        title="Rest of the Click"
        flares={sorted}
        rows={(flare) => clickExtraRows(flare?.cell)}
      />
    </div>
  );
};
