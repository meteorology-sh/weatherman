import { configureStore } from "@reduxjs/toolkit";
import candidateReducer from "./features/candidate";
import cloudBaseReducer from "./features/cloudbase";
import cloudTopReducer from "./features/cloudtop";
import domainReducer from "./features/domain";
import forecastReducer from "./features/forecast";
import radarReducer from "./features/radar";
import seedabilityReducer from "./features/seedability";
import stormsReducer from "./features/storms";
import replayReducer from "./features/replay";
import soundingReducer from "./features/sounding";
import noticesReducer from "./features/notices";

// ArcGIS layer instances are module-scope singletons in lib/arcgis/, never
// store state: putting one here forces serializableCheck off. The store holds
// only plain data, so the check stays on.
export const store = configureStore({
  reducer: {
    candidate: candidateReducer,
    cloudbase: cloudBaseReducer,
    cloudtop: cloudTopReducer,
    domain: domainReducer,
    forecast: forecastReducer,
    radar: radarReducer,
    seedability: seedabilityReducer,
    storms: stormsReducer,
    replay: replayReducer,
    sounding: soundingReducer,
    notices: noticesReducer,
  },
});

// Get the type of our store variable
export type AppStore = typeof store;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
