// Store
import { useAppSelector } from "@/lib/store/hooks";

// Readout
import { decisionRows, flies, payloadLabel, REASON } from "@/lib/readout";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";
import { latLon } from "@/lib/format";

/**
 * FLY or DON'T FLY on this 3 km cell, and the tests that made the call.
 *
 * The reason is printed on DON'T FLY only. On FLY every test passed and there
 * is nothing to name.
 */
export const FlyHere = () => {
  const here = useAppSelector((state) => state.seedability.here);
  const [lon, lat] = useAppSelector((state) => state.sounding.point);
  const loading = useAppSelector((state) => state.seedability.hereLoading);
  const error = useAppSelector((state) => state.seedability.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (!here) return null;

  const fly = flies(here);
  const payload = payloadLabel(here);
  const rows = decisionRows(here).filter(
    (row) => !fly || row.label !== REASON
  );

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center justify-between gap-2 font-semibold">
        {fly ? (
          <span className="badge badge-sm badge-outline badge-success">
            FLY
          </span>
        ) : (
          <span className="badge badge-sm badge-outline badge-warning">
            DON'T FLY
          </span>
        )}
        {payload && (
          <span className="badge badge-sm badge-outline badge-info">
            {payload}
          </span>
        )}
        <span className="ml-auto font-mono text-xs font-normal">
          {latLon(lon, lat)}
        </span>
      </h3>
      <MeasurementGrid rows={rows} />
    </div>
  );
};
