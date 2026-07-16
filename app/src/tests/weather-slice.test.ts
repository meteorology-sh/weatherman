// Store
import weatherReducer, { weatherActions } from "@/lib/store/features/weather";

// Types
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import type { CloudCoverPoint } from "@/lib/types";

const points: CloudCoverPoint[] = [
  { lat: 40, lon: -100, cloudCover: 75, time: "2026-07-16T06:15" },
];

const initialState = weatherReducer(undefined, { type: "@@INIT" });

describe("weather reducer", () => {
  it("starts with no points, not loading, and no error", () => {
    expect(initialState.CloudPoints).toBeUndefined();
    expect(initialState.loading).toBe(false);
    expect(initialState.error).toBeNull();
  });

  it("stores the cloud layer", () => {
    const layer = { id: "cloud-layer" } as unknown as GeoJSONLayer;

    const state = weatherReducer(initialState, weatherActions.CloudLayer(layer));

    expect(state.CloudLayer).toBe(layer);
  });

  it("stores the cloud points", () => {
    const state = weatherReducer(
      initialState,
      weatherActions.CloudPoints(points)
    );

    expect(state.CloudPoints).toEqual(points);
  });

  it("sets the loading flag", () => {
    const state = weatherReducer(initialState, weatherActions.setLoading(true));

    expect(state.loading).toBe(true);
  });

  it("clears the loading flag", () => {
    const loading = weatherReducer(
      initialState,
      weatherActions.setLoading(true)
    );

    const state = weatherReducer(loading, weatherActions.setLoading(false));

    expect(state.loading).toBe(false);
  });

  it("sets the error message", () => {
    const state = weatherReducer(
      initialState,
      weatherActions.setError("Failed to fetch cloud cover: 502")
    );

    expect(state.error).toBe("Failed to fetch cloud cover: 502");
  });

  it("clears the error message", () => {
    const failed = weatherReducer(
      initialState,
      weatherActions.setError("Failed to fetch cloud cover: 502")
    );

    const state = weatherReducer(failed, weatherActions.setError(null));

    expect(state.error).toBeNull();
  });

  it("leaves the points in place when only the error changes", () => {
    const loaded = weatherReducer(
      initialState,
      weatherActions.CloudPoints(points)
    );

    const state = weatherReducer(loaded, weatherActions.setError("stale feed"));

    expect(state.CloudPoints).toEqual(points);
  });
});
