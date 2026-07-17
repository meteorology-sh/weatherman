import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { ForecastMeta } from "@/lib/types";

type ForecastState = {
  meta: ForecastMeta | undefined;
  /** Forecast hour the slider is on. */
  hour: number;
  /** True while the map is fetching/drawing the selected frame. */
  drawing: boolean;
  loading: boolean;
  error: string | null;
};

const initialState: ForecastState = {
  meta: undefined,
  hour: 0,
  drawing: false,
  loading: false,
  error: null,
};

const forecastSlice = createSlice({
  name: "forecast",
  initialState,
  reducers: {
    setMeta(state, action: PayloadAction<ForecastMeta>) {
      state.meta = action.payload;
    },
    setHour(state, action: PayloadAction<number>) {
      state.hour = action.payload;
    },
    setDrawing(state, action: PayloadAction<boolean>) {
      state.drawing = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const forecastActions = forecastSlice.actions;
export default forecastSlice.reducer;
