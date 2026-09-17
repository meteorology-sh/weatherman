import reducer, { replayActions } from "@/lib/store/features/replay";

const initial = reducer(undefined, { type: "@@init" });

const STATS = {
  cloudTop: { validTime: "2025-05-15T18:01:17.900Z" },
  liquid: { run: "2025-05-15T18:00:00.000Z" },
  radar: { validTime: "2025-05-15T17:59:00.000Z" },
} as unknown as Parameters<typeof replayActions.setReady>[0]["stats"];

describe("replay slice", () => {
  it("opens with no hour chosen", () => {
    // The page is a blank slate on purpose: a default date would put a date on
    // screen nobody picked, and a default of "now" makes it a second live map.
    expect(initial.at).toBe(null);
  });

  // The candidate map opens on the Texas fly fill and nothing else, so this
  // one does too: every reading that feeds the fill is asked for, including
  // the modeled liquid.
  it("opens on the fly fill alone, like the candidate map", () => {
    expect(initial.field).toBe(true);
    expect(initial.radar).toBe(false);
    expect(initial.lightning).toBe(false);
    expect(initial.heading).toBe(false);
    expect(initial.echoFreeze).toBe(false);
    expect(initial.liquid).toBe(false);
    expect(initial.cloudBase).toBe(false);
  });

  // The switch only appears while a warning is in force, and then it is on.
  it("draws warnings by default and can switch them off", () => {
    expect(initial.warnings).toBe(true);
    expect(reducer(initial, replayActions.setWarnings(false)).warnings).toBe(
      false
    );
  });

  it("stores the chosen hour as an ISO string", () => {
    const state = reducer(
      initial,
      replayActions.setAt("2025-05-15T18:00:00.000Z")
    );
    expect(state.at).toBe("2025-05-15T18:00:00.000Z");
  });

  it("keeps the store serializable — no Date ever enters it", () => {
    const state = reducer(
      initial,
      replayActions.setAt("2025-05-15T18:00:00.000Z")
    );
    expect(typeof state.at).toBe("string");
  });

  it("clears back to live", () => {
    const chosen = reducer(
      initial,
      replayActions.setAt("2025-05-15T18:00:00.000Z")
    );
    expect(reducer(chosen, replayActions.setAt(null)).at).toBe(null);
  });

  it("has nothing drawable until every source has answered", () => {
    expect(initial.ready).toBe(null);
  });

  // Picking a date must blank the map: the previous hour stops being drawable
  // the moment a new one is asked for, rather than lingering under a date that
  // no longer matches it.
  it("clears what was drawable when a new hour is asked for", () => {
    let state = reducer(
      initial,
      replayActions.setAt("2025-05-15T18:00:00.000Z")
    );
    state = reducer(
      state,
      replayActions.setReady({
        at: "2025-05-15T18:00:00.000Z",
        stats: STATS,
      })
    );
    expect(state.ready).toBe("2025-05-15T18:00:00.000Z");

    state = reducer(state, replayActions.setAt("2025-05-16T18:00:00.000Z"));
    expect(state.ready).toBe(null);
    expect(state.stats).toBe(null);
  });

  it("drops a stale error when a new hour is asked for", () => {
    let state = reducer(initial, replayActions.setError("boom"));
    state = reducer(state, replayActions.setAt("2025-05-15T18:00:00.000Z"));
    expect(state.error).toBe(null);
  });

  it("toggles each layer independently", () => {
    let state = reducer(initial, replayActions.setLiquid(true));
    expect(state.liquid).toBe(true);
    expect(state.radar).toBe(false);

    state = reducer(state, replayActions.setRadar(true));
    expect(state.radar).toBe(true);
    expect(state.liquid).toBe(true);

    state = reducer(state, replayActions.setLightning(true));
    expect(state.lightning).toBe(true);
    expect(state.radar).toBe(true);

    state = reducer(state, replayActions.setLiquid(false));
    expect(state.liquid).toBe(false);
    expect(state.radar).toBe(true);
    expect(state.lightning).toBe(true);

    state = reducer(state, replayActions.setCloudBase(true));
    expect(state.cloudBase).toBe(true);
    expect(state.liquid).toBe(false);
    expect(state.radar).toBe(true);
  });
});
