import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Store
import { soundingActions } from "./sounding";

// Types
import type { StormNear } from "@/lib/types";

type StormsState = {
  /**
   * Contiguous ≥20 dBZ storms on the candidate map.
   *
   * On by default: this is the object an operator flies, and the map should
   * open on it. The seeding-opportunity fill stays on too, so the two
   * answers can disagree in view.
   */
  visible: boolean;
  /** The storm at the clicked point. Null when the window has no echo. */
  here: StormNear | null | undefined;
  hereLoading: boolean;
  hereError: string | null;
};

const initialState: StormsState = {
  visible: true,
  here: undefined,
  hereLoading: false,
  hereError: null,
};

const stormsSlice = createSlice({
  name: "storms",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
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
