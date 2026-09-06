import reducer, { briefingActions } from "@/lib/store/features/briefing";

const initial = reducer(undefined, { type: "@@INIT" });

describe("briefing reducer", () => {
  it("starts with every 12Z field off", () => {
    expect(initial.cape).toBe(false);
    expect(initial.cin).toBe(false);
    expect(initial.lcl).toBe(false);
    expect(initial.freezing).toBe(false);
    expect(initial.minus15).toBe(false);
    expect(initial.warmDepth).toBe(false);
  });

  it("toggles mixed-layer CAPE without touching CIN", () => {
    const state = reducer(initial, briefingActions.setCape(true));

    expect(state.cape).toBe(true);
    expect(state.cin).toBe(false);
  });
});
