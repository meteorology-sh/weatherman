import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type {
  CandidateStats,
  CloudBaseStats,
  CloudTopStats,
  RadarStats,
  SlwStats,
} from "@/lib/types";

/** The summaries for one replayed hour, or nothing yet. */
type ReplayStats = {
  cloudBase: CloudBaseStats;
  cloudTop: CloudTopStats;
  liquid: SlwStats;
  radar: RadarStats;
  field: CandidateStats;
};

type ReplayState = {
  /**
   * The hour the operator asked for, ISO 8601, or null for "nothing picked".
   *
   * A string rather than a Date because the store holds only plain serializable
   * data — RTK's `serializableCheck` is on at its default, and a Date is the
   * first thing it rejects. It is also exactly what the server's `at` parameter
   * wants, so nothing converts on the way out.
   *
   * Null on arrival on purpose: the replay page opens blank. A default of "now"
   * would make it a second live map, and a default of some past date would put
   * a date on screen nobody chose.
   */
  at: string | null;
  /**
   * The hour whose builds are warm on the server, and therefore the only hour
   * the map may draw.
   *
   * Separate from `at` because the two are apart for most of a minute. A cold
   * replay costs ~40 s a source, and the three do not finish together — the
   * radar mosaic lands in ~10 s and the satellite scene takes four times that.
   * Drawing each as it arrived left the map showing two dates at once, which is
   * worse than showing neither. So the layers follow `ready`, and `ready` only
   * moves once all three sources have answered for the same hour.
   */
  ready: string | null;
  loading: boolean;
  error: string | null;
  /** What each source reports for `ready` — the evidence of which scenes drew. */
  stats: ReplayStats | null;
  /** Which layers are drawn. Mirrors the candidate map's defaults. */
  cloudBase: boolean;
  cloudTop: boolean;
  liquid: boolean;
  radar: boolean;
  field: boolean;
};

const initialState: ReplayState = {
  at: null,
  ready: null,
  loading: false,
  error: null,
  stats: null,
  // Off on arrival, like the candidate map's: an extra fill switched on by
  // default lands on the ones an operator already reads.
  cloudBase: false,
  cloudTop: true,
  liquid: true,
  radar: true,
  field: true,
};

const replaySlice = createSlice({
  name: "replay",
  initialState,
  reducers: {
    /**
     * Ask for an hour. This clears `ready`, which is what blanks the map: the
     * previous hour stops being drawable the moment a new one is requested,
     * rather than lingering under a date that no longer matches it.
     */
    setAt(state, action: PayloadAction<string | null>) {
      state.at = action.payload;
      state.ready = null;
      state.stats = null;
      state.error = null;
    },
    /** Every source has answered for this hour, so it may be drawn. */
    setReady(state, action: PayloadAction<{ at: string; stats: ReplayStats }>) {
      state.ready = action.payload.at;
      state.stats = action.payload.stats;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setCloudBase(state, action: PayloadAction<boolean>) {
      state.cloudBase = action.payload;
    },
    setCloudTop(state, action: PayloadAction<boolean>) {
      state.cloudTop = action.payload;
    },
    setLiquid(state, action: PayloadAction<boolean>) {
      state.liquid = action.payload;
    },
    setRadar(state, action: PayloadAction<boolean>) {
      state.radar = action.payload;
    },
    setField(state, action: PayloadAction<boolean>) {
      state.field = action.payload;
    },
  },
});

export const replayActions = replaySlice.actions;
export default replaySlice.reducer;
