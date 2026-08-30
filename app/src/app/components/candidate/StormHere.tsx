// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { SLW_BANDS } from "@/lib/arcgis/bands";
import { LiquidLegend, StormLegend } from "@/lib/arcgis/legends";

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

const km = (value: number) => `${num.format(value)} km`;

/**
 * The radar storm at the clicked point.
 *
 * The map draws the same facts: a dot at the heaviest rain, a line at the
 * edge of the rain. Age and motion wait until consecutive scans are kept.
 */
export const StormHere = () => {
  const here = useAppSelector((state) => state.storms.here);
  const loading = useAppSelector((state) => state.storms.hereLoading);
  const error = useAppSelector((state) => state.storms.hereError);
  const column = useAppSelector((state) => state.seedability.here);

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
        <h3 className="font-semibold">{StormLegend.name}</h3>
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
    : here.inside
      ? nearerEdge
        ? `You clicked inside the rain, ${km(here.edgeKm)} from the edge and ${km(here.coreKm)} from the heaviest rain (the dot). Crews seed near the edge, not in the heaviest rain.`
        : `You clicked inside the rain, ${km(here.coreKm)} from the heaviest rain (the dot) and ${km(here.edgeKm)} from the edge. That is nearer the core than the place crews fly.`
      : `You clicked outside the rain, ${km(here.edgeKm)} from the edge.`;

  const liquid =
    column === undefined
      ? null
      : column.slwGM2 >= SLW_BANDS[0].value
        ? `The model puts ${num.format(column.slwGM2)} g/m² of supercooled liquid in the seeding band over this point.`
        : `The model puts no supercooled liquid in the seeding band over this point (under ${SLW_BANDS[0].value} g/m²).`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{StormLegend.name}</h3>
      <div className="text-sm">{place}</div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span>Heaviest rain in this storm</span>
        <span>{storm.maxDbz} dBZ</span>
        <span>Area of the rain</span>
        <span>{num.format(storm.areaKm2)} km²</span>
      </div>
      {liquid !== null && (
        <div className="text-xs">
          {liquid} That is {LiquidLegend.name}, not a test that hides the
          storm.
        </div>
      )}
    </div>
  );
};
