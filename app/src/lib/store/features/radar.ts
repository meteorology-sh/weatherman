import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { RadarStats } from "@/lib/types";

type RadarState = {
  /**
   * Observed reflectivity on the candidate map.
   *
   * Off on arrival, like every layer but the candidate field. The question it
   * answers — is this candidate already precipitating — is a disqualifier, but
   * the join has already applied it: a raining cell is one of the reasons the
   * candidate field rejects ground, so the answer layer never offers one. This
   * layer is here to show the operator *where* that happened.
   */
  visible: boolean;
  /** Summary of the scene. The contours themselves never enter the store. */
  stats: RadarStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: RadarState = {
  visible: false,
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
