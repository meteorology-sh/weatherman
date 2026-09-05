// ArcGIS
import { SLW_BANDS } from "@/lib/arcgis/bands";
// Types
import type { Flare, StormAtFlare } from "~/lib/types";

// Components
import { type Tone } from "./distance";
import { STORM_COLUMNS, stormCells, toneOf } from "./storm";

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const feet = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ft`;

function echoVersusFreezing(storm: StormAtFlare): string {
  const top = storm.echoTopFt;
  const freeze = storm.freezingFt;
  if (top === null) {
    if (storm.modelEchoTopFt === null) return "no 18 dBZ echo top";
    if (freeze === null) {
      return `modelled echo top ${feet(storm.modelEchoTopFt)} MSL; column never crosses freezing`;
    }
    return storm.modelEchoTopFt >= freeze
      ? `modelled echo top ${feet(storm.modelEchoTopFt - freeze)} above freezing`
      : `modelled echo top ${feet(freeze - storm.modelEchoTopFt)} below freezing`;
  }
  if (freeze === null) {
    return `18 dBZ echo top ${feet(top)} MSL; column never crosses freezing`;
  }
  return top >= freeze
    ? `${feet(top - freeze)} above freezing`
    : `${feet(freeze - top)} below freezing`;
}

function grewLabel(storm: StormAtFlare): string {
  const d = storm.object?.areaDeltaKm2;
  if (d == null) return "—";
  if (d > 0.5) return `grew ${num.format(d)} km²`;
  if (d < -0.5) return `shrank ${num.format(-d)} km²`;
  return "unchanged";
}

/**
 * One-line facts about the storm a release sat in, for the hover.
 * Missing fields stay out rather than printing "null".
 */
export function stormLines(storm: StormAtFlare): string[] {
  const lines: string[] = [];
  if (!storm.object) {
    lines.push("No rain at 20 dBZ within about 40 km.");
    return lines;
  }
  if (
    storm.inside &&
    storm.inWorking &&
    storm.edgeKm !== null &&
    storm.coreKm !== null
  ) {
    lines.push(
      `Inside the rain, on the upwind side, ${num.format(storm.edgeKm)} km from the edge and ${num.format(storm.coreKm)} km from the heaviest rain.`
    );
  } else if (storm.inside && storm.edgeKm !== null && storm.coreKm !== null) {
    lines.push(
      storm.edgeKm < storm.coreKm
        ? `Inside the rain, ${num.format(storm.edgeKm)} km from the edge and ${num.format(storm.coreKm)} km from the heaviest rain.`
        : `Inside the rain, ${num.format(storm.coreKm)} km from the heaviest rain and ${num.format(storm.edgeKm)} km from the edge.`
    );
  } else if (storm.edgeKm !== null) {
    lines.push(
      `Outside the rain, ${num.format(storm.edgeKm)} km from the edge.`
    );
  }
  lines.push(echoVersusFreezing(storm));
  if (storm.object.ageMin !== null) {
    lines.push(
      storm.object.ageFloor
        ? `Rain on the mosaic for at least ${storm.object.ageMin} min`
        : `Rain on the mosaic for ${storm.object.ageMin} min`
    );
  }
  if (storm.object.areaDeltaKm2 !== null) {
    lines.push(grewLabel(storm));
  }
  if (storm.glmFlashes !== null) {
    lines.push(
      storm.glmFlashes === 0
        ? "No lightning over this storm in five minutes"
        : `${storm.glmFlashes} lightning ${storm.glmFlashes === 1 ? "flash" : "flashes"} in five minutes`
    );
  }
  if (storm.goesTopC !== null) {
    const delta = storm.goesTopDeltaC;
    lines.push(
      delta === null
        ? `Cloud top ${num.format(storm.goesTopC)} °C`
        : delta < -0.5
          ? `Cloud top ${num.format(storm.goesTopC)} °C, ${num.format(-delta)} °C colder than five minutes ago`
          : delta > 0.5
            ? `Cloud top ${num.format(storm.goesTopC)} °C, ${num.format(delta)} °C warmer than five minutes ago`
            : `Cloud top ${num.format(storm.goesTopC)} °C, unchanged from five minutes ago`
    );
  }
  if (storm.slwGM2 !== null) {
    lines.push(
      storm.slwGM2 >= SLW_BANDS[0].value
        ? `Model puts ${num.format(storm.slwGM2)} g/m² of supercooled liquid in the seeding band over this storm`
        : `Model puts no supercooled liquid in the seeding band over this storm (under ${SLW_BANDS[0].value} g/m²)`
    );
  }
  return lines;
}

type PropsT = { flares: Flare[] };

function Cell({ tone, children }: { tone: Tone; children: string }) {
  return (
    <td className={`text-right font-mono whitespace-nowrap ${tone.text}`}>
      {children}
    </td>
  );
}

export const StormReadings = ({ flares }: PropsT) => {
  const rows = [...flares].sort((a, b) => a.at.localeCompare(b.at));
  const scored = rows.filter((flare) => "storm" in flare).length;

  if (!rows.length) {
    return <p className="text-sm">No located releases this day.</p>;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-4 text-xs items-center">
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-success" />
          Yes
        </span>
        <span className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 bg-error" />
          No
        </span>
      </div>

      {scored < rows.length && (
        <p className="text-sm">
          {scored} of {rows.length} releases have a storm reading. A dash is
          a flare painted before those readings were stored —{" "}
          <span className="font-mono">node eval/fill-storms.mjs</span> on
          this day's file fills it.
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Time</th>
              <th>County</th>
              {STORM_COLUMNS.map((column) => (
                <th
                  key={column.key}
                  className="text-right whitespace-normal"
                >
                  {column.heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((flare) => {
              const cols = stormCells(flare);
              return (
                <tr key={flare.at}>
                  <td className="font-mono whitespace-nowrap">
                    {flare.timeZ}Z
                  </td>
                  <td>{flare.county}</td>
                  {cols.map((col, i) => (
                    <Cell key={STORM_COLUMNS[i].key} tone={toneOf(col.ok)}>
                      {col.label}
                    </Cell>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
