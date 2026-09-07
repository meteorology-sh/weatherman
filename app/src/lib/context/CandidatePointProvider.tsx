// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { seedabilityActions } from "@/lib/store/features/seedability";

// Client
import { CandidateBuild, GetCandidatePoint } from "@/lib/client";

/**
 * Reads the join over the selected point, and reads it again when the point
 * moves.
 *
 * The same shape as `SoundingProvider`, and for the same reason: the guard is
 * on the data rather than on first mount, because clicking the map clears the
 * data and that is what makes the click fetch. It answers off the join the map
 * is already drawing, so a click costs one cached read rather than a build.
 *
 * It waits for a click, unlike the sounding. The readout is about the cell an
 * operator picked, and the center of the country is not one — reading it would
 * fill the panel with an answer about nowhere in particular.
 *
 * **A click is also what catches the map being out of date.** The answer names
 * the build it came off, so if the server has rebuilt since the layers fetched,
 * this is where that is noticed: the new build goes into the store and the map
 * follows it. Reporting a cell against one build while drawing another is how
 * a readout ends up contradicting the ground under the cursor.
 */
export function CandidatePointProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const point = useAppSelector((state) => state.sounding.point);
  const clicked = useAppSelector((state) => state.sounding.clicked);
  const here = useAppSelector((state) => state.seedability.here);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(seedabilityActions.setHereLoading(true));
        const here = await GetCandidatePoint(point[0], point[1]);
        // Null is the answer for a point outside the model's grid. Nothing to
        // report and nothing to apologise for, so the panel stays as it was
        // rather than being handed an error about a click off the edge.
        if (here) {
          dispatch(seedabilityActions.setHere(here));
          dispatch(seedabilityActions.setDrawn(CandidateBuild(here)));
        }
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

    if (clicked && !here) load();
  }, [point, clicked, here, dispatch]);

  return <>{children}</>;
}
