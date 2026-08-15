// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { seedabilityActions } from "@/lib/store/features/seedability";

// Client
import { GetCandidateStats } from "@/lib/client";

/**
 * Loads the candidate field's summary for the live map.
 *
 * Page-scoped rather than app-wide, unlike the liquid-water summary that warms
 * on landing. The join's build is the same one the map's own layer fetches when
 * it loads, so opening this page warms it either way — asking from every other
 * page would only add a slow request to routes that never draw it.
 *
 * No `at`: the join reads an observed cloud top and a satellite cannot
 * forecast, so it exists at the analysis hour alone. The replay page reads the
 * same route with a date through its own provider, and the two summaries stay
 * in separate slices for the reason the layers stay separate instances.
 */
export function SeedabilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const stats = useAppSelector((state) => state.seedability.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(seedabilityActions.setStatsLoading(true));
        dispatch(seedabilityActions.setStats(await GetCandidateStats()));
      } catch (error) {
        dispatch(
          seedabilityActions.setStatsError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(seedabilityActions.setStatsLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
