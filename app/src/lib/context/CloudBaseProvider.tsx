// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";

// Client
import { GetCloudBaseStats } from "@/lib/client";

/** The analysis hour, matching the layer the candidate map draws. */
const ANALYSIS_HOUR = 0;

/**
 * Loads the cloud-base field's summary.
 *
 * Page-scoped, and it warms the build every wrfsfc diagnostic comes out of —
 * the same one the sounding's C1/C5/C7 attributes are read from. So a click on
 * the map after the page has settled is answered from cache rather than paying
 * for a second decode of the same file.
 */
export function CloudBaseProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.cloudbase.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(cloudBaseActions.setLoading(true));
        const stats = await GetCloudBaseStats(ANALYSIS_HOUR);
        dispatch(cloudBaseActions.setStats(stats));
      } catch (error) {
        dispatch(
          cloudBaseActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(cloudBaseActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
