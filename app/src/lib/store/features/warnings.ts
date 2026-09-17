import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { WarningStats } from "@/lib/types";

type WarningsState = {
  /**
   * The warning polygons on the candidate map. On by default: the switch only
   * exists while a warning is in force, and then it is the first thing an
   * operator needs to see.
   */
  visible: boolean;
  /** How many warnings are in force. The polygons never enter the store. */
  stats: WarningStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: WarningsState = {
  visible: true,
  stats: undefined,
  loading: false,
  error: null,
};

const warningsSlice = createSlice({
  name: "warnings",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setStats(state, action: PayloadAction<WarningStats>) {
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

export const warningsActions = warningsSlice.actions;
export default warningsSlice.reducer;
