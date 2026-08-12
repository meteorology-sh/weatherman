// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { radarActions } from "@/lib/store/features/radar";

// Client
import { GetRadarStats } from "@/lib/client";

/**
 * Loads the radar scene's summary.
 *
 * Page-scoped, like PirepProvider. A cold build is ~9 s on the server and the
 * GeoJSONLayer triggers the same one, so asking here on entering the map warms
 * the cache the contours are about to come out of — but there is no reason to
 * pay for it on the landing page, since the scene is stale five minutes later
 * anyway.
 */
export function RadarProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.radar.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(radarActions.setLoading(true));
        const stats = await GetRadarStats();
        dispatch(radarActions.setStats(stats));
      } catch (error) {
        dispatch(
          radarActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(radarActions.setLoading(false));
      }
    }

    if (!stats) load();
  }, [stats, dispatch]);

  return <>{children}</>;
}
