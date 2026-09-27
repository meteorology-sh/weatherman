import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { RadarStats } from "@/lib/types";

type RadarState = {
  /**
   * Observed reflectivity on the candidate map.
   *
   * On by default: this is the object an operator flies.
   */
  visible: boolean;
  /**
   * GLM flashes on the same layer. Off until asked for, and only drawn
   * while reflectivity is on — lightning without rain is not a map here.
   */
  lightning: boolean;
  /**
   * The core and the heading arrow — the storm as an object rather than as
   * a field. Only drawn while reflectivity is on, and only from one zoom in
   * on Texas, where a core is a mark on a storm you can see.
   */
  heading: boolean;
  /**
   * 18 dBZ top at or above freezing. Off until asked for, and only
   * drawn while reflectivity is on.
   */
  echoFreeze: boolean;
  /** Summary of the scene. The contours themselves never enter the store. */
  stats: RadarStats | undefined;
  loading: boolean;
  error: string | null;
};

/**
 * On arrival, every radar switch is off. The map opens on the fly fill, and
 * the rain is the first thing an operator turns on over it rather than
 * something already drawn under it.
 */
const initialState: RadarState = {
  visible: false,
  lightning: false,
  heading: false,
  echoFreeze: false,
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
    setLightning(state, action: PayloadAction<boolean>) {
      state.lightning = action.payload;
    },
    setHeading(state, action: PayloadAction<boolean>) {
      state.heading = action.payload;
    },
    setEchoFreeze(state, action: PayloadAction<boolean>) {
      state.echoFreeze = action.payload;
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
