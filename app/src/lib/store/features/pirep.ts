import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { IcingStats } from "@/lib/types";

type PirepState = {
  /** Aircraft icing reports, drawn over everything else on the candidate map. */
  visible: boolean;
  /**
   * Draw only reports inside the −5..−12 °C seeding band. Off by default: the
   * out-of-band reports are the context that makes the in-band ones legible as
   * rare, and hiding them by default would overstate how much confirmation
   * there is.
   */
  bandOnly: boolean;
  /** Summary of the pull. The features themselves never enter the store. */
  stats: IcingStats | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: PirepState = {
  visible: true,
  bandOnly: false,
  stats: undefined,
  loading: false,
  error: null,
};

const pirepSlice = createSlice({
  name: "pirep",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setBandOnly(state, action: PayloadAction<boolean>) {
      state.bandOnly = action.payload;
    },
    setStats(state, action: PayloadAction<IcingStats>) {
      state.stats = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const pirepActions = pirepSlice.actions;
export default pirepSlice.reducer;
