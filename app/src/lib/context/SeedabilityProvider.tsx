// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { seedabilityActions } from "@/lib/store/features/seedability";

// Client
import { CandidateBuild, GetCandidateStats } from "@/lib/client";

/**
 * Names the build the candidate layers open on.
 *
 * The layers fetch their geometry from the server once and hold it. Nothing in
 * that geometry says which build produced it — a `GeoJSONLayer` keeps the
 * features and drops everything around them — so the map cannot tell on its own
 * whether what it is drawing is still current. This asks the summary route,
 * which answers off the same cached build the layers are fetching from, and
 * puts that build's name in the store as the one on screen.
 *
 * Asking also warms the server: a cold join is five parallel builds and the
 * layers land in milliseconds behind it rather than paying for it themselves.
 * That is the same reason `CandidateProvider` asks for the liquid summary on
 * landing.
 *
 * The stats request and the layers' own requests are two calls, so in principle
 * a build can roll between them. In practice they leave together and the server
 * caches for two minutes, and the first click corrects it either way — this
 * establishes what is on screen, and `CandidatePointProvider` is what keeps it
 * honest.
 */
export function SeedabilityProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const drawn = useAppSelector((state) => state.seedability.drawn);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        const stats = await GetCandidateStats();
        dispatch(
          seedabilityActions.setDrawn(
            CandidateBuild({ ...stats, phaseTime: stats.phase.sceneTime })
          )
        );
      } catch {
        // Nothing to report. The panel's own readout raises a failed join, and
        // a page that cannot name its build still draws — it just cannot tell
        // that the build has rolled until a click names one.
      }
    }

    if (drawn === null) load();
  }, [drawn, dispatch]);

  return <>{children}</>;
}
