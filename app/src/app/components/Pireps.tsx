// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { BAND_LABEL } from "@/lib/arcgis/renderers";

const utc = (iso: string) =>
  new Date(iso).toISOString().slice(0, 16).replace("T", " ");

/**
 * What the icing reports amount to.
 *
 * Every number here is a fraction on purpose. "3 icing reports" reads as a
 * national icing map; "3 of 412 PIREPs in 12 h, 1 of them in the seeding band"
 * reads as what it is — spot confirmation from wherever aircraft happened to be.
 * The denominator is the honesty.
 */
export const Pireps = () => {
  const stats = useAppSelector((state) => state.pirep.stats);
  const visible = useAppSelector((state) => state.pirep.visible);
  const loading = useAppSelector((state) => state.pirep.loading);
  const error = useAppSelector((state) => state.pirep.error);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Reading pilot reports…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!stats) return null;

  if (stats.positive === 0) {
    return (
      <div className="flex flex-col gap-2">
        <div className="alert alert-info alert-soft p-2 text-xs">
          <span>
            No aircraft has reported icing anywhere over the country in the last{" "}
            {stats.windowHours} h. That is normal — it is not evidence there is
            none.
          </span>
        </div>
        <div className="text-xs opacity-60">
          {stats.reports} PIREPs filed &middot; pulled {utc(stats.fetchedAt)}Z
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="stats stats-vertical bg-base-200">
        <div className="stat py-2">
          <div className="stat-title">Aircraft that met ice</div>
          <div className="stat-value text-lg">
            {stats.positive} of {stats.reports}
          </div>
          <div className="stat-desc">
            PIREPs filed over the country in {stats.windowHours} h
            {stats.icing > stats.positive &&
              ` · ${stats.icing - stats.positive} reported none`}
          </div>
        </div>
        <div className="stat py-2">
          <div className="stat-title">In the seeding band</div>
          <div className="stat-value text-lg">{stats.inBand}</div>
          <div className="stat-desc">
            {stats.inBand > 0
              ? `Confirmed liquid water at ${BAND_LABEL}`
              : "The rest iced up outside the band worth seeding"}
          </div>
        </div>
        {stats.latest && (
          <div className="stat py-2">
            <div className="stat-title">Most recent</div>
            <div className="stat-value text-lg">{utc(stats.latest)}Z</div>
            <div className="stat-desc">Click a marker for the filed report</div>
          </div>
        )}
      </div>

      <div className="text-xs opacity-60">
        NOAA Aviation Weather Center &middot; pulled {utc(stats.fetchedAt)}Z
      </div>
    </div>
  );
};
