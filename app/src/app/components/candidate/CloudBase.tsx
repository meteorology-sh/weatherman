// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { CEILING_LABEL } from "@/lib/arcgis/legends";

const ft = new Intl.NumberFormat("en-US");

/**
 * What the cloud-base layer reports.
 *
 * How much cloud sits below the aircraft's ceiling, and how high its base
 * typically is. The ramp says where the climb is short; this says how much
 * ground there is to choose from. The base over one point is `CloudHere`.
 */
export const CloudBase = () => {
  const stats = useAppSelector((state) => state.cloudbase.stats);
  const visible = useAppSelector((state) => state.cloudbase.visible);
  const loading = useAppSelector((state) => state.cloudbase.loading);
  const error = useAppSelector((state) => state.cloudbase.error);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
        Reading the model's cloud base…
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">CLOUD BASE</h3>

      {stats.basePct === 0 ? (
        <div className="text-sm">
          The model has no cloud anywhere in the domain.
        </div>
      ) : (
        <>
          <div className="text-sm">
            {ft.format(stats.reachableKm2)} km² of cloud with a base below the{" "}
            {CEILING_LABEL} ceiling
            {stats.medianFt !== null && (
              <> &middot; median base {ft.format(stats.medianFt)} ft MSL</>
            )}
          </div>
          <div className="text-xs">
            The bottom of the cloud, not the bottom of the seeding band — the
            column reaches seeding temperature higher up.
          </div>
        </>
      )}

      <div className="text-xs">
        Modelled by the HRRR run at{" "}
        {new Date(stats.run).toISOString().slice(0, 16).replace("T", " ")}Z,
        analysis hour.
      </div>
    </div>
  );
};
