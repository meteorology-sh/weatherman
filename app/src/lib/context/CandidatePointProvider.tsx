// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { seedabilityActions } from "@/lib/store/features/seedability";

// Client
import { GetCandidatePoint } from "@/lib/client";

/**
 * Reads the join over the selected point, and reads it again when the point
 * moves.
 *
 * The same shape as `SoundingProvider`, and for the same reason: the guard is
 * on the data rather than on first mount, because clicking the map clears the
 * data and that is what makes the click fetch. It answers off the join the map
 * is already drawing, so a click costs one cached read rather than a build.
 */
export function CandidatePointProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const point = useAppSelector((state) => state.sounding.point);
  const here = useAppSelector((state) => state.seedability.here);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(seedabilityActions.setHereLoading(true));
        dispatch(
          seedabilityActions.setHere(
            await GetCandidatePoint(point[0], point[1])
          )
        );
      } catch (error) {
        dispatch(
          seedabilityActions.setHereError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(seedabilityActions.setHereLoading(false));
      }
    }

    if (!here) load();
  }, [point, here, dispatch]);

  return <>{children}</>;
}
