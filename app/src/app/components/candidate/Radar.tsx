// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { RADAR_BANDS } from "@/lib/arcgis/bands";

const km2 = new Intl.NumberFormat("en-US");

const utc = (iso: string) =>
  new Date(iso).toISOString().slice(0, 16).replace("T", " ");

/** Whole minutes between a scene and now, floored at zero. */
const minutesOld = (iso: string) =>
  Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

/**
 * What the radar layer reports.
 *
 * How much ground is precipitating and how hard the worst of it is. **An empty
 * layer is not a report of clear air**: the radars do not cover the whole map,
 * and where they are not looking there is nothing to report. That distinction
 * is made over the cell an operator clicks, where it changes a decision, rather
 * than as a share of the country.
 */
export const Radar = () => {
  const stats = useAppSelector((state) => state.radar.stats);
  const visible = useAppSelector((state) => state.radar.visible);
  const loading = useAppSelector((state) => state.radar.loading);
  const error = useAppSelector((state) => state.radar.error);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Reading the radar mosaic…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!stats) return null;

  const age = minutesOld(stats.validTime);

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">RADAR REFLECTIVITY</h3>

      {stats.echoKm2 === 0 ? (
        <div className="alert alert-info alert-soft p-2 text-xs">
          <span>
            Nothing over {RADAR_BANDS[0].value} dBZ anywhere the radars are
            looking. Nothing is disqualified by rain right now.
          </span>
        </div>
      ) : (
        <div className="stats stats-vertical bg-base-200">
          <div className="stat py-2">
            <div className="stat-title">Precipitating ground</div>
            <div className="stat-value text-lg">
              {km2.format(stats.echoKm2)} km²
            </div>
            <div className="stat-desc">
              over {RADAR_BANDS[0].value} dBZ, where a radar is looking
            </div>
          </div>
          <div className="stat py-2">
            <div className="stat-title">Strongest cell</div>
            <div className="stat-value text-lg">{stats.peakDbz} dBZ</div>
            <div className="stat-desc">
              {stats.peakDbz !== null &&
              stats.peakDbz >= RADAR_BANDS[RADAR_BANDS.length - 1].value
                ? "Intense — hail is likely in it"
                : "Below the intense threshold"}
            </div>
          </div>
        </div>
      )}

      {/* Not every cell has a radar over it, so "no echo" is not always a
          report of clear air. Which of the two a cell is only matters over the
          cell being looked at, and the point readout answers it there. */}
      <div className="text-xs">
        A quiet cell is either clear air or ground no radar covers. Click it to
        see which.
      </div>

      <div className="text-xs">
        MRMS scene {utc(stats.validTime)}Z &middot; {age} min old
      </div>
    </div>
  );
};
