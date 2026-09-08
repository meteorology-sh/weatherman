// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { replayActions } from "@/lib/store/features/replay";

// Client
import {
  GetCandidateStats,
  GetCloudBaseStats,
  GetCloudTopStats,
  GetLiquidStats,
  GetRadarStats,
  GetTargetStats,
} from "@/lib/client";

/**
 * Warms every source for the chosen hour, then releases the map to draw.
 *
 * The summaries are not fetched to be displayed — though they are, in the
 * panel. They are fetched because **asking for a summary builds the same cached
 * scene the geometry route serves**, and the server collapses concurrent
 * requests for one build onto one download. So awaiting the stats is awaiting
 * the builds, and by the time they resolve the geometry the layers want is
 * already sitting in the server's cache.
 *
 * That is what makes the layers appear together. Pointed straight at the
 * geometry routes they arrive minutes apart on a cold hour, and the map spends
 * that minute showing a mix of two dates.
 *
 * The guard is on `ready` rather than on mount, because like `SoundingProvider`
 * this one is meant to re-run: `setAt` clears `ready`, and that is what makes
 * picking a new date fetch a new hour.
 */
export function ReplayProvider({ children }: { children: React.ReactNode }) {
  const at = useAppSelector((state) => state.replay.at);
  const ready = useAppSelector((state) => state.replay.ready);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (at === null || ready !== null) return;

    // The hour this effect was started for. If the operator picks another date
    // while a ~40 s build is in flight, the late answer must not be published
    // under the newer date — it would caption one hour's scenes with another's.
    let current = true;

    async function load(hour: string) {
      try {
        dispatch(replayActions.setLoading(true));
        dispatch(replayActions.setError(null));

        const [cloudBase, cloudTop, liquid, radar, field, target] =
          await Promise.all([
            // Hour 0 throughout — the analysis of the cycle being replayed,
            // matching the candidate map's reading of "the sky at this moment".
            GetCloudBaseStats(hour),
            GetCloudTopStats(hour),
            GetLiquidStats(0, hour),
            GetRadarStats(hour),
            // The join reads the layers above, so this warms nothing they do not
            // — but it is the slowest, and the gate has to include it or the map
            // would draw its inputs and wait on the answer.
            GetCandidateStats(hour),
            GetTargetStats(hour),
          ]);

        if (!current) return;
        dispatch(
          replayActions.setReady({
            at: hour,
            stats: { cloudBase, cloudTop, liquid, radar, field, target },
          })
        );
      } catch (error) {
        if (!current) return;
        dispatch(
          replayActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        if (current) dispatch(replayActions.setLoading(false));
      }
    }

    load(at);

    return () => {
      current = false;
    };
  }, [at, ready, dispatch]);

  return <>{children}</>;
}
