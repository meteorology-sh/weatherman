import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { Sounding } from "@/lib/types";

/**
 * Where the column is read before anyone clicks: the centre of the map, and of
 * the country.
 *
 * It is read to warm the profile grid, not to fill the panel. That build is
 * national and every later click is answered from it, so paying for it on
 * arrival is what makes the first click cost milliseconds — but nothing about
 * this point is drawn, because nobody chose it.
 */
export const DEFAULT_POINT: [number, number] = [-98.58, 39.83];

type SoundingState = {
  /** [lon, lat] of the point being profiled — a click, or the default. */
  point: [number, number];
  /**
   * Whether the point came from a click.
   *
   * The column is worth reading over the default centre — it is a profile of
   * somewhere, and the grid behind it has to be built anyway. The join's
   * readout is not: it is headed "cloud over this point", and there is no
   * *this point* until someone picks one.
   */
  clicked: boolean;
  /** The profile itself. One column of a dozen levels, so it fits in the store. */
  data: Sounding | undefined;
  loading: boolean;
  error: string | null;
};

const initialState: SoundingState = {
  point: DEFAULT_POINT,
  clicked: false,
  data: undefined,
  loading: false,
  error: null,
};

const soundingSlice = createSlice({
  name: "sounding",
  initialState,
  reducers: {
    setPoint(state, action: PayloadAction<[number, number]>) {
      state.point = action.payload;
      state.clicked = true;
      // The old column is about somewhere else. Keeping it on screen under a
      // new set of coordinates would be the wrong answer, confidently labelled.
      state.data = undefined;
      state.error = null;
    },
    setData(state, action: PayloadAction<Sounding>) {
      state.data = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const soundingActions = soundingSlice.actions;
export default soundingSlice.reducer;
