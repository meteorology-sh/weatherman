import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { CloudBaseStats } from "@/lib/types";

type CloudBaseState = {
  /**
   * HRRR cloud base on the candidate map.
   *
   * **Off by default**, unlike the other three. It is the newest claim on a map
   * whose editorial line is that its layers are read against each other, and a
   * fourth fill switched on by default would land on top of the three an
   * operator already reads without being asked for.
   */
  visible: boolean;
  /** Summary of the field. The bands themselves never enter the store. */
  stats: CloudBaseStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: CloudBaseState = {
  visible: false,
  stats: undefined,
  loading: false,
  error: null,
};

const cloudBaseSlice = createSlice({
  name: "cloudbase",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setStats(state, action: PayloadAction<CloudBaseStats>) {
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

export const cloudBaseActions = cloudBaseSlice.actions;
export default cloudBaseSlice.reducer;
