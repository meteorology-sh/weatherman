// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { CLOUD_TOP_WARMEST_C } from "@/lib/arcgis/legends";

const km2 = new Intl.NumberFormat("en-US");

const utc = (iso: string) =>
  new Date(iso).toISOString().slice(0, 16).replace("T", " ");

/** Whole minutes between a scene and now, floored at zero. */
const minutesOld = (iso: string) =>
  Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));

/**
 * What the cloud-top layer reports.
 *
 * How much cloud has a top cold enough for the seeding band to be inside it,
 * and how cold the coldest is. The rest of the sky is shallow warm cloud this
 * layer throws away, and it is usually most of it. The top over one point is
 * `CloudHere`.
 *
 * It names **both** sources, which no other panel here has to do. This layer is
 * a claim assembled from two: the satellite says where the top is, HRRR says
 * how cold it is there. An operator reading "coldest top −54 °C" should be able
 * to see that the shape was observed minutes ago and the temperature came from
 * a model run that may be an hour old.
 */
export const CloudTop = () => {
  const stats = useAppSelector((state) => state.cloudtop.stats);
  const visible = useAppSelector((state) => state.cloudtop.visible);
  const loading = useAppSelector((state) => state.cloudtop.loading);
  const error = useAppSelector((state) => state.cloudtop.error);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Reading the satellite scene…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!stats) return null;

  const age = minutesOld(stats.validTime);

  return (
    <div className="p-4 flex flex-col gap-2">
      <h3 className="font-semibold">CLOUD TOPS</h3>

      {stats.cloudPct === 0 ? (
        <div className="text-sm">
          The satellite sees no cloud anywhere in the domain.
        </div>
      ) : (
        <>
          <div className="text-sm">
            {km2.format(stats.seedableKm2)} km² of cloud with a top at{" "}
            {CLOUD_TOP_WARMEST_C} °C or colder
            {stats.coldestTopC !== null && (
              <> &middot; coldest {stats.coldestTopC} °C</>
            )}
          </div>
          <div className="text-xs">
            The rest is cloud too warm to hold the seeding band — its top is
            above {CLOUD_TOP_WARMEST_C} °C, so the band sits over open sky.
          </div>
        </>
      )}

      <div className="text-xs">
        Scanned {utc(stats.validTime)}Z &middot;{" "}
        {age === 0 ? "under a minute" : `${age} min`} old
      </div>
      <div className="text-xs">
        Shape observed by GOES-East; temperatures from the HRRR run at{" "}
        {utc(stats.profileRun)}Z.
      </div>
    </div>
  );
};
