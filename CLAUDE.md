# Rome: A React Template

## What This Is

A React SPA at an early scaffolding stage. The `package.json` name is `atomic`. The app fetches current temperature from the Open-Meteo API for Austin, TX and stores it in Redux — this is the live data integration pattern all future features should follow.

## Stack

| Tool          | Version | Notes                                                                              |
| ------------- | ------- | ---------------------------------------------------------------------------------- |
| React         | 19      | StrictMode always on                                                               |
| TypeScript    | 6       | `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly` — no `enum`, no `namespace` |
| Vite          | 8       | Path alias `@` → `src/`, manual vendor chunks                                      |
| React Router  | 7       | `createBrowserRouter`, data router                                                 |
| Redux Toolkit | 2       | `configureStore` + `createSlice`                                                   |
| Tailwind CSS  | 4       | Vite plugin — no `tailwind.config.js`                                              |
| DaisyUI       | 5       | Semantic component classes + theme tokens                                          |
| Vitest        | 4       | `.test.ts(x)` files in `src/tests/`                                                |

## Directory Structure

```
rome/
  app/                       # Entire frontend
    src/
      app/                   # UI layer
        App.tsx              # Layout shell: drawer nav + <Outlet />
        components/          # Route-level pages (LandingPage, About)
        assets/
        index.css / App.css
      lib/                   # Infrastructure — not UI
        client/api.ts        # Plain async fetch functions (PascalCase names)
        context/
          RootProvider.tsx   # Composes all providers — edit here to add one
          RouterProvider.tsx # Router config at module scope, not inside component
          StoreProvider.tsx  # Instantiates store once via useMemo
          DataProvider.tsx   # Renderless: fetches data → dispatches to Redux
        store/
          store.ts           # makeStore() factory + inferred AppStore/RootState/AppDispatch
          hooks.ts           # useAppDispatch, useAppSelector, useAppStore (always use these)
          features/data.ts   # Redux slice: DataState, dataActions, default reducer export
        types/data.ts        # API response types (T suffix convention)
      tests/                 # All test files (.test.ts / .test.tsx)
    Dockerfiles/
      Dockerfile.local       # Dev: node:alpine, Vite dev server
      Dockerfile.prod        # Prod: multi-stage — Node build → nginx:stable-alpine
    nginx.conf               # SPA try_files fallback + gzip
    vite.config.ts           # Alias, plugins, manual chunks, server host/HMR config
  docker-compose.yaml        # Local dev — port 5173, bind mount, HMR
  docker-compose.prod.yaml   # Production — port 5173→8080, static nginx
```

## Running the App

```bash
# Local dev (Vite HMR, source bind-mounted)
docker-compose up

# Production build (nginx static serve)
docker-compose -f docker-compose.prod.yaml up
```

## External API

Open-Meteo (`https://api.open-meteo.com/v1/forecast`) — no auth. Returns current weather. The app requests temperature at lat `30.26715`, lon `-97.74306` (Austin, TX) in Fahrenheit.

---

## Provider Composition

`main.tsx` renders exactly one thing: `<RootProvider />`.

```tsx
// main.tsx
createRoot(document.getElementById("root")!).render(<RootProvider />);
```

`RootProvider` composes all providers in a fixed order:

```tsx
// lib/context/RootProvider.tsx
export const RootProvider = () => (
  <StrictMode>
    <StoreProvider>
      <RouterProvider />
      <DataProvider />
    </StoreProvider>
  </StrictMode>
);
```

**The provider composition order is fixed.**

- `StoreProvider` is always the outermost application wrapper so every provider and component can access the store.
- `RouterProvider` and `DataProvider` are **siblings**, not nested. `RouterProvider` owns the entire visible UI tree. `DataProvider` is renderless (no children, no visible output).
- Add new providers as siblings inside `StoreProvider`, never as wrappers around `RouterProvider`.

---

## RouterProvider

The router config lives at **module scope** inside `RouterProvider.tsx`, not inside the component.

```tsx
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // layout shell
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/about", element: <About /> },
    ],
  },
]);

export const RouterProvider = () => <ReactRouter router={router} />;
```

- `App` is the layout shell. It renders `<Outlet />` where child routes appear.
- Use `NavLink` (not `Link`) for navigation so active state is available.
- Add new routes as children of the root `App` entry.

---

## DataProvider — Renderless Side-Effect Provider

A `DataProvider` fetches external data and syncs it into Redux. It renders no UI.

```tsx
// lib/context/DataProvider.tsx
const TemperatureContext = createContext<number | undefined>(undefined);

export const DataProvider = () => {
  const temperature = useAppSelector((state) => state.data.temperature);
  const dispatch = useAppDispatch();

  useEffect(() => {
    const fetch = async () => {
      const data = await FetchTemperature();
      dispatch(dataActions.temperature(data.current.temperature_2m));
    };

    if (!temperature) fetch(); // guard: skip if already loaded
  }, [temperature, dispatch]);

  return <TemperatureContext.Provider value={temperature} />; // no children
};
```

**Pattern rules:**

- The provider reads from and writes to Redux — it does not manage local state for shared data.
- The `useEffect` guard (`if (!data) fetch()`) prevents redundant fetches on re-renders.
- Returning `<Context.Provider value={...} />` with no children makes the context available without wrapping the UI tree.
- One `DataProvider` per data domain; add new ones as siblings in `RootProvider`.

---

## Redux Store

### Store factory

The store is created via `makeStore()`, not as a singleton. **Types are always inferred from the factory, never written by hand.**

```ts
// lib/store/store.ts
export const makeStore = () => configureStore({ reducer: { data } });

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

`StoreProvider` instantiates it once with `useMemo`:

```tsx
const store: AppStore = useMemo(() => makeStore(), []);
```

### Typed hooks

**Always use the typed wrappers — never import `useDispatch`/`useSelector` directly.**

```ts
// lib/store/hooks.ts
export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
export const useAppStore: () => AppStore = useStore;
```

### Slice conventions

```ts
// lib/store/features/data.ts
type DataState = {
  string: string | undefined;
  temperature: number | undefined;
};

const initialState: DataState = { ... };

const dataSlice = createSlice({
  name: "data",
  initialState,
  reducers: {
    temperature: (state, action: PayloadAction<number>) =>
      ({ ...state, temperature: action.payload }),   // spread, don't mutate
  },
});

export const dataActions = dataSlice.actions;   // named export
export default dataSlice.reducer;               // default export
```

- State shape is an explicit named type (`DataState`), not inferred.
- **Reducers use spread returns (`return { ...state, field }`) — do not mutate `state` in place.**
- Actions are namespaced under `dataActions` and exported as a named export.
- The reducer is the default export; add it to `store.ts`'s `reducer` map.

---

## API Client

Client functions live in `lib/client/`. They are **plain async functions, not hooks.**

```ts
// lib/client/api.ts
export const FetchTemperature = async (): Promise<TemperatureT> => {
  const params = new URLSearchParams({ ... });
  const response = await fetch(`https://...?${params}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) console.error(await response.text());

  const data: TemperatureT = await response.json();
  return data;
};
```

- Use `URLSearchParams` for query strings.
- Use `fetch` directly (no axios).
- **Guard non-OK responses:** `if (!response.ok) console.error(await response.text())`.
- Return the typed response; the caller (a `DataProvider`) handles dispatch.
- Function names are `PascalCase`.

---

## Types

Types live in `lib/types/`. External API response shapes are typed explicitly with a `T` suffix.

```ts
// lib/types/data.ts
export type TemperatureT = {
  current: { time: Date; interval: number; temperature_2m: number };
  // ...
};
```

---

## Component Conventions

### Control flow

**Use early-return guards before the main render. Never use ternaries for loading/empty states at the top level.**

```tsx
export const About = () => {
  const string = useAppSelector((state) => state.data.string);

  if (!string) return; // guard — returns undefined (renders nothing)

  return <>About</>;
};
```

### Consuming the store

Components read from Redux directly via `useAppSelector`. Don't thread props down for data that lives in the store.

```tsx
const value = useAppSelector((state) => state.data.fieldName);
```

### Layout shell (App.tsx)

`App.tsx` is only for layout chrome (nav, sidebar, wrappers). It renders `<Outlet />` for child routes. Keep it under 150 lines.

---

## Import Ordering

Group imports with a single-line comment label. Order:

```tsx
// React
// Router
// Hooks
// Store
// Client
// Types
// Styles
// Providers
// Components
```

Use only the groups that apply. No blank lines between items within a group; one blank line between groups.

Cross-module imports use the `@/` alias. Same-folder imports use relative paths.

Verify import order conforms to this grouping before committing.

---

## Styling — Tailwind v4 + DaisyUI

- Tailwind is loaded as a Vite plugin; there is no `tailwind.config.js`.
- Use DaisyUI semantic classes for color and components (`btn`, `drawer`, `menu`, `card`, etc.).
- Layout uses Tailwind utility classes (`flex`, `h-screen`, `w-full`, `p-4`).
- **Use semantic color names — never hardcode colors.** This ensures theming works across DaisyUI themes.

```html
<div class="bg-base-200">
  <div class="bg-base-100 border-base-300 text-base-content">
    This is dark text on a light background, which switches to light text on a
    dark background in dark mode.
  </div>
</div>
```

---

## Testing — Vitest

Vitest is already in `devDependencies`. Tests run via `yarn test` (script: `"test": "vitest"`).

**Where tests live:** All tests go in `src/tests/`, using the `.test.ts` / `.test.tsx` suffix. Do not co-locate tests next to source files.

```
src/tests/
  simulate.test.ts
  data.test.ts
  flow.test.ts
```

**Testing trophy (guides test investment):**

- **Static analysis** (TypeScript + ESLint) — already configured, catches errors at compile time.
- **Unit tests** (Vitest) — pure logic, reducers, selectors. Fast, no DOM needed.
- **Integration tests** (React Testing Library + Vitest) — render real components with a real store, assert on what the user sees. This is where most React apps get the best return on test effort.
- **E2E tests** (Playwright) — full browser against a running app. Reserve for critical user flows.

This template ships with unit tests only. As the app grows, add `@testing-library/react` for integration tests — they catch regressions that unit tests alone will miss.

**What to test now:**

- Pure logic functions (simulation engine, selectors, utility functions) — the primary target.
- Redux reducer cases — test each action against a known initial state.

**Vitest config** (inside `vite.config.ts`):

```ts
/// <reference types="vitest" />
// add inside defineConfig({ ... }):
test: {
  environment: "jsdom",
  globals: true,
}
```

**Conventions:**

- Test files use plain `describe` / `it` / `expect` — no imports needed when `globals: true`.
- Each `it` tests exactly one behavior; keep assertions focused.
- Pure functions: pass input directly, assert on return value — no mocks, no store setup.
- Redux slices: call the reducer directly (`reducer(initialState, action)`) — do not mount a store.
- All tests must pass (`yarn test`) before committing.

---

## ESLint & Formatting

**ESLint rules to respect:**

- `max-lines: 150` (blank lines and comments excluded) — split files before hitting this.
- `react-hooks/recommended` — exhaustive deps, rules of hooks.
- `react-refresh/only-export-components` — don't mix component and non-component exports in the same file unless using `allowConstantExport`.

**TypeScript compiler enforcement:**

- `noUnusedLocals` and `noUnusedParameters` — no dead variables.
- `erasableSyntaxOnly` — no `enum`, no `namespace`.

**Prettier (enforced, not optional):**

- 80-char print width, 2-space indent, double quotes, semicolons, trailing commas (ES5), always-parens for arrow functions.

**Before committing**, run `yarn run lint` and `yarn run format` to catch violations.

---

## Ecosystem Defaults That Do Not Apply Here

These conventions contradict standard patterns from Redux Toolkit, TypeScript, or common tutorials. This project intentionally diverges:

- **Spread returns, not Immer mutations.** RTK docs encourage `state.field = value` — this project requires `return { ...state, field: value }`.
- **No `createAsyncThunk`.** RTK's standard async pattern is not used. Async work lives in DataProviders calling plain client functions.
- **No `enum` or `namespace`.** Use `type` unions instead. `erasableSyntaxOnly` enforces this at compile time.
- **`fetch`, not axios.** Client functions use the Fetch API directly.
- **Typed hooks only.** Never import `useSelector` or `useDispatch` from `react-redux` — always use `useAppSelector` / `useAppDispatch`.

---

## Adding a Feature — Checklist

1. **Type** — add the response/domain type to `lib/types/`.
2. **Client** — add a fetch function to `lib/client/api.ts`.
3. **Slice** — add a new slice under `lib/store/features/`, register it in `store.ts`.
4. **DataProvider** — add a new `*Provider` in `lib/context/` (or extend an existing one) to fetch and dispatch; register it as a sibling in `RootProvider`.
5. **Route** — add the route entry to `RouterProvider.tsx` and a component under `app/components/`.
6. **Component** — read from the store with `useAppSelector`; guard with early returns before rendering.
