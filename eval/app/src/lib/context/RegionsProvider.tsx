// React
import { useEffect } from "react";

// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { regionsActions } from "~/lib/store/features/regions";

// Client
import { GetRegions } from "~/lib/client";

/**
 * Loads the program list once, app-wide.
 *
 * It wraps the router rather than a route, because the navigation bar names the
 * region and needs it on every page — including the list itself, which is what
 * the app opens on.
 */
export function RegionsProvider({ children }: { children: React.ReactNode }) {
  const all = useAppSelector((state) => state.regions.all);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(regionsActions.setLoading(true));
        dispatch(regionsActions.setAll(await GetRegions()));
      } catch (error) {
        dispatch(
          regionsActions.setError(
            error instanceof Error ? error.message : "Failed to load regions"
          )
        );
      } finally {
        dispatch(regionsActions.setLoading(false));
      }
    }

    if (!all) load();
  }, [all, dispatch]);

  return <>{children}</>;
}
