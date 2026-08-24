// Redux
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Layers
import { OPEN_WITH } from "~/lib/layers";

/**
 * What the map is drawing: which layers are on, and which of the two hours.
 *
 * Its own slice rather than a corner of the day's, because it survives changing
 * the day. Turning the radar on to look at one afternoon and having it turn
 * itself off on the next date would make the control feel broken.
 */
export type Ends = "both" | "from" | "to";

type MapState = {
  visible: Record<string, boolean>;
  /**
   * Which analyses to paint. `both` is the default and the point of the page —
   * the region drawn at both ends is the region that does not depend on which
   * hour a release is charged to.
   */
  ends: Ends;
  /** Draw the storm-motion vector from each release point. */
  drift: boolean;
  counties: boolean;
};

const initialState: MapState = {
  visible: { ...OPEN_WITH },
  ends: "both",
  drift: true,
  counties: true,
};

const mapSlice = createSlice({
  name: "map",
  initialState,
  reducers: {
    toggleLayer(
      state,
      action: PayloadAction<{ key: string; visible: boolean }>
    ) {
      state.visible[action.payload.key] = action.payload.visible;
    },
    setEnds(state, action: PayloadAction<Ends>) {
      state.ends = action.payload;
    },
    setDrift(state, action: PayloadAction<boolean>) {
      state.drift = action.payload;
    },
    setCounties(state, action: PayloadAction<boolean>) {
      state.counties = action.payload;
    },
  },
});

export const mapActions = mapSlice.actions;
export default mapSlice.reducer;
