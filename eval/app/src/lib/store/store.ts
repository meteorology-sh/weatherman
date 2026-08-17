// Redux
import { configureStore } from "@reduxjs/toolkit";

// Slices
import findingsReducer from "./features/findings";
import dayReducer from "./features/day";
import mapReducer from "./features/map";
import regionsReducer from "./features/regions";

export const store = configureStore({
  reducer: {
    regions: regionsReducer,
    findings: findingsReducer,
    day: dayReducer,
    map: mapReducer,
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
