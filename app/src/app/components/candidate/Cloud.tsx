// Store
import { useAppSelector } from "@/lib/store/hooks";

// Readout
import { cloudRows, SECTIONS } from "@/lib/readout";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

/**
 * The cloud over the clicked cell.
 *
 * It is read off the same answer as FLY, which already shows the spinner and
 * the error for that read, so this waits quietly rather than showing either
 * twice.
 */
export const Cloud = () => {
  const here = useAppSelector((state) => state.seedability.here);
  const loading = useAppSelector((state) => state.seedability.hereLoading);
  const error = useAppSelector((state) => state.seedability.hereError);
  const column = useAppSelector((state) => state.sounding.data);

  if (loading || error || !here) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{SECTIONS.cloud}</h3>
      <MeasurementGrid rows={cloudRows(here, column)} />
    </div>
  );
};
