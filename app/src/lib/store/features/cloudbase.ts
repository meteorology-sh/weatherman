import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { CloudBaseStats } from "@/lib/types";

type CloudBaseState = {
  /**
   * HRRR cloud base on the candidate map.
   *
   * Off on arrival. The map opens on storms; this is a reading, not the mask.
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
