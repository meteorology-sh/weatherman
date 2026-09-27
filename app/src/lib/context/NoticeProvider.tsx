// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch } from "@/lib/store/hooks";
import { noticesActions } from "@/lib/store/features/notices";

// Client
import { GetNotices } from "@/lib/client";

/**
 * How often to ask which sources are off their live feed.
 *
 * The services recheck their live files every five minutes, so a minute's poll
 * shows a change within a minute of the server seeing it, for a response of a
 * few bytes.
 */
export const NOTICE_POLL_MS = 60_000;

/**
 * Keeps the sources' notices in the store for as long as the map is open.
 *
 * Polled rather than loaded once like the other providers: a feed can break or
 * recover while the page sits open, and a notice that only arrived on page load
 * would be wrong in both directions.
 */
export function NoticeProvider({ children }: { children: React.ReactNode }) {
  const dispatch = useAppDispatch();

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const items = await GetNotices();
        if (mounted) dispatch(noticesActions.setItems(items));
      } catch {
        // A failed poll keeps what the last one said and tries again on the
        // next tick.
      }
    }

    load();
    const timer = setInterval(load, NOTICE_POLL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [dispatch]);

  return <>{children}</>;
}
