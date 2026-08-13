// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { soundingActions } from "@/lib/store/features/sounding";

// Client
import { GetSounding } from "@/lib/client";

/**
 * Loads the profile over the selected point, and reloads it when the point
 * moves.
 *
 * The guard is on `data` rather than on first mount, because unlike every other
 * provider here this one is meant to re-run: `setPoint` clears the data, which
 * is what makes a click on the map fetch a new column. The first build is ~30 s
 * on the server (26 GRIB records) and every later click is answered from the
 * same cached profile grid in milliseconds — which is why this fires on mount
 * for the default point rather than waiting for a click.
 */
export function SoundingProvider({ children }: { children: React.ReactNode }) {
  const point = useAppSelector((state) => state.sounding.point);
  const data = useAppSelector((state) => state.sounding.data);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(soundingActions.setLoading(true));
        // Hour 0 — the analysis. The candidate map is "right now".
        const sounding = await GetSounding(point[0], point[1], 0);
        dispatch(soundingActions.setData(sounding));
      } catch (error) {
        dispatch(
          soundingActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(soundingActions.setLoading(false));
      }
    }

    if (!data) load();
  }, [point, data, dispatch]);

  return <>{children}</>;
}
