import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Store
import { soundingActions } from "./sounding";

// Types
import type { CandidatePoint, CandidateStats } from "@/lib/types";

type SeedabilityState = {
  /**
   * The candidate field — every layer joined into one.
   *
   * Its own slice rather than a field on `candidate`: that one covers the
   * supercooled-liquid layer, and this one carries the join.
   */
  visible: boolean;
  /**
   * The join read over the clicked cell, and the only reading of the join the
   * panel carries. One cell, so it fits in the store; a summary of the whole
   * domain would be a statement about the country rather than about the cloud
   * an operator is looking at.
   */
  here: CandidatePoint | undefined;
  hereLoading: boolean;
  hereError: string | null;
  /**
   * The whole domain's summary of the same build.
   *
   * It answers a different question from `here` — what the hour looks like
   * everywhere, rather than what is over one cell — and the panel needs both:
   * the point says whether to fly to *that* cloud, and this says what the join
   * threw away and what the satellite makes of what it kept. The replay page
   * has carried it since the join shipped; the live map has to as well, or the
   * page that says "right now" is the one with the least on it.
   */
  stats: CandidateStats | undefined;
  statsLoading: boolean;
  statsError: string | null;
};

/**
 * **The only layer on by default.** This is the answer the map exists to give,
 * so the map opens on it alone: every input to it starts off, and the operator
 * switches on the ones they want to check the answer against.
 */
const initialState: SeedabilityState = {
  visible: true,
  here: undefined,
  hereLoading: false,
  hereError: null,
  stats: undefined,
  statsLoading: false,
  statsError: null,
};

const seedabilitySlice = createSlice({
  name: "seedability",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
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
    setStats(state, action: PayloadAction<CandidateStats>) {
      state.stats = action.payload;
    },
    setStatsLoading(state, action: PayloadAction<boolean>) {
      state.statsLoading = action.payload;
    },
    setStatsError(state, action: PayloadAction<string | null>) {
      state.statsError = action.payload;
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
