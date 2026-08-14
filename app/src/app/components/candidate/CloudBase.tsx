// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { BASE_WINDOW_LABEL } from "@/lib/arcgis/legends";

const ft = new Intl.NumberFormat("en-US");

/**
 * What the cloud-base layer reports.
 *
 * The two figures an operator acts on are how much of the domain has a cloud
 * base at all and how much of it sits in the window Texas practice selects in.
 * The gap between them is the point of the layer: most cloudy ground has a base
 * far too high to be a convective target, and until now the map could not say
 * so at all.
 */
export const CloudBase = () => {
  const stats = useAppSelector((state) => state.cloudbase.stats);
  const visible = useAppSelector((state) => state.cloudbase.visible);
  const loading = useAppSelector((state) => state.cloudbase.loading);
  const error = useAppSelector((state) => state.cloudbase.error);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Reading the model's cloud base…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!stats) return null;

  return (
    <div className="p-4 flex flex-col gap-2">
      <h3 className="font-semibold">CLOUD BASE</h3>

      {stats.basePct === 0 ? (
        <div className="text-sm">
          The model has no cloud anywhere in the domain.
        </div>
      ) : (
        <>
          <div className="text-sm">
            A cloud base over <strong>{stats.basePct}%</strong> of the domain,{" "}
            <strong>{stats.windowPct}%</strong> of it inside the{" "}
            {BASE_WINDOW_LABEL} window.
          </div>
          <div className="text-sm">
            {ft.format(stats.windowKm2)} km² in the window
            {stats.medianFt !== null && (
              <> &middot; median base {ft.format(stats.medianFt)} ft MSL</>
            )}
          </div>
          <div className="text-xs">
            The rest is mostly the base of a high deck with clear air under it —
            a base, but not one a turret grows from.
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
