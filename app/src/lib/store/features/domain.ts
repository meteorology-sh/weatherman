import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { DomainRing } from "@/lib/types";

type DomainState = {
  /**
   * The edge of the model, as a closed ring of [lon, lat].
   *
   * Geometry in the store, which nothing else here does — and it is the
   * exception the rule is written around rather than a hole in it. A contour
   * frame is ~1.4 MB and belongs to a layer; this is ~350 points that decide
   * whether a click is answered at all, so the map needs the numbers rather
   * than a picture of them. It is fetched once and never replaced, so
   * `serializableCheck` walks a fixed 700 numbers.
   */
  ring: DomainRing | null;
  error: string | null;
};

const initialState: DomainState = { ring: null, error: null };

const domainSlice = createSlice({
  name: "domain",
  initialState,
  reducers: {
    setRing(state, action: PayloadAction<DomainRing>) {
      state.ring = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const domainActions = domainSlice.actions;
export default domainSlice.reducer;
