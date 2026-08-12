import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { RadarStats } from "@/lib/types";

type RadarState = {
  /**
   * Observed reflectivity on the candidate map. On by default: the question it
   * answers — is this candidate already precipitating — is a disqualifier, and
   * a disqualifier the operator has to remember to switch on is not one.
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
