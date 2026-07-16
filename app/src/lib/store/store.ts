import { configureStore } from "@reduxjs/toolkit";
import weatherReducer from "./features/weather";
import interactionsReducer from "./features/interactions";

export const store = configureStore({
  reducer: {
    weather: weatherReducer,
    interactions: interactionsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false,
    }),
});

// Get the type of our store variable
export type AppStore = typeof store;
// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
