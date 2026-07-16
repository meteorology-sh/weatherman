import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import { CloudCoverPoint } from "@/lib/types";

type WeatherState = {
  CloudPoints: CloudCoverPoint[] | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: WeatherState = {
  CloudPoints: undefined,
  loading: false,
  error: null,
};

export const weatherSlice = createSlice({
  name: "weather",
  initialState,
  reducers: {
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
