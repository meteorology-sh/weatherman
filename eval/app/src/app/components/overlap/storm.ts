// ArcGIS
import { SLW_BANDS } from "@/lib/arcgis/bands";

// Types
import type { StormAtFlare } from "~/lib/types";

// Components
import { type Tone } from "./distance";

/**
 * How a yes, a no and a missing reading are colored.
 *
 * Shared by every place that prints a pass or a fail, so FLY on the readout
 * table and a green cell anywhere else are the same green.
 */
export const MATCH: Tone = {
  fill: "fill-success",
  stroke: "stroke-success",
  text: "text-success",
  label: "Yes",
};
export const MISS: Tone = {
  fill: "fill-error",
  stroke: "stroke-error",
  text: "text-error",
  label: "No",
};
export const NEUTRAL: Tone = {
  fill: "fill-base-content",
  stroke: "stroke-base-content",
  text: "text-base-content",
  label: "No reading",
};

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const feet = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ft`;

function echoVersusFreezing(storm: StormAtFlare): string {
  const top = storm.echoTopFt;
  const freeze = storm.freezingFt;
  if (top === null) {
    if (storm.modelEchoTopFt === null) return "no 18 dBZ echo top";
    if (freeze === null) {
      return `modeled echo top ${feet(storm.modelEchoTopFt)} MSL; column never crosses freezing`;
    }
    return storm.modelEchoTopFt >= freeze
      ? `modeled echo top ${feet(storm.modelEchoTopFt - freeze)} above freezing`
      : `modeled echo top ${feet(freeze - storm.modelEchoTopFt)} below freezing`;
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
 * One-line facts about the storm a release sat in, for the map's hover.
 *
 * The storm is context for a release on the map, not a score of its own: the
 * page answers with the fly fill, and these lines say what the rain under that
 * flare was doing. Missing fields stay out rather than printing "null".
 */
export function stormLines(storm: StormAtFlare): string[] {
  const lines: string[] = [];
  if (!storm.object) {
    lines.push("No rain at 20 dBZ within about 40 km.");
    return lines;
  }
  if (storm.inside && storm.edgeKm !== null && storm.coreKm !== null) {
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
