import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { RadarStats } from "@/lib/types";

type RadarState = {
  /**
   * Observed reflectivity on the candidate map.
   *
   * On by default: this is the object an operator flies, and the map should
   * open on rain plus the liquid join, so the two answers can disagree in view.
   */
  visible: boolean;
  /** Summary of the scene. The contours themselves never enter the store. */
  stats: RadarStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: RadarState = {
  visible: true,
  stats: undefined,
  loading: false,
  error: null,
};

const radarSlice = createSlice({
  name: "radar",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setStats(state, action: PayloadAction<RadarStats>) {
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

export const radarActions = radarSlice.actions;
export default radarSlice.reducer;
