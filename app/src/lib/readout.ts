/**
 * The rows a map click prints, section by section.
 *
 * The panel reads top to bottom as an operator decides: FLY or DON'T FLY and
 * the tests behind it, then the storm on radar, then the cloud, then the air
 * around it. The operator panel renders these rows and the evaluation's flare
 * tables print the same ones, so a figure in either reads as the other does.
 *
 * **Nothing here decides anything.** Each row is one label and one string. The
 * verdict comes from the server; this only says it in words.
 *
 * Every height names its datum. A base above the ground and a freezing level
 * above the sea are both "ft", and a reader should not have to know which is
 * which.
 */

// ArcGIS
import { BASE_CEILING_LABEL } from "@/lib/arcgis/legends";

// Format
import { heightAtC } from "@/lib/format";

// Types
import type {
  Diagnostics,
  SeedingPayload,
  SoundingLevel,
  TargetVerdict,
} from "@/lib/types";

export type Row = { label: string; value: string };

/**
 * One 3 km cell as `/candidate/point` answers it — `CandidatePoint`, or the
 * copy the evaluation stores on a release, whose older files lack some fields.
 */
export type CellReading = {
  target: string | null;
  payload?: SeedingPayload | null;
  cloudBaseMslFt?: number | null;
  baseSource?: "model" | "ccl" | null;
  cloudBaseAglFt: number | null;
  cclFt?: number | null;
  warmCloudDepthFt?: number | null;
  echoTopFt: number | null;
  freezingFt: number | null;
  dbz: number | null;
  radarCovered: boolean;
  slwGM2: number | null;
  cloudTopC?: number | null;
  topPhase?: string | null;
};

/** The nearest radar storm to a click — `StormNear`, or the stored copy. */
export type StormReading = {
  inside: boolean;
  edgeKm: number | null;
  object: { motionTowardDeg: number | null; motionKmh: number | null } | null;
  goesTopC: number | null;
  goesTopDeltaC: number | null;
  echoTopFt: number | null;
  modelEchoTopFt: number | null;
  freezingFt: number | null;
  glmFlashes: number | null;
};

/** The modeled column over a click — `Sounding`, or the stored copy. */
export type ColumnReading = {
  surfaceFt: number | null;
  freezingFt: number | null;
  bandBaseFt: number | null;
  bandTopFt: number | null;
  levels: SoundingLevel[];
  diagnostics: Diagnostics | null;
};

export const SECTIONS = {
  radar: "Radar",
  cloud: "Cloud",
  environment: "Environment",
} as const;

/** The row that says which test a DON'T FLY cell failed. */
export const REASON = "Reason";

/** Each failed test, in the words an operator would use for it. */
export const REASONS: Record<Exclude<TargetVerdict, "target">, string> = {
  noCloudBase: "No Cloud Base",
  baseTooHigh: `Cloud Base at or Above ${BASE_CEILING_LABEL} MSL`,
  noStorm: "No Rain Nearby",
  noIceNoWarmLayer: "No Echo Top Past Freezing or Warm Layer",
};

/**
 * The satellite's phase classes as an operator reads them.
 *
 * "Supercooled" is spelled out rather than abbreviated: it is liquid water
 * below freezing, which is what seeding works on.
 */
export const PHASE_LABELS: Record<string, string> = {
  clear: "Clear",
  liquid: "Liquid",
  supercooled: "Supercooled Liquid",
  mixed: "Mixed Phase",
  ice: "Ice",
  unknown: "Unknown",
};

/**
 * Which flare the column supports, as the badge beside FLY reads it.
 *
 * Silver iodide needs cloud that reaches the freezing level; a salt flare
 * needs a warm layer under the base and does not care what the top did.
 */
export const PAYLOAD_LABELS: Record<SeedingPayload, string> = {
  ice: "ICE",
  salt: "SALT",
  both: "ICE + SALT",
};

const DASH = "—";
const num = new Intl.NumberFormat("en-US");
const tenths = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const whole = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

const known = (value: number | null | undefined): value is number =>
  value != null && Number.isFinite(value);

const feet = (value: number) => `${whole.format(value)} ft`;
const msl = (value: number | null | undefined) =>
  known(value) ? `${feet(value)} MSL` : DASH;

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const compass = (deg: number) => POINTS[Math.round(deg / 45) % 8];

/**
 * An echo top against the freezing level under it.
 *
 * The gap is the reading: an echo top past freezing is the test, and its
 * height above the sea is not.
 */
function versusFreezing(top: number, freezing: number | null): string {
  if (freezing === null) return `${feet(top)} MSL`;
  return top >= freezing
    ? `${feet(top - freezing)} above freezing`
    : `${feet(freezing - top)} below freezing`;
}

const signedC = (value: number) =>
  value > 0 ? `+${tenths.format(value)} °C` : `${tenths.format(value)} °C`;

/** Did a click on this cell say FLY? */
export const flies = (cell: CellReading) => cell.target === "target";

/** The flare badge, on FLY only: on a cell nobody flies to it reads as an order. */
export function payloadLabel(cell: CellReading | null | undefined) {
  if (!cell || !flies(cell) || !cell.payload) return null;
  return PAYLOAD_LABELS[cell.payload];
}

function reason(cell: CellReading): string {
  if (cell.target === null || flies(cell)) return DASH;
  return REASONS[cell.target as keyof typeof REASONS] ?? cell.target;
}

/**
 * The tests under FLY or DON'T FLY, and the failed one named.
 *
 * The base is the one the test was asked of — HRRR's own, or the CCL where it
 * has none — in MSL, because the ceiling it is held under is an MSL altitude.
 * Warm-cloud depth is the salt flare's test, as the echo top is silver
 * iodide's.
 *
 * A cell with nothing to say still returns every label, so a table can take its
 * headings from this list.
 */
export function decisionRows(cell: CellReading | null | undefined): Row[] {
  const base =
    !cell || !known(cell.cloudBaseMslFt)
      ? DASH
      : `${feet(cell.cloudBaseMslFt)} MSL${cell.baseSource === "ccl" ? " (CCL)" : " (model)"}`;
  const echo =
    !cell || cell.echoTopFt === null
      ? DASH
      : versusFreezing(cell.echoTopFt, cell.freezingFt);
  // No radar looking at the cell is a different answer from no echo in it.
  const rain = !cell
    ? DASH
    : !cell.radarCovered
      ? "No Radar"
      : cell.dbz === null
        ? DASH
        : `${cell.dbz} dBZ`;
  const warm = !cell
    ? DASH
    : known(cell.warmCloudDepthFt)
      ? feet(cell.warmCloudDepthFt)
      : "None";

  return [
    { label: REASON, value: cell ? reason(cell) : DASH },
    { label: "Cloud Base", value: base },
    { label: "18 dBZ Echo Top", value: echo },
    { label: "Rain", value: rain },
    { label: "Warm-Cloud Depth", value: warm },
  ];
}

/**
 * The nearest radar storm and the readings taken over it.
 *
 * Distance is to the edge of the outline the radar layer draws, so it cannot
 * disagree with the ring on the screen. The echo top falls back to the model's
 * where no 18 dBZ top was measured, and says so.
 */
export function radarRows(storm: StormReading | null | undefined): Row[] {
  const motion =
    !storm?.object ||
    storm.object.motionTowardDeg === null ||
    storm.object.motionKmh === null
      ? DASH
      : `${compass(storm.object.motionTowardDeg)} ${tenths.format(storm.object.motionKmh)} km/h`;
  const edge =
    !storm || storm.edgeKm === null
      ? DASH
      : `${tenths.format(storm.edgeKm)} km ${storm.inside ? "inside" : "outside"}`;
  const echo = !storm
    ? DASH
    : storm.echoTopFt !== null
      ? versusFreezing(storm.echoTopFt, storm.freezingFt)
      : storm.modelEchoTopFt !== null
        ? `${versusFreezing(storm.modelEchoTopFt, storm.freezingFt)} (model)`
        : DASH;
  const top =
    !storm || storm.goesTopC === null
      ? DASH
      : storm.goesTopDeltaC === null
        ? `${tenths.format(storm.goesTopC)} °C`
        : `${tenths.format(storm.goesTopC)} °C · ${signedC(storm.goesTopDeltaC)}`;

  return [
    { label: "Distance to Storm Edge", value: edge },
    { label: "Storm Motion", value: motion },
    { label: "Tallest 18 dBZ Echo Top", value: echo },
    { label: "Coldest Cloud Top", value: top },
    {
      label: "Lightning Flashes",
      value: !storm || storm.glmFlashes === null ? DASH : `${storm.glmFlashes}`,
    },
  ];
}

/**
 * The cloud over the clicked cell: its base above the ground, what the
 * satellite sees at its top, and the liquid in it.
 *
 * Phase is the satellite's classification of the top of whatever deck it can
 * see, which under multi-layer cloud is the highest one and not necessarily the
 * storm underneath.
 */
export function cloudRows(
  cell: CellReading | null | undefined,
  column: ColumnReading | null | undefined
): Row[] {
  const d = column?.diagnostics;
  return [
    {
      label: "Base Above Ground",
      value: known(cell?.cloudBaseAglFt)
        ? `${feet(cell.cloudBaseAglFt)} AGL`
        : DASH,
    },
    {
      label: "Cloud-Top Temperature",
      value: known(cell?.cloudTopC) ? `${tenths.format(cell.cloudTopC)} °C` : DASH,
    },
    {
      label: "Cloud-Top Phase",
      value: cell?.topPhase ? (PHASE_LABELS[cell.topPhase] ?? DASH) : DASH,
    },
    {
      label: "Supercooled Liquid Water",
      value: known(cell?.slwGM2) ? `${num.format(cell.slwGM2)} g/m²` : DASH,
    },
    {
      label: "Vertically Integrated Liquid",
      value: d ? `${num.format(d.vilKgM2)} kg/m²` : DASH,
    },
  ];
}

/**
 * The air around the cloud: the temperature levels, where a parcel condenses,
 * and how unstable the column is.
 *
 * The CCL is the click's, the same height the cloud base names when it
 * answered, so the two cannot disagree on one panel.
 */
export function environmentRows(
  cell: CellReading | null | undefined,
  column: ColumnReading | null | undefined
): Row[] {
  const d = column?.diagnostics;
  const energy = (value: number | undefined) =>
    known(value) ? `${num.format(value)} J/kg` : DASH;
  const band =
    column && known(column.bandBaseFt) && known(column.bandTopFt)
      ? `${whole.format(column.bandBaseFt)}–${feet(column.bandTopFt)} MSL`
      : DASH;

  return [
    { label: "Ground Elevation", value: msl(column?.surfaceFt) },
    { label: "Freezing Level", value: msl(column?.freezingFt) },
    {
      label: "−15 °C Level",
      value: column ? msl(heightAtC(column.levels, -15)) : DASH,
    },
    { label: "Seeding Band (−5 to −12 °C)", value: band },
    { label: "LCL", value: msl(d?.lclFt) },
    { label: "CCL", value: msl(cell?.cclFt) },
    { label: "Mixed-Layer CAPE", value: energy(d?.mixedCapeJKg) },
    { label: "Surface-Based CAPE", value: energy(d?.capeJKg) },
    { label: "Mixed-Layer CIN", value: energy(d?.cinJKg) },
  ];
}
