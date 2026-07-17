import { configureStore } from "@reduxjs/toolkit";
import candidateReducer from "./features/candidate";
import interactionsReducer from "./features/interactions";
import forecastReducer from "./features/forecast";

// ArcGIS layer instances used to live in the store, which forced
// serializableCheck off. They are module-scope singletons in lib/arcgis/ now
// and the store holds only plain data, so the check is back on.
export const store = configureStore({
  reducer: {
    candidate: candidateReducer,
    interactions: interactionsReducer,
    forecast: forecastReducer,
  },
});

// Get the type of our store variable
export type AppStore = typeof store;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
