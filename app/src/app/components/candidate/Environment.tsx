// Store
import { useAppSelector } from "@/lib/store/hooks";

// Readout
import { environmentRows, SECTIONS } from "@/lib/readout";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

/**
 * The air around the cloud: temperature levels, condensation levels, and
 * instability, off the modeled column over the click.
 */
export const Environment = () => {
  const column = useAppSelector((state) => state.sounding.data);
  const loading = useAppSelector((state) => state.sounding.loading);
  const error = useAppSelector((state) => state.sounding.error);
  const here = useAppSelector((state) => state.seedability.here);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (!column) return null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{SECTIONS.environment}</h3>
      <MeasurementGrid rows={environmentRows(here, column)} />
    </div>
  );
};
