import { configureStore } from "@reduxjs/toolkit";
import candidateReducer from "./features/candidate";
import cloudTopReducer from "./features/cloudtop";
import interactionsReducer from "./features/interactions";
import forecastReducer from "./features/forecast";
import pirepReducer from "./features/pirep";
import radarReducer from "./features/radar";
import soundingReducer from "./features/sounding";

// ArcGIS layer instances used to live in the store, which forced
// serializableCheck off. They are module-scope singletons in lib/arcgis/ now
// and the store holds only plain data, so the check is back on.
export const store = configureStore({
  reducer: {
    candidate: candidateReducer,
    cloudtop: cloudTopReducer,
    interactions: interactionsReducer,
    forecast: forecastReducer,
    pirep: pirepReducer,
    radar: radarReducer,
    sounding: soundingReducer,
  },
});

// Get the type of our store variable
export type AppStore = typeof store;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
