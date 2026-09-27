// Redux
import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

// Types
import type { Region } from "~/lib/types";

/**
 * The programs this evaluation can be run against, and which one is open.
 *
 * `active` is set from the url rather than by a control, so a link to a region's
 * findings is a link to that region's findings. The picker navigates; it does
 * not hold the selection.
 */
type RegionsState = {
  all: Region[] | null;
  active: string | null;
  loading: boolean;
  error: string | null;
};

const initialState: RegionsState = {
  all: null,
  active: null,
  loading: false,
  error: null,
};

const regionsSlice = createSlice({
  name: "regions",
  initialState,
  reducers: {
    setAll(state, action: PayloadAction<Region[]>) {
      state.all = action.payload;
    },
    setActive(state, action: PayloadAction<string | null>) {
      state.active = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
      if (action.payload) state.error = null;
    },
    setError(state, action: PayloadAction<string>) {
      state.error = action.payload;
    },
  },
});

export const regionsActions = regionsSlice.actions;
export default regionsSlice.reducer;
