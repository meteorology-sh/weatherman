import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { Sounding } from "@/lib/types";

/**
 * Where the readout points before anyone clicks: the centre of the map, and of
 * the country. A panel that starts empty teaches nobody that the map is
 * clickable, and the profile grid behind it has to be built either way.
 */
export const DEFAULT_POINT: [number, number] = [-98.58, 39.83];

type SoundingState = {
  /** [lon, lat] of the point being profiled — a click, or the default. */
  point: [number, number];
  /** The profile itself. One column of a dozen levels, so it fits in the store. */
  data: Sounding | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: SoundingState = {
  point: DEFAULT_POINT,
  data: undefined,
  loading: false,
  error: null,
};

const soundingSlice = createSlice({
  name: "sounding",
  initialState,
  reducers: {
    setPoint(state, action: PayloadAction<[number, number]>) {
      state.point = action.payload;
      // The old column is about somewhere else. Keeping it on screen under a
      // new set of coordinates would be the wrong answer, confidently labelled.
      state.data = undefined;
      state.error = null;
    },
    setData(state, action: PayloadAction<Sounding>) {
      state.data = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const soundingActions = soundingSlice.actions;
export default soundingSlice.reducer;
