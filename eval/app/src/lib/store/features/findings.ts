// Redux
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Types
import type { BandFinding, OverlapFinding } from "~/lib/types";

/**
 * The two findings, and whether the harness has produced them yet.
 *
 * `missing` is not `error`. A run that has not happened is an ordinary state
 * with a command that fixes it, and the page says which command; a server that
 * is down is a fault. Collapsing the two is what made the previous version of
 * this app unreadable — a cold start and a failure looked identical.
 */
type FindingsState = {
  band: BandFinding | null;
  overlap: OverlapFinding | null;
  loading: boolean;
  missing: string | null;
  error: string | null;
};

const initialState: FindingsState = {
  band: null,
  overlap: null,
  loading: false,
  missing: null,
  error: null,
};

const findingsSlice = createSlice({
  name: "findings",
  initialState,
  reducers: {
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
        state.missing = null;
      }
    },
    setBand(state, action: PayloadAction<BandFinding>) {
      state.band = action.payload;
    },
    setOverlap(state, action: PayloadAction<OverlapFinding>) {
      state.overlap = action.payload;
    },
    setMissing(state, action: PayloadAction<string>) {
      state.missing = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
  },
});

export const findingsActions = findingsSlice.actions;
export default findingsSlice.reducer;
