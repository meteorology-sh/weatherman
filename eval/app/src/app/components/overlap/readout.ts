/**
 * The numbers a click gives, as the operator panel prints them.
 *
 * **The panel's rows are the product's own.** `decisionRows`, `radarRows`,
 * `cloudRows` and `environmentRows` come from `@/lib/readout`, the same
 * builders `FlyHere`, `StormHere`, `Cloud` and `Environment` render in
 * Weatherman — same labels, same order, same units, same em dash for a reading
 * that is not there. A release listed here has to read as the cell an operator
 * would have seen, so a rounding this file invented would be a disagreement
 * with the panel being evaluated.
 *
 * What is written here is only what the evaluation asks that the panel does
 * not print. **Nothing here decides what a reading is worth.**
 */

// Types
import type { CellAtFlare } from "~/lib/types";
import type { Row } from "@/lib/readout";

export {
  cloudRows,
  decisionRows,
  environmentRows,
  payloadLabel,
  radarRows,
  REASON,
  SECTIONS,
} from "@/lib/readout";
export type { Row } from "@/lib/readout";

const num = new Intl.NumberFormat("en-US");

const feet = (value: number | null | undefined) =>
  value == null ? "—" : `${num.format(value)} ft`;

/** Did a click on this release say FLY? Null when the point was never asked. */
export function flew(cell: CellAtFlare | null | undefined): boolean | null {
  if (!cell) return null;
  return cell.target === "target";
}

/**
 * The rest of what `/candidate/point` returns, which the operator panel does
 * not print.
 *
 * The panel's rows have to stay the panel — a figure there reads as the figure
 * an operator saw. This block is the evaluation's own question: everything else
 * the click carries, so a flare can be read against the whole answer without a
 * second run. Nothing here is a verdict.
 *
 * The freezing level is the click's, the one the echo-top test was asked
 * against. The panel's Environment table prints the column's.
 */
export function clickExtraRows(cell: CellAtFlare | null | undefined): Row[] {
  const drawn =
    !cell || cell.cloudBaseMslFt == null ? "—" : cell.baseDrawn ? "Yes" : "No";
  return [
    { label: "Liquid Verdict", value: cell?.verdict ?? "—" },
    {
      label: "HRRR Base (MSL)",
      value: cell ? feet(cell.cloudBaseFt) : "—",
    },
    { label: "Base Drawn", value: drawn },
    {
      label: "Freezing Level at the Click",
      value: cell ? feet(cell.freezingFt) : "—",
    },
    { label: "Radar Scan", value: clock(cell?.radarTime) },
    { label: "Satellite Scan", value: clock(cell?.sceneTime) },
    { label: "Phase Scan", value: clock(cell?.phaseTime) },
  ];
}

/** A scan time as HH:MMZ — the minute is the point, the date is the day. */
function clock(iso: string | null | undefined): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return `${String(at.getUTCHours()).padStart(2, "0")}:${String(
    at.getUTCMinutes()
  ).padStart(2, "0")}Z`;
}
