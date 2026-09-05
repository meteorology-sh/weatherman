// Redux
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Types
import type { BandFinding, NearFinding, StormFinding } from "~/lib/types";

/**
 * The findings, and whether their runs have produced them yet.
 *
 * `missing` is not `error`. A run that has not happened is an ordinary state
 * with a command that fixes it, and the page says which command; a server that
 * is down is a fault. Collapsing the two is what made the previous version of
 * this app unreadable — a cold start and a failure looked identical.
 *
 * `region` names whose findings these are, and it is set the moment a load
 * starts rather than when it finishes. That is what lets the provider guard on
 * it: a second render while the first fetch is still out must not start another.
 */
type FindingsState = {
  region: string | null;
  band: BandFinding | null;
  near: NearFinding | null;
  storms: StormFinding | null;
  loading: boolean;
  missing: string | null;
  error: string | null;
};

const initialState: FindingsState = {
  region: null,
  band: null,
  near: null,
  storms: null,
  loading: false,
  missing: null,
  error: null,
};

const findingsSlice = createSlice({
  name: "findings",
  initialState,
  reducers: {
    /** Starts a load, and claims the region so nothing else starts one. */
    setLoading(state, action: PayloadAction<string>) {
      state.region = action.payload;
      state.loading = true;
      state.band = null;
      state.near = null;
      state.storms = null;
      state.error = null;
      state.missing = null;
    },
    setLoaded(state, action: PayloadAction<string>) {
      if (state.region === action.payload) state.loading = false;
    },
    setBand(state, action: PayloadAction<BandFinding>) {
      state.band = action.payload;
    },
    setNear(state, action: PayloadAction<NearFinding>) {
      state.near = action.payload;
    },
    setStorms(state, action: PayloadAction<StormFinding>) {
      state.storms = action.payload;
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
