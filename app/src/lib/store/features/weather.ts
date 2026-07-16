import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import { CloudCoverPoint } from "@/lib/types";

interface WeatherState {
  CloudLayer: GeoJSONLayer;
  CloudPoints: CloudCoverPoint[] | undefined;
  loading: boolean;
  error: string | null;
}

const initialState: WeatherState = {
  CloudLayer: {} as GeoJSONLayer,
  CloudPoints: undefined,
  loading: false,
  error: null,
};

export const weatherSlice = createSlice({
  name: "weather",
  initialState,
  reducers: {
    CloudLayer: (state, action: PayloadAction<GeoJSONLayer>) => {
      (state.CloudLayer as unknown as GeoJSONLayer) = action.payload;
    },
    CloudPoints: (state, action: PayloadAction<CloudCoverPoint[]>) => {
      state.CloudPoints = action.payload;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
  },
});

export const weatherActions = weatherSlice.actions;
export default weatherSlice.reducer;
