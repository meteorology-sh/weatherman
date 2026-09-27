// Store
import reducer, { forecastActions } from "@/lib/store/features/forecast";

// Types
import type { ForecastMeta } from "@/lib/types";

const meta: ForecastMeta = {
  run: "2026-07-17T00:00:00.000Z",
  hours: [0, 1, 2, 3],
};

const initial = () => reducer(undefined, { type: "@@INIT" });

describe("forecast slice", () => {
  it("starts with no metadata", () => {
    expect(initial().meta).toBeUndefined();
  });

  it("starts on the analysis hour", () => {
    expect(initial().hour).toBe(0);
  });

  it("starts idle and unerrored", () => {
    expect(initial().loading).toBe(false);
    expect(initial().error).toBe(null);
    expect(initial().drawing).toBe(false);
  });

  it("starts with precipitation drawn", () => {
    expect(initial().precip).toBe(true);
  });

  // Cloud and rain are what this map is; the seeding band is a reading taken
  // on it, and each hour of it is its own build on the server.
  it("starts with the supercooled liquid off", () => {
    expect(initial().liquid).toBe(false);
  });

  it("turns the supercooled liquid on", () => {
    const state = reducer(initial(), forecastActions.setLiquid(true));

    expect(state.liquid).toBe(true);
  });

  it("leaves the forecast hour alone when the liquid toggles", () => {
    const moved = reducer(initial(), forecastActions.setHour(9));
    const state = reducer(moved, forecastActions.setLiquid(true));

    expect(state.hour).toBe(9);
  });

  it("stores the run metadata", () => {
    const state = reducer(initial(), forecastActions.setMeta(meta));

    expect(state.meta).toEqual(meta);
  });

  it("moves the forecast hour", () => {
    const state = reducer(initial(), forecastActions.setHour(12));

    expect(state.hour).toBe(12);
  });

  it("turns precipitation off", () => {
    const state = reducer(initial(), forecastActions.setPrecip(false));

    expect(state.precip).toBe(false);
  });

  it("leaves the forecast hour alone when precipitation toggles", () => {
    const moved = reducer(initial(), forecastActions.setHour(9));
    const state = reducer(moved, forecastActions.setPrecip(false));

    expect(state.hour).toBe(9);
  });

  it("tracks the loading flag", () => {
    const state = reducer(initial(), forecastActions.setLoading(true));

    expect(state.loading).toBe(true);
  });

  it("tracks the drawing flag independently of loading", () => {
    const state = reducer(initial(), forecastActions.setDrawing(true));

    expect(state.drawing).toBe(true);
    expect(state.loading).toBe(false);
  });

  it("records an error", () => {
    const state = reducer(initial(), forecastActions.setError("boom"));

    expect(state.error).toBe("boom");
  });

  it("clears an error", () => {
    const errored = reducer(initial(), forecastActions.setError("boom"));
    const state = reducer(errored, forecastActions.setError(null));

    expect(state.error).toBe(null);
  });
});
