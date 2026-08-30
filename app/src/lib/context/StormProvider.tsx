// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { stormsActions } from "@/lib/store/features/storms";

// Client
import { GetStormNear } from "@/lib/client";

/**
 * Reads the radar storm over the selected point, and reads it again when the
 * point moves.
 *
 * Same shape as CandidatePointProvider: the guard is on the data, because
 * clicking clears it. Null is a real answer — no echo in the window — and
 * is stored rather than treated as "not yet loaded".
 */
export function StormProvider({ children }: { children: React.ReactNode }) {
  const point = useAppSelector((state) => state.sounding.point);
  const clicked = useAppSelector((state) => state.sounding.clicked);
  const here = useAppSelector((state) => state.storms.here);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(stormsActions.setHereLoading(true));
        dispatch(stormsActions.setHere(await GetStormNear(point[0], point[1])));
      } catch (error) {
        dispatch(
          stormsActions.setHereError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(stormsActions.setHereLoading(false));
      }
    }

    if (clicked && here === undefined) load();
  }, [point, clicked, here, dispatch]);

  return <>{children}</>;
}
