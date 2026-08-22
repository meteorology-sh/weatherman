// React
import { useEffect } from "react";

// Router
import { useParams } from "react-router";

// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

// Client
import { GetDay, GetDays, GetPainted, NotRunYet } from "~/lib/client";

/**
 * Loads a region's day list, and one day's detail whenever the date changes.
 *
 * The painted frames are fetched with the day rather than on demand. They are
 * the point of the page, and a second click to reveal the thing the page exists
 * for is a click nobody should have to make.
 */
export function DayProvider({ children }: { children: React.ReactNode }) {
  const { region } = useParams();
  const loaded = useAppSelector((state) => state.day.region);
  const days = useAppSelector((state) => state.day.days);
  const date = useAppSelector((state) => state.day.date);
  const day = useAppSelector((state) => state.day.day);
  const dispatch = useAppDispatch();

  useEffect(() => {
    if (region) dispatch(dayActions.setRegion(region));
  }, [region, dispatch]);

  /**
   * The day list, refetched every time the page is opened.
   *
   * **Not guarded on `days` being empty**, and that is the point: which days are
   * painted changes whenever `paint.mjs` runs, and a list cached from before a
   * run shows the day that was built as though it were the only one there is.
   * The route is opened rarely and the answer is a local file, so paying for it
   * each time is cheaper than being wrong about what exists.
   */
  useEffect(() => {
    let cancelled = false;

    async function load(on: string) {
      try {
        const fresh = await GetDays(on);
        if (!cancelled) dispatch(dayActions.setDays(fresh));
      } catch (error) {
        if (cancelled) return;
        dispatch(
          dayActions.setError(
            error instanceof Error ? error.message : "Failed to load days"
          )
        );
      }
    }

    if (region && loaded === region) load(region);
    return () => {
      cancelled = true;
    };
  }, [region, loaded, dispatch]);

  /**
   * Open on a painted day rather than on nothing.
   *
   * The page exists to show a map, and landing on an empty one with a control
   * the reader has to find first buries the thing they came for. Which day is
   * arbitrary, so it is the first — the picker in the chrome makes the rest
   * visible and one click away.
   */
  useEffect(() => {
    if (date || !days) return;
    const painted = days.filter((entry) => entry.painted);
    if (painted.length) dispatch(dayActions.setDate(painted[0].date));
  }, [days, date, dispatch]);

  useEffect(() => {
    async function load(on: string, at: string) {
      try {
        dispatch(dayActions.setLoading(true));
        dispatch(dayActions.setDay(await GetDay(on, at)));

        try {
          dispatch(dayActions.setPainted(await GetPainted(on, at)));
        } catch (error) {
          // Not painted yet is an ordinary state with a command that fixes it.
          if (!(error instanceof NotRunYet)) throw error;
          dispatch(dayActions.setPainted(null));
          dispatch(dayActions.setMissing(error.message));
        }
      } catch (error) {
        dispatch(
          dayActions.setError(
            error instanceof Error ? error.message : "Failed to load the day"
          )
        );
      } finally {
        dispatch(dayActions.setLoading(false));
      }
    }

    if (region && loaded === region && date && !day) load(region, date);
  }, [region, loaded, date, day, dispatch]);

  return <>{children}</>;
}
