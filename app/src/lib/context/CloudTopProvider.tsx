// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cloudTopActions } from "@/lib/store/features/cloudtop";

// Client
import { GetCloudTopStats } from "@/lib/client";

/**
 * Loads the cloud-top scene's summary.
 *
 * Page-scoped, like RadarProvider — but the cold build here is the slowest on
 * the map. The satellite scene is only 4 MB; what costs is the HRRR profile
 * grid it needs to turn cloud-top pressure into a temperature (~35 s the first
 * time a run is touched, then free). The GeoJSONLayer triggers the same build,
 * so asking here on entering the map warms the cache the bands come out of
 * rather than racing it.
 */
export function CloudTopProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.cloudtop.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(cloudTopActions.setLoading(true));
        const stats = await GetCloudTopStats();
        dispatch(cloudTopActions.setStats(stats));
      } catch (error) {
        dispatch(
          cloudTopActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(cloudTopActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
