// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { domainActions } from "@/lib/store/features/domain";

// Client
import { GetDomain } from "@/lib/client";

/**
 * Loads the edge of the model once.
 *
 * No loading flag, and that is deliberate: nothing waits on this. The map draws
 * the line when it arrives, and a click before then is answered by the server
 * exactly as it would be after — the ring only saves the round trip. So there
 * is no state in which the panel should say it is fetching a boundary.
 *
 * The grid is fixed, so the guard is the ring itself and it never refetches.
 */
export function DomainProvider({ children }: { children: React.ReactNode }) {
  const ring = useAppSelector((state) => state.domain.ring);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(domainActions.setRing(await GetDomain()));
      } catch (error) {
        dispatch(
          domainActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      }
    }

    if (!ring) load();
  }, [ring, dispatch]);

  return <>{children}</>;
}
