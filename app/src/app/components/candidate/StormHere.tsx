// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { SLW_BANDS } from "@/lib/arcgis/bands";
import { LiquidLegend, RadarLegend } from "@/lib/arcgis/legends";

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const km = (value: number) => `${num.format(value)} km`;
const area = (value: number) => `${num.format(Math.abs(value))} km²`;
const feet = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ft`;

function versusFreezing(
  noun: string,
  top: number,
  freeze: number | null
): string {
  if (freeze === null) {
    return `${noun} is ${feet(top)} MSL over this storm; the column never crosses freezing.`;
  }
  if (top >= freeze) {
    return `${noun} is ${feet(top - freeze)} above the freezing level over this storm.`;
  }
  return `${noun} sits ${feet(freeze - top)} below the freezing level over this storm.`;
}

/** The eight compass points, which is as fine as a 1 km cell deserves. */
const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const compass = (deg: number) => POINTS[Math.round(deg / 45) % 8];

/**
 * The radar storm at the clicked point.
 *
 * The map draws the same facts: the 20 dBZ fill, a dot at the heaviest
 * rain, a white heading tick when motion is known. Inside is inside that
 * fill's smoothed outline. Liquid, the cloud-top change, age, lightning,
 * and the 18 dBZ echo-top are readings on this storm.
 */
export const StormHere = () => {
  const here = useAppSelector((state) => state.storms.here);
  const loading = useAppSelector((state) => state.storms.hereLoading);
  const error = useAppSelector((state) => state.storms.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
        Reading the radar storm over that point…
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (here === undefined) return null;

  if (here === null) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{RadarLegend.name}</h3>
        <span className="text-sm">
          No rain at 20 dBZ within about 40 km of this point.
        </span>
      </div>
    );
  }

  const storm = here.object;
  const nearerEdge = here.edgeKm < here.coreKm;
  const onTheDot = here.inside && here.coreKm < 0.8;
  const place = onTheDot
    ? "You clicked the heaviest rain in this storm (the dot)."
    : here.inWorking
      ? `You clicked inside the rain, on the upwind side, ${km(here.edgeKm)} from the edge and ${km(here.coreKm)} from the heaviest rain (the dot). That is the flank crews fly.`
      : here.inside
        ? nearerEdge
          ? `You clicked inside the rain, ${km(here.edgeKm)} from the edge and ${km(here.coreKm)} from the heaviest rain (the dot). Crews seed near the edge, not in the heaviest rain.`
          : `You clicked inside the rain, ${km(here.coreKm)} from the heaviest rain (the dot) and ${km(here.edgeKm)} from the edge. That is nearer the core than the place crews fly.`
        : `You clicked outside the rain, ${km(here.edgeKm)} from the edge.`;

  const motion =
    storm.motionTowardDeg === null || storm.motionKmh === null
      ? null
      : `Moving toward ${compass(storm.motionTowardDeg)} at ${num.format(storm.motionKmh)} km/h.`;

  const rainChange =
    storm.areaDeltaKm2 === null
      ? null
      : storm.areaDeltaKm2 > 0.5
        ? `The rain covers ${area(storm.areaDeltaKm2)} more than the previous scan.`
        : storm.areaDeltaKm2 < -0.5
          ? `The rain covers ${area(storm.areaDeltaKm2)} less than the previous scan.`
          : "The raining area is unchanged from the previous scan.";

  const age =
    storm.ageMin === null
      ? null
      : storm.ageFloor
        ? `This rain has been on the mosaic for at least ${storm.ageMin} minutes.`
        : `This rain has been on the mosaic for ${storm.ageMin} minutes.`;

  const lightning =
    here.glmFlashes === null
      ? null
      : here.glmFlashes === 0
        ? "No lightning over this storm in the last five minutes."
        : `${here.glmFlashes} lightning ${here.glmFlashes === 1 ? "flash" : "flashes"} over this storm in the last five minutes.`;

  const liquid =
    here.slwGM2 === null
      ? null
      : here.slwGM2 >= SLW_BANDS[0].value
        ? `The model puts ${num.format(here.slwGM2)} g/m² of supercooled liquid in the seeding band over this storm (the highest 3 km cell).`
        : `The model puts no supercooled liquid in the seeding band over this storm (under ${SLW_BANDS[0].value} g/m²).`;

  const top =
    here.goesTopC === null
      ? null
      : here.goesTopDeltaC === null
        ? `The cloud top over this storm is ${num.format(here.goesTopC)} °C.`
        : here.goesTopDeltaC < -0.5
          ? `The cloud top over this storm is ${num.format(here.goesTopC)} °C, ${num.format(-here.goesTopDeltaC)} °C colder than five minutes ago.`
          : here.goesTopDeltaC > 0.5
            ? `The cloud top over this storm is ${num.format(here.goesTopC)} °C, ${num.format(here.goesTopDeltaC)} °C warmer than five minutes ago.`
            : `The cloud top over this storm is ${num.format(here.goesTopC)} °C, unchanged from five minutes ago.`;

  const echo =
    here.echoTopFt !== null
      ? versusFreezing("The 18 dBZ echo top", here.echoTopFt, here.freezingFt)
      : here.modelEchoTopFt === null
        ? "No 18 dBZ echo top over this storm."
        : `No measured 18 dBZ echo top. ${versusFreezing("Modelled echo top", here.modelEchoTopFt, here.freezingFt)}`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{RadarLegend.name}</h3>
      <div className="text-sm">{place}</div>
      {motion !== null && <div className="text-sm">{motion}</div>}
      {age !== null && <div className="text-sm">{age}</div>}
      {rainChange !== null && <div className="text-sm">{rainChange}</div>}
      {lightning !== null && <div className="text-sm">{lightning}</div>}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span>Heaviest rain in this storm</span>
        <span>{storm.maxDbz} dBZ</span>
        <span>Area of the rain</span>
        <span>{area(storm.areaKm2)}</span>
      </div>
      {top !== null && <div className="text-xs">{top}</div>}
      <div className="text-xs">{echo}</div>
      {liquid !== null && (
        <div className="text-xs">
          {liquid} That is {LiquidLegend.name}, not a test that hides the
          storm.
        </div>
      )}
    </div>
  );
};
