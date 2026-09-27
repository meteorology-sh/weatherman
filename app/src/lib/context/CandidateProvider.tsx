// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { candidateActions } from "@/lib/store/features/candidate";

// Client
import { GetLiquidStats } from "@/lib/client";

/**
 * Loads the candidate map's supercooled-liquid summary.
 *
 * App-wide rather than page-scoped, and that is the point: integrating CLWMR
 * over the seeding band is a ~30 s build on the server (a scout pass to find the
 * band, then ~34 GRIB records), and the stats and the contours come from one
 * cached build. Asking for the stats on landing means the server is already
 * warm by the time the operator opens the map, so the geometry arrives in
 * milliseconds instead of half a minute.
 */
export function CandidateProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.candidate.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(candidateActions.setLoading(true));
        // Hour 0 — the analysis. The candidate map is "right now".
        const stats = await GetLiquidStats(0);
        dispatch(candidateActions.setStats(stats));
      } catch (error) {
        dispatch(
          candidateActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(candidateActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
