// React
import { useEffect } from "react";

// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { dayActions } from "~/lib/store/features/day";

// Client
import { GetDay, GetDays, GetPainted, NotRunYet } from "~/lib/client";

/**
 * Loads the day list once, and one day's detail whenever the date changes.
 *
 * The painted frames are fetched with the day rather than on demand. They are
 * the point of the page, and a second click to reveal the thing the page exists
 * for is a click nobody should have to make.
 */
export function DayProvider({ children }: { children: React.ReactNode }) {
  const days = useAppSelector((state) => state.day.days);
  const date = useAppSelector((state) => state.day.date);
  const day = useAppSelector((state) => state.day.day);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(dayActions.setDays(await GetDays()));
      } catch (error) {
        dispatch(
          dayActions.setError(
            error instanceof Error ? error.message : "Failed to load days"
          )
        );
      }
    }

    if (!days) load();
  }, [days, dispatch]);

  useEffect(() => {
    async function load(on: string) {
      try {
        dispatch(dayActions.setLoading(true));
        dispatch(dayActions.setDay(await GetDay(on)));

        try {
          dispatch(dayActions.setPainted(await GetPainted(on)));
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

    if (date && !day) load(date);
  }, [date, day, dispatch]);

  return <>{children}</>;
}
