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

  useEffect(() => {
    async function load(on: string) {
      try {
        dispatch(dayActions.setDays(await GetDays(on)));
      } catch (error) {
        dispatch(
          dayActions.setError(
            error instanceof Error ? error.message : "Failed to load days"
          )
        );
      }
    }

    if (region && loaded === region && !days) load(region);
  }, [region, loaded, days, dispatch]);

  /**
   * Open on the only painted day, when there is exactly one.
   *
   * The page exists to show a map, and a landing state with a single button that
   * has to be pressed to reveal it is a step with no decision in it. With two or
   * more painted days there is a real choice and it stays with the reader.
   */
  useEffect(() => {
    if (date || !days) return;
    const painted = days.filter((entry) => entry.painted);
    if (painted.length === 1) dispatch(dayActions.setDate(painted[0].date));
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
