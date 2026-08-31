import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Store
import { soundingActions } from "./sounding";

// Types
import type { StormNear } from "@/lib/types";

type StormsState = {
  /** The storm at the clicked point. Null when the window has no echo. */
  here: StormNear | null | undefined;
  hereLoading: boolean;
  hereError: string | null;
};

const initialState: StormsState = {
  here: undefined,
  hereLoading: false,
  hereError: null,
};

const stormsSlice = createSlice({
  name: "storms",
  initialState,
  reducers: {
    setHere(state, action: PayloadAction<StormNear | null>) {
      state.here = action.payload;
    },
    setHereLoading(state, action: PayloadAction<boolean>) {
      state.hereLoading = action.payload;
    },
    setHereError(state, action: PayloadAction<string | null>) {
      state.hereError = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(soundingActions.setPoint, (state) => {
      state.here = undefined;
      state.hereError = null;
    });
  },
});

export const stormsActions = stormsSlice.actions;
export default stormsSlice.reducer;
