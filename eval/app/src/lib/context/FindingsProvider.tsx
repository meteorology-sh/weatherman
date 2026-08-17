// React
import { useEffect } from "react";

// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { findingsActions } from "~/lib/store/features/findings";

// Client
import { GetBand, GetOverlap, NotRunYet } from "~/lib/client";

/**
 * Loads both findings once and syncs them into the store.
 *
 * Either can be missing on its own — the harness runs are independent — so a
 * missing one is recorded and the other still loads. Only a real failure sets
 * `error`.
 */
export function FindingsProvider({ children }: { children: React.ReactNode }) {
  const band = useAppSelector((state) => state.findings.band);
  const overlap = useAppSelector((state) => state.findings.overlap);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(findingsActions.setLoading(true));

        const [bandResult, overlapResult] = await Promise.allSettled([
          GetBand(),
          GetOverlap(),
        ]);

        const missing: string[] = [];
        for (const result of [bandResult, overlapResult]) {
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
        if (overlapResult.status === "fulfilled") {
          dispatch(findingsActions.setOverlap(overlapResult.value));
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
        dispatch(findingsActions.setLoading(false));
      }
    }

    if (!band && !overlap) load(); // guard: StrictMode double-invokes effects
  }, [band, overlap, dispatch]);

  return <>{children}</>;
}
