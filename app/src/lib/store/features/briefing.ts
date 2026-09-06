import { createSlice, PayloadAction } from "@reduxjs/toolkit";

type BriefingState = {
  /** Mixed-layer CAPE. Off on arrival. */
  cape: boolean;
  /** Mixed-layer CIN. Off on arrival. */
  cin: boolean;
  /** Lifting condensation level. Off on arrival. */
  lcl: boolean;
  /** 0 °C height. Off on arrival. */
  freezing: boolean;
  /** −15 °C height. Off on arrival. */
  minus15: boolean;
  /** Freezing minus cloud base. Off on arrival. */
  warmDepth: boolean;
};

const initialState: BriefingState = {
  cape: false,
  cin: false,
  lcl: false,
  freezing: false,
  minus15: false,
  warmDepth: false,
};

const briefingSlice = createSlice({
  name: "briefing",
  initialState,
  reducers: {
    setCape(state, action: PayloadAction<boolean>) {
      state.cape = action.payload;
    },
    setCin(state, action: PayloadAction<boolean>) {
      state.cin = action.payload;
    },
    setLcl(state, action: PayloadAction<boolean>) {
      state.lcl = action.payload;
    },
    setFreezing(state, action: PayloadAction<boolean>) {
      state.freezing = action.payload;
    },
    setMinus15(state, action: PayloadAction<boolean>) {
      state.minus15 = action.payload;
    },
    setWarmDepth(state, action: PayloadAction<boolean>) {
      state.warmDepth = action.payload;
    },
  },
});

export const briefingActions = briefingSlice.actions;
export default briefingSlice.reducer;
