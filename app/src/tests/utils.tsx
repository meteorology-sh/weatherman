// React
import type { ReactElement, ReactNode } from "react";

// Store
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import candidateReducer from "@/lib/store/features/candidate";
import cloudTopReducer from "@/lib/store/features/cloudtop";
import interactionsReducer from "@/lib/store/features/interactions";
import forecastReducer from "@/lib/store/features/forecast";
import radarReducer from "@/lib/store/features/radar";
import replayReducer from "@/lib/store/features/replay";
import soundingReducer from "@/lib/store/features/sounding";

// Testing
import { render } from "@testing-library/react";

/**
 * A fresh store per test, mirroring the singleton's configuration in
 * lib/store/store.ts. Tests must not share the singleton — state would leak
 * between them.
 */
export function createTestStore() {
  return configureStore({
    reducer: {
      candidate: candidateReducer,
      cloudtop: cloudTopReducer,
      interactions: interactionsReducer,
      forecast: forecastReducer,
      radar: radarReducer,
      replay: replayReducer,
      sounding: soundingReducer,
    },
  });
}

/**
 * The store is supplied through RTL's `wrapper` option rather than inline, so
 * that `rerender` keeps the <Provider> around the tree.
 */
export function renderWithStore(
  ui: ReactElement,
  store: ReturnType<typeof createTestStore> = createTestStore(),
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper }),
  };
}
