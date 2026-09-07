/**
 * The numbers a click gives, written the way the operator panel writes them.
 *
 * **Nothing here decides what a reading is worth.** Each row is one label and
 * one string, formatted the way `CloudHere`, `Sounding` and `Convective` format
 * it in Weatherman — same units, same em dash for a reading that is not there,
 * same above-and-below-freezing phrasing. A release listed here has to read as
 * the cell an operator would have seen, so a rounding this file invented would
 * be a disagreement with the panel being evaluated.
 *
 * The −15 °C height is interpolated by the product's own `heightAtC` over the
 * profile the painted file stores whole, rather than by a rule written here.
 */

// Format
import { heightAtC } from "@/lib/format";

// Types
import type { CellAtFlare, ColumnAtFlare } from "~/lib/types";

const num = new Intl.NumberFormat("en-US");

const feet = (value: number | null | undefined) =>
  value == null ? "—" : `${num.format(value)} ft`;

export type Row = { label: string; value: string };

/** Did a click on this release say FLY? Null when the point was never asked. */
export function flew(cell: CellAtFlare | null | undefined): boolean | null {
  if (!cell) return null;
  return cell.target === "target";
}

/**
 * How high the 18 dBZ echo top sat, against the freezing level under it.
 *
 * The panel prints the gap rather than the two heights, because the gap is
 * the reading: an echo top past freezing is the test, and its height above
 * the sea is not.
 */
function echoVersusFreezing(cell: CellAtFlare): string {
  if (cell.echoTopFt === null) return "—";
  if (cell.freezingFt === null) return `${num.format(cell.echoTopFt)} ft MSL`;
  return cell.echoTopFt >= cell.freezingFt
    ? `${num.format(cell.echoTopFt - cell.freezingFt)} ft above freezing`
    : `${num.format(cell.freezingFt - cell.echoTopFt)} ft below freezing`;
}

/** No radar looking at the cell is a different answer from no echo in it. */
function rain(cell: CellAtFlare): string {
  if (!cell.radarCovered) return "no radar";
  if (cell.dbz === null) return "—";
  return `${cell.dbz} dBZ`;
}

/**
 * The numbers under FLY or DON'T FLY, as `CloudHere` prints them.
 *
 * A release with no reading still returns every label, so a table can take its
 * headings from this list and a row with nothing to say lines up under them.
 */
export function cellRows(cell: CellAtFlare | null | undefined): Row[] {
  return [
    {
      label: "Base Above Ground",
      value: cell ? feet(cell.cloudBaseAglFt) : "—",
    },
    {
      label: "18 dBZ Echo Top",
      value: cell ? echoVersusFreezing(cell) : "—",
    },
    { label: "Rain", value: cell ? rain(cell) : "—" },
    {
      label: "Supercooled Liquid Water",
      value:
        !cell || cell.slwGM2 === null ? "—" : `${num.format(cell.slwGM2)} g/m²`,
    },
  ];
}

/** Heights on this column, as `Sounding` prints them. */
export function columnRows(column: ColumnAtFlare | null | undefined): Row[] {
  const band =
    column && column.bandBaseFt !== null && column.bandTopFt !== null
      ? `${num.format(column.bandBaseFt)}–${num.format(column.bandTopFt)} ft`
      : "—";
  return [
    { label: "Ground", value: feet(column?.surfaceFt) },
    { label: "Freezing level", value: feet(column?.freezingFt) },
    {
      label: "−15 °C",
      value: column ? feet(heightAtC(column.levels, -15)) : "—",
    },
    { label: "Seeding band", value: band },
  ];
}

/**
 * Warm-cloud depth, the way `Convective` derives it: freezing level minus
 * cloud base, and only where the base is the lower of the two.
 */
export function warmDepthFt(column: ColumnAtFlare): number | null {
  const base = column.diagnostics?.cloudBaseFt ?? null;
  if (column.freezingFt === null || base === null) return null;
  return base < column.freezingFt ? column.freezingFt - base : null;
}

/** The modeled convective numbers, as `Convective` prints them. */
export function environmentRows(
  column: ColumnAtFlare | null | undefined
): Row[] {
  const d = column?.diagnostics;
  const energy = (value: number | undefined) =>
    value == null ? "—" : `${num.format(value)} J/kg`;
  return [
    { label: "CAPE, mixed layer", value: energy(d?.mixedCapeJKg) },
    { label: "CAPE, surface", value: energy(d?.capeJKg) },
    { label: "CIN, mixed layer", value: energy(d?.cinJKg) },
    { label: "LCL", value: feet(d?.lclFt) },
    {
      label: "Warm-cloud depth",
      value: column ? feet(warmDepthFt(column)) : "—",
    },
    { label: "Modeled echo top", value: feet(d?.echoTopFt) },
    {
      label: "Integrated liquid",
      value: d == null ? "—" : `${d.vilKgM2} kg/m²`,
    },
  ];
}
