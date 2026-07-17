// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

// Client
import { GetForecastMeta } from "@/lib/client";

export function ForecastProvider({ children }: { children: React.ReactNode }) {
  const meta = useAppSelector((state) => state.forecast.meta);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(forecastActions.setLoading(true));
        const meta = await GetForecastMeta();

        dispatch(forecastActions.setMeta(meta));
      } catch (error) {
        dispatch(
          forecastActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(forecastActions.setLoading(false));
      }
    }

    if (!meta) {
      load();
    }
  }, [meta, dispatch]);

  return <>{children}</>;
}
