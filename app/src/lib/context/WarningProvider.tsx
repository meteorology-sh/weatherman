// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { warningsActions } from "@/lib/store/features/warnings";

// Client
import { GetWarningStats } from "@/lib/client";

/**
 * Loads how many severe weather warnings are in force, which decides whether
 * the candidate map offers the warning layer at all.
 *
 * Page-scoped and read once on entering the map, like RadarProvider.
 */
export function WarningProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.warnings.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(warningsActions.setLoading(true));
        dispatch(warningsActions.setError(null));
        dispatch(warningsActions.setStats(await GetWarningStats()));
      } catch (error) {
        dispatch(
          warningsActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(warningsActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
