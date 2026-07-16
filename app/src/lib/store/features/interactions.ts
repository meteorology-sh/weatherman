import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { CloudLayerId } from "@/lib/types";

type InteractionsState = {
  coordinates: [number, number] | null;
  cloudLayer: CloudLayerId;
};

const initialState: InteractionsState = {
  coordinates: null,
  cloudLayer: "geocolor",
};

const interactionsSlice = createSlice({
  name: "interactions",
  initialState,
  reducers: {
    setCoordinates(state, action: PayloadAction<[number, number] | null>) {
      state.coordinates = action.payload;
    },
    setCloudLayer(state, action: PayloadAction<CloudLayerId>) {
      state.cloudLayer = action.payload;
    },
  },
});

export const interactionsActions = interactionsSlice.actions;
export default interactionsSlice.reducer;
