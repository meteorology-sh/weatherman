// Store
import { useAppSelector } from "@/lib/store/hooks";

// Readout
import { radarRows, SECTIONS } from "@/lib/readout";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

/**
 * The nearest radar storm to the click, and the readings taken over it.
 *
 * Texas seeds the flank, so a short distance inside the rain is the reading
 * being looked for.
 */
export const StormHere = () => {
  const here = useAppSelector((state) => state.storms.here);
  const loading = useAppSelector((state) => state.storms.hereLoading);
  const error = useAppSelector((state) => state.storms.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (here === undefined) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{SECTIONS.radar}</h3>
      <MeasurementGrid
        rows={
          here === null
            ? [{ label: "Storm", value: "None Within 40 km" }]
            : radarRows(here)
        }
      />
    </div>
  );
};
