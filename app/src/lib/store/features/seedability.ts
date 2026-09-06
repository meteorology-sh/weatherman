import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Store
import { soundingActions } from "./sounding";

// Types
import type { CandidatePoint } from "@/lib/types";

type SeedabilityState = {
  /**
   * The candidate field — every layer joined into one.
   *
   * Its own slice rather than a field on `candidate`: that one covers the
   * supercooled-liquid layer, and this one carries the join.
   */
  visible: boolean;
  /**
   * Which build the candidate layers are drawn from, as `CandidateBuild` spells
   * it. Null until the first answer off the server names one.
   *
   * The server rebuilds the join as its sources roll — a new satellite sweep
   * every 5 minutes, a new radar scan every 2 — and the layers fetch their
   * geometry once. Without this the map keeps showing the build it opened on
   * while every click is answered from the current one, and the two contradict
   * each other about a cell: an outline around ground the readout calls frozen,
   * green over a cell the readout says holds nothing to seed.
   *
   * So the build rides in the store and the map follows it. It is a string
   * rather than the times themselves because nothing compares the parts — the
   * only question asked of it is whether it is still the same build.
   */
  drawn: string | null;
  /**
   * The join read over the clicked cell, and the only reading of the join the
   * panel carries. One cell, so it fits in the store; a summary of the whole
   * domain would be a statement about the country rather than about the cloud
   * an operator is looking at.
   */
  here: CandidatePoint | undefined;
  hereLoading: boolean;
  hereError: string | null;
};

/**
 * On arrival. This is the Texas fly fill — where to click, and the only
 * layer the map opens with. Every other switch examines an input to it.
 */
const initialState: SeedabilityState = {
  visible: true,
  drawn: null,
  here: undefined,
  hereLoading: false,
  hereError: null,
};

const seedabilitySlice = createSlice({
  name: "seedability",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setDrawn(state, action: PayloadAction<string>) {
      state.drawn = action.payload;
    },
    setHere(state, action: PayloadAction<CandidatePoint>) {
      state.here = action.payload;
    },
    setHereLoading(state, action: PayloadAction<boolean>) {
      state.hereLoading = action.payload;
    },
    setHereError(state, action: PayloadAction<string | null>) {
      state.hereError = action.payload;
    },
  },
  // Moving the click is what makes the readout fetch, exactly as it is for the
  // sounding: the old cell's answer is about somewhere else, and leaving it on
  // screen under new coordinates would be the wrong answer confidently
  // labelled. The two readouts answer the same click, so they clear on the same
  // action rather than on two that could drift apart.
  extraReducers: (builder) => {
    builder.addCase(soundingActions.setPoint, (state) => {
      state.here = undefined;
      state.hereError = null;
    });
  },
});

export const seedabilityActions = seedabilitySlice.actions;
export default seedabilitySlice.reducer;
