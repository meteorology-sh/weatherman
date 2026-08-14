import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { CandidateStats } from "@/lib/types";

type SeedabilityState = {
  /**
   * The candidate field — every layer joined into one.
   *
   * Its own slice rather than a field on `candidate`: that one covers the
   * supercooled-liquid layer, and this fetches and summarises a build of its
   * own. One slice per data domain.
   */
  visible: boolean;
  /** Summary of the field. The geometry itself never enters the store. */
  stats: CandidateStats | undefined;
  loading: boolean;
  error: string | null;
};

/**
 * **On by default**, unlike cloud base. This is the answer the map exists to
 * give, and it covers a fraction of the ground the other layers do, so it lands
 * on top of them rather than burying them.
 */
const initialState: SeedabilityState = {
  visible: true,
  stats: undefined,
  loading: false,
  error: null,
};

const seedabilitySlice = createSlice({
  name: "seedability",
  initialState,
  reducers: {
    setVisible(state, action: PayloadAction<boolean>) {
      state.visible = action.payload;
    },
    setStats(state, action: PayloadAction<CandidateStats>) {
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

export const seedabilityActions = seedabilitySlice.actions;
export default seedabilitySlice.reducer;
