// Store
import reducer, { seedabilityActions } from "@/lib/store/features/seedability";
import { soundingActions } from "@/lib/store/features/sounding";

// Types
import type { CandidatePoint } from "@/lib/types";

const initial = () => reducer(undefined, { type: "@@INIT" });

describe("seedability slice", () => {
  // The answer the map exists to give, and it covers a fraction of the ground
  // its inputs do, so it does not bury them the way a fourth fill would.
  it("starts visible", () => {
    expect(initial().visible).toBe(true);
  });

  describe("the clicked point", () => {
    const here: CandidatePoint = {
      run: "2025-05-15T18:00:00.000Z",
      validTime: "2025-05-15T18:00:00.000Z",
      sceneTime: "2025-05-15T18:01:17.900Z",
      radarTime: "2025-05-15T18:00:39.000Z",
      lat: 32.05,
      lon: -101.42,
      verdict: "candidate",
      slwGM2: 140,
      cloudBaseFt: 5800,
      cloudTopC: -14,
      dbz: null,
      radarCovered: true,
    };

    it("starts with no point read", () => {
      expect(initial().here).toBeUndefined();
      expect(initial().hereError).toBe(null);
      expect(initial().hereLoading).toBe(false);
    });

    it("takes the point", () => {
      const state = reducer(initial(), seedabilityActions.setHere(here));

      expect(state.here?.verdict).toBe("candidate");
      expect(state.here?.slwGM2).toBe(140);
    });

    it("takes the point without touching the layer's visibility", () => {
      const hidden = reducer(initial(), seedabilityActions.setVisible(false));
      const state = reducer(hidden, seedabilityActions.setHere(here));

      expect(state.visible).toBe(false);
      expect(state.here?.verdict).toBe("candidate");
    });

    // The old cell's answer is about somewhere else. Keeping it under new
    // coordinates would be the wrong answer, confidently labelled — and an
    // undefined point is also what makes the provider fetch the new one.
    it("forgets the point when the click moves", () => {
      const loaded = reducer(initial(), seedabilityActions.setHere(here));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.here).toBeUndefined();
    });

    it("leaves the layer drawn when the click moves", () => {
      const loaded = reducer(initial(), seedabilityActions.setHere(here));
      const moved = reducer(loaded, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.visible).toBe(true);
    });

    it("records loading and error for the point", () => {
      const loading = reducer(
        initial(),
        seedabilityActions.setHereLoading(true)
      );
      expect(loading.hereLoading).toBe(true);

      const failed = reducer(
        loading,
        seedabilityActions.setHereError("no scene")
      );
      expect(failed.hereError).toBe("no scene");
    });

    // A failed read is about the cell that failed. The next click has to be
    // able to clear it, or one dead source leaves an error over every later
    // point.
    it("clears the error when the click moves", () => {
      const failed = reducer(
        initial(),
        seedabilityActions.setHereError("no scene")
      );
      const moved = reducer(failed, soundingActions.setPoint([-99.1, 35.2]));

      expect(moved.hereError).toBe(null);
    });
  });
});
