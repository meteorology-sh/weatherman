import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { SlwStats } from "@/lib/types";

type CandidateState = {
  /**
   * HRRR supercooled liquid water contours, drawn over the observed cloud tops.
   *
   * Cloud tops have their own slice: this one covers a single data domain, and
   * anything that fetches and summarises a scene of its own gets its own.
   */
  liquid: boolean;
  /** Summary of the liquid layer. The geometry itself never enters the store. */
  stats: SlwStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: CandidateState = {
  liquid: true,
  stats: undefined,
  loading: false,
  error: null,
};

const candidateSlice = createSlice({
  name: "candidate",
  initialState,
  reducers: {
    setLiquid(state, action: PayloadAction<boolean>) {
      state.liquid = action.payload;
    },
    setStats(state, action: PayloadAction<SlwStats>) {
      state.stats = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const candidateActions = candidateSlice.actions;
export default candidateSlice.reducer;
