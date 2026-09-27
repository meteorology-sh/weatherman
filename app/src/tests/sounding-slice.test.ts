// Store
import reducer, {
  soundingActions,
  DEFAULT_POINT,
} from "@/lib/store/features/sounding";

// Testing
import { noDiagnostics } from "./utils";

// Types
import type { Sounding } from "@/lib/types";

const sounding: Sounding = {
  run: "2026-08-12T04:00:00.000Z",
  hour: 0,
  validTime: "2026-08-12T04:00:00.000Z",
  lat: 39.8,
  lon: -98.54,
  surfaceFt: 1830,
  cclFt: null,
  freezingFt: 16433,
  bandBaseFt: 18685,
  bandTopFt: 22066,
  baseC: 34.9,
  topC: -18.1,
  levels: [{ mb: 550, tempC: -1.32, heightFt: 16966 }],
  diagnostics: noDiagnostics,
};

const initial = reducer(undefined, { type: "@@INIT" });

describe("sounding slice", () => {
  // Read on arrival to warm the national profile grid every later click is
  // answered from, not to fill the panel.
  it("starts on the center of the map", () => {
    expect(initial.point).toEqual(DEFAULT_POINT);
  });

  it("starts with no profile and no error", () => {
    expect(initial.data).toBeUndefined();
    expect(initial.error).toBeNull();
    expect(initial.loading).toBe(false);
  });

  it("moves the point", () => {
    const state = reducer(initial, soundingActions.setPoint([-104.99, 39.74]));

    expect(state.point).toEqual([-104.99, 39.74]);
  });

  // The default point is somewhere, so the column is worth reading over it.
  // The join's readout is headed "cloud over this point" and waits for a real
  // one, and this flag is how it tells the two apart.
  it("records that the point came from a click", () => {
    expect(initial.clicked).toBe(false);

    expect(
      reducer(initial, soundingActions.setPoint([-104.99, 39.74])).clicked
    ).toBe(true);
  });

  // The old column is about somewhere else. Leaving it on screen under new
  // coordinates would be the wrong answer, confidently labeled.
  it("drops the old profile when the point moves", () => {
    const loaded = reducer(initial, soundingActions.setData(sounding));

    const moved = reducer(loaded, soundingActions.setPoint([-104.99, 39.74]));

    expect(moved.data).toBeUndefined();
  });

  it("clears a stale error when the point moves", () => {
    const failed = reducer(initial, soundingActions.setError("boom"));

    expect(
      reducer(failed, soundingActions.setPoint([-105, 40])).error
    ).toBeNull();
  });

  it("stores the profile", () => {
    expect(reducer(initial, soundingActions.setData(sounding)).data).toEqual(
      sounding
    );
  });

  it("tracks loading", () => {
    expect(reducer(initial, soundingActions.setLoading(true)).loading).toBe(
      true
    );
  });

  it("stores an error", () => {
    const state = reducer(
      initial,
      soundingActions.setError("Failed to fetch the sounding: 500")
    );

    expect(state.error).toBe("Failed to fetch the sounding: 500");
  });
});
