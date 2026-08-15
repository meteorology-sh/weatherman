// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { CandidateLegend } from "@/lib/arcgis/legends";

// Components
import { Rejections } from "@/app/components/panel/Rejections";
import { PhaseCheck } from "@/app/components/panel/PhaseCheck";

const km2 = new Intl.NumberFormat("en-US");
const ft = new Intl.NumberFormat("en-US");

/**
 * The candidate field over the whole domain, at the analysis hour.
 *
 * The clicked point above says whether to fly to one cloud. This says what the
 * hour looks like everywhere: how much ground passed, what each test threw
 * away, and what the satellite makes of what survived. Both are needed — an
 * empty map is a bug report unless the panel can name the test that emptied it,
 * and that accounting was reachable only through the replay page until now.
 *
 * It reads the live slice, never the replay one. The two carry the same shape
 * for different hours, and sharing one would put a replayed date's numbers
 * under a map drawn from this hour.
 */
export const Field = () => {
  const stats = useAppSelector((state) => state.seedability.stats);
  const loading = useAppSelector((state) => state.seedability.statsLoading);
  const error = useAppSelector((state) => state.seedability.statsError);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="loading loading-spinner loading-sm"></span>
        Joining every source…
      </div>
    );
  }

  if (error) return <div className="text-error text-sm">{error}</div>;
  if (!stats) return null;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{CandidateLegend.name}</h3>

      {stats.coveragePct === 0 ? (
        <div className="text-sm">
          No ground in the domain passed every test at this hour.
        </div>
      ) : (
        <>
          <div className="text-sm">
            <strong>{km2.format(stats.candidateKm2)} km²</strong> passed every
            test &middot; richest cell {km2.format(stats.peak)} g/m².
          </div>
          {stats.medianBandBaseFt !== null && (
            <div className="text-sm">
              Band base {ft.format(stats.medianBandBaseFt)} ft MSL &middot;{" "}
              {stats.reachablePct}% below an {ft.format(stats.ceilingFt)} ft
              ceiling
            </div>
          )}
        </>
      )}

      <Rejections stats={stats} />
      <PhaseCheck stats={stats} />
    </div>
  );
};
