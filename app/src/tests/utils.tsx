// React
import type { ReactElement, ReactNode } from "react";

// Store
import { configureStore } from "@reduxjs/toolkit";
import { Provider } from "react-redux";
import candidateReducer from "@/lib/store/features/candidate";
import cloudBaseReducer from "@/lib/store/features/cloudbase";
import cloudTopReducer from "@/lib/store/features/cloudtop";
import domainReducer from "@/lib/store/features/domain";
import interactionsReducer from "@/lib/store/features/interactions";
import forecastReducer from "@/lib/store/features/forecast";
import radarReducer from "@/lib/store/features/radar";
import seedabilityReducer from "@/lib/store/features/seedability";
import stormsReducer from "@/lib/store/features/storms";
import replayReducer from "@/lib/store/features/replay";
import soundingReducer from "@/lib/store/features/sounding";

// Testing
import { render } from "@testing-library/react";

// Types
import type { Diagnostics } from "@/lib/types";

/**
 * A quiet cell's diagnostics — no cloud, no convection, no echo.
 *
 * Every sounding fixture carries this block, and most tests are about the
 * profile rather than about it, so the default is the boring answer and each
 * test overrides only the field it is making a claim about.
 */
export const noDiagnostics: Diagnostics = {
  cloudBaseFt: null,
  cloudBaseAglFt: null,
  cloudTopFt: null,
  depthFt: null,
  bandInCloud: null,
  capeJKg: 0,
  mixedCapeJKg: 0,
  stormMotionKt: 0,
  stormMotionTowardDeg: null,
  lightning: null,
  vilKgM2: 0,
  echoTopFt: null,
};

/**
 * A fresh store per test, mirroring the singleton's configuration in
 * lib/store/store.ts. Tests must not share the singleton — state would leak
 * between them.
 */
export function createTestStore() {
  return configureStore({
    reducer: {
      candidate: candidateReducer,
      cloudbase: cloudBaseReducer,
      cloudtop: cloudTopReducer,
      domain: domainReducer,
      interactions: interactionsReducer,
      forecast: forecastReducer,
      radar: radarReducer,
      seedability: seedabilityReducer,
      storms: stormsReducer,
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
  store: ReturnType<typeof createTestStore> = createTestStore()
) {
  const Wrapper = ({ children }: { children: ReactNode }) => (
    <Provider store={store}>{children}</Provider>
  );

  return {
    store,
    ...render(ui, { wrapper: Wrapper }),
  };
}
