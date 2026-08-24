import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { CloudTopStats } from "@/lib/types";

type CloudTopState = {
  /**
   * Observed cloud tops on the candidate map.
   *
   * Off on arrival, like every layer but the candidate field. It is the widest
   * fill on the map — it says where there is cloud at all — so switched on by
   * default it is the one most likely to bury the answer drawn over it.
   */
  visible: boolean;
  /** Summary of the scene. The bands themselves never enter the store. */
  stats: CloudTopStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: CloudTopState = {
  visible: false,
  stats: undefined,
  loading: false,
  error: null,
};

const cloudTopSlice = createSlice({
  name: "cloudtop",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setStats(state, action: PayloadAction<CloudTopStats>) {
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

export const cloudTopActions = cloudTopSlice.actions;
export default cloudTopSlice.reducer;
