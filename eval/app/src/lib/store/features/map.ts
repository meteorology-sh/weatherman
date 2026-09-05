// Redux
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Layers
import { OPEN_WITH } from "~/lib/layers";

/**
 * What the map is drawing: which layers are on, and which hour's map.
 *
 * Its own slice rather than a corner of the day's, because it survives changing
 * the day. Turning the radar on to look at one afternoon and having it turn
 * itself off on the next date would make the control feel broken.
 */

type MapState = {
  visible: Record<string, boolean>;
  /**
   * Which painted hour to show. Null means every hour this day's flares
   * were charged to. Each hour is a different set of flares, not the same
   * flares at two times.
   */
  selectedHour: string | null;
  /** Draw the drop-to-hour estimate. Only drawn while liquid or the join is on. */
  drift: boolean;
  /** Heaviest-rain dots and heading ticks. Only drawn while radar is on. */
  heading: boolean;
  /** GLM flashes. Only drawn while radar is on. */
  lightning: boolean;
  counties: boolean;
};

const initialState: MapState = {
  visible: { ...OPEN_WITH },
  selectedHour: null,
  drift: true,
  heading: false,
  lightning: false,
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
    setSelectedHour(state, action: PayloadAction<string | null>) {
      state.selectedHour = action.payload;
    },
    setDrift(state, action: PayloadAction<boolean>) {
      state.drift = action.payload;
    },
    setHeading(state, action: PayloadAction<boolean>) {
      state.heading = action.payload;
    },
    setLightning(state, action: PayloadAction<boolean>) {
      state.lightning = action.payload;
    },
    setCounties(state, action: PayloadAction<boolean>) {
      state.counties = action.payload;
    },
  },
});

export const mapActions = mapSlice.actions;
export default mapSlice.reducer;
