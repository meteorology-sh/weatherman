// Redux
import { configureStore } from "@reduxjs/toolkit";

// Slices
import findingsReducer from "./features/findings";
import dayReducer from "./features/day";

export const store = configureStore({
  reducer: {
    findings: findingsReducer,
    day: dayReducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
