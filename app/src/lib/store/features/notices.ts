import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Types
import type { SourceNotice } from "@/lib/types";

type NoticesState = {
  /** What the server says now. Replaced whole on every poll. */
  items: SourceNotice[];
  /**
   * Notices the operator has closed. An id names one problem from when it
   * began, so closing it hides that problem and not the next one.
   */
  dismissed: string[];
};

const initialState: NoticesState = {
  items: [],
  dismissed: [],
};

const noticesSlice = createSlice({
  name: "notices",
  initialState,
  reducers: {
    setItems(state, action: PayloadAction<SourceNotice[]>) {
      state.items = action.payload;
      // A closed problem that has cleared cannot come back under the same id,
      // so its id is dropped rather than kept forever.
      state.dismissed = state.dismissed.filter((id) =>
        action.payload.some((notice) => notice.id === id)
      );
    },
    dismiss(state, action: PayloadAction<string>) {
      if (!state.dismissed.includes(action.payload)) {
        state.dismissed.push(action.payload);
      }
    },
  },
});

export const noticesActions = noticesSlice.actions;
export default noticesSlice.reducer;
