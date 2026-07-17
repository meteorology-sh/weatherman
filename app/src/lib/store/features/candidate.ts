import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { SlwStats } from "@/lib/types";

type CandidateState = {
  /** GOES Band 13 imagery — the observed cloud tops, drawn under the contours. */
  imagery: boolean;
  /** HRRR supercooled liquid water contours, drawn over the imagery. */
  liquid: boolean;
  /** Summary of the liquid layer. The geometry itself never enters the store. */
  stats: SlwStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: CandidateState = {
  imagery: true,
  liquid: true,
  stats: undefined,
  loading: false,
  error: null,
};

const candidateSlice = createSlice({
  name: "candidate",
  initialState,
  reducers: {
    setImagery(state, action: PayloadAction<boolean>) {
      state.imagery = action.payload;
    },
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
