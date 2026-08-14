// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { seedabilityActions } from "@/lib/store/features/seedability";

// Client
import { GetCandidateStats } from "@/lib/client";

/**
 * Loads the candidate field's summary.
 *
 * Page-scoped, like the other three panels on the candidate map. Asking for the
 * summary builds the same cached join the geometry route serves, so the layer's
 * own fetch is answered from a warm server — the join waits on five sources and
 * a cold one is the slowest of them, not the sum.
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
        dispatch(seedabilityActions.setLoading(true));
        dispatch(seedabilityActions.setStats(await GetCandidateStats()));
      } catch (error) {
        dispatch(
          seedabilityActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(seedabilityActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
