// Redux
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Types
import type { Day, DaySummary, Painted } from "~/lib/types";

/**
 * The day being looked at, and what has been built for it.
 *
 * **The painted frames are held here and the geometry is not drawn from here.**
 * A frame is megabytes of rings and the store deep-walks its state on every
 * dispatch, so what lives here is the parsed file the map reads once, and the
 * selection around it. Nothing dispatches per ring.
 */
type DayState = {
  /** Which region the loaded days belong to. Changing it clears everything. */
  region: string | null;
  days: DaySummary[] | null;
  date: string | null;
  day: Day | null;
  painted: Painted | null;
  loading: boolean;
  missing: string | null;
  error: string | null;
};

const initialState: DayState = {
  region: null,
  days: null,
  date: null,
  day: null,
  painted: null,
  loading: false,
  missing: null,
  error: null,
};

const daySlice = createSlice({
  name: "day",
  initialState,
  reducers: {
    /** Switching programme drops the other one's season entirely. */
    setRegion(state, action: PayloadAction<string>) {
      if (state.region === action.payload) return;
      state.region = action.payload;
      state.days = null;
      state.date = null;
      state.day = null;
      state.painted = null;
      state.missing = null;
      state.error = null;
    },
    setDays(state, action: PayloadAction<DaySummary[]>) {
      state.days = action.payload;
    },
    /** Picking a day clears what was loaded for the last one. */
    setDate(state, action: PayloadAction<string | null>) {
      state.date = action.payload;
      state.day = null;
      state.painted = null;
      state.missing = null;
      state.error = null;
    },
    setDay(state, action: PayloadAction<Day>) {
      state.day = action.payload;
    },
    setPainted(state, action: PayloadAction<Painted | null>) {
      state.painted = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
      if (action.payload) {
        state.error = null;
        state.missing = null;
      }
    },
    setMissing(state, action: PayloadAction<string>) {
      state.missing = action.payload;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
  },
});

export const dayActions = daySlice.actions;
export default daySlice.reducer;
