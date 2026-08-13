import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { SlwStats } from "@/lib/types";

type CandidateState = {
  /**
   * HRRR supercooled liquid water contours, drawn over the observed cloud tops.
   *
   * The cloud-top layer used to live here too, as `imagery`, back when it was a
   * GOES raster with no data behind it. It fetches and summarises a scene of
   * its own now, so it has its own slice like every other data domain.
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
