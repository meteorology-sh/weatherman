// React
import { useEffect } from "react";

// Router
import { useParams } from "react-router";

// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { findingsActions } from "~/lib/store/features/findings";
import { regionsActions } from "~/lib/store/features/regions";

// Client
import { GetBand, GetNear, NotRunYet } from "~/lib/client";

/**
 * Loads the region's findings and syncs them into the store.
 *
 * The band comparison and the season-wide layer distances are independent runs,
 * so a missing one is recorded and the other still loads. Only a real failure
 * sets `error`.
 *
 * It wraps the region's routes, so navigating to another program unmounts it
 * and the next one loads from scratch. The region comes from the url rather than
 * a prop for the same reason: the address is what selects the dataset.
 */
export function FindingsProvider({ children }: { children: React.ReactNode }) {
  const { region } = useParams();
  const loaded = useAppSelector((state) => state.findings.region);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (!region) return;
    dispatch(regionsActions.setActive(region));

    async function load(on: string) {
      try {
        dispatch(findingsActions.setLoading(on));

        const [bandResult, nearResult] = await Promise.allSettled([
          GetBand(on),
          GetNear(on),
        ]);

        const missing: string[] = [];
        for (const result of [bandResult, nearResult]) {
          if (result.status === "fulfilled") continue;
          if (result.reason instanceof NotRunYet) {
            missing.push(result.reason.message);
          } else {
            throw result.reason;
          }
        }

        if (bandResult.status === "fulfilled") {
          dispatch(findingsActions.setBand(bandResult.value));
        }
        if (nearResult.status === "fulfilled") {
          dispatch(findingsActions.setNear(nearResult.value));
        }
        if (missing.length) {
          dispatch(findingsActions.setMissing(missing.join(" · ")));
        }
      } catch (error) {
        dispatch(
          findingsActions.setError(
            error instanceof Error ? error.message : "Failed to load findings"
          )
        );
      } finally {
        dispatch(findingsActions.setLoaded(on));
      }
    }

    // guard: StrictMode double-invokes effects, and a region already loaded
    // should not be fetched again on every render.
    if (loaded !== region) load(region);
  }, [region, loaded, dispatch]);

  return <>{children}</>;
}
