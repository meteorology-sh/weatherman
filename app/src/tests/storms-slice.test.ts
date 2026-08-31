import reducer, { stormsActions } from "@/lib/store/features/storms";
import { soundingActions } from "@/lib/store/features/sounding";

const initial = reducer(undefined, { type: "@@init" });

describe("storms slice", () => {
  it("clears the clicked storm when the point moves", () => {
    const filled = reducer(
      initial,
      stormsActions.setHere({
        validTime: "2025-08-11T18:00:00.000Z",
        inside: true,
        coreKm: 1,
        edgeKm: 2,
        upwindEdgeKm: null,
        inWorking: false,
        slwGM2: null,
        goesTopC: null,
        goesTopDeltaC: null,
        echoTopFt: null,
        modelEchoTopFt: null,
        freezingFt: null,
        glmFlashes: null,
        object: {
          id: 1,
          firstSeen: "2025-08-11T18:00:00.000Z",
          nCells: 9,
          areaKm2: 9,
          maxDbz: 35,
          coreLon: -101,
          coreLat: 32,
          centroidLon: -101,
          centroidLat: 32,
          ageMin: null,
          ageFloor: false,
          motionTowardDeg: null,
          motionKmh: null,
          areaDeltaKm2: null,
        },
      })
    );
    const cleared = reducer(
      filled,
      soundingActions.setPoint([-101.4, 32.1])
    );
    expect(cleared.here).toBeUndefined();
  });
});
