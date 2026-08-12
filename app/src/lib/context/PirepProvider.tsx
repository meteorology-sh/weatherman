// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { pirepActions } from "@/lib/store/features/pirep";

// Client
import { GetIcingStats } from "@/lib/client";

/**
 * Loads the summary of the icing-PIREP pull.
 *
 * Page-scoped, unlike CandidateProvider: this is a single ~400 KB fetch the
 * server caches for five minutes, so there is nothing to warm up and no reason
 * to pay for it on the landing page. The markers themselves are fetched by the
 * GeoJSONLayer; what comes through here are the counts the sidebar needs to say
 * how much confirmation the map is actually showing.
 */
export function PirepProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.pirep.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(pirepActions.setLoading(true));
        const stats = await GetIcingStats();
        dispatch(pirepActions.setStats(stats));
      } catch (error) {
        dispatch(
          pirepActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(pirepActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
