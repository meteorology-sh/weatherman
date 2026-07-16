// Hooks
import { useEffect } from "react";

// Store
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import { weatherActions } from "@/lib/store/features/weather";

// Client
import { GetCloudCover } from "@/lib/client";

export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const points = useAppSelector((state) => state.weather.CloudPoints);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(weatherActions.setLoading(true));
        const points = await GetCloudCover();

        dispatch(weatherActions.CloudPoints(points));
      } catch (error) {
        console.error("Error loading cloud cover:", error);
        dispatch(
          weatherActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
        );
      } finally {
        dispatch(weatherActions.setLoading(false));
      }
    }

    if (!points) {
      load();
    }
  }, [points, dispatch]);

  return <>{children}</>;
}
