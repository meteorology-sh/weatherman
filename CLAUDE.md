# Weatherman: A Full-Stack Template

## What This Is

A full-stack TypeScript application at an early scaffolding stage: a React SPA
in `/app` and an Express API in `/server`, orchestrated with Docker Compose.

**Product context:** Weatherman is the operator-facing software for a
field-deployable cloud-seeding weather station (part of the Rainmaker project).
The station fuses local sensor data with free national feeds (NEXRAD, GOES,
HRRR) into a single *seedability* verdict — is there supercooled liquid water
in the −5 to −12 °C band worth sending a drone to, and did seeding work? The
system design lives outside this repo at `/home/nathan/code/rainmaker/weatherman`
(see its `README.md` and `docs/`). This web app will become the operator
dashboard for that station.

**Current example feature:** national cloud cover — the server samples a
~180-point grid across the continental U.S. from the Open-Meteo API (cached
in-memory) and serves it at `/weather/cloud-cover`; the app renders it as an
ArcGIS layer over a dark national map, with a stats/legend sidebar that can
fly the map to any grid point. It is wired end-to-end (upstream API → service
→ router → proxy → client → Redux → map) and is the reference implementation
of the full-stack data pattern all future features should follow. (An earlier
"supply chain explorer" example was removed as dead code — its on-disk data
was never committed; see git history if you need it.)

## Guiding Principles

- **Neat and organized.** Every file has one job and a predictable home.
  Infrastructure (`lib/`) is separated from UI (`app/`); routers are separated
  from services. Split files before they sprawl (~150 lines is the smell
  threshold for components).
- **Minimize dependencies.** Prefer the platform (`fetch`, `fs/promises`,
  `URLSearchParams`) and what is already installed. Adding a dependency
  requires a reason the existing stack can't satisfy.
- **Follow the existing pattern.** Each layer below has one canonical example
  in the code — copy its shape for new features rather than inventing a
  parallel approach.

## Repository Layout

```
weatherman/
  app/                       # React SPA (Vite dev server, port 5173)
  server/                    # Express API (ts-node/nodemon, port 3000)
  docker-compose.yaml        # Runs both services with bind mounts + HMR
```

## Running the App

```bash
# Both services (app on :5173, server on :3000), source bind-mounted
docker-compose up

# Or individually
cd app && yarn dev
cd server && yarn dev
```

Compose service names: `weatherman-app-service`, `weatherman-server-service`.
Each service has its own `Dockerfiles/Dockerfile.local` (plain `node` image +
`yarn`). The server's in-container script is `yarn docker` (`nodemon -L`, for
polling across bind mounts). The server exposes `GET /healthcheck` for smoke
checks.

---

# Frontend — `/app`

## Stack

| Tool          | Version | Notes                                                          |
| ------------- | ------- | -------------------------------------------------------------- |
| React         | 19      | StrictMode always on                                            |
| TypeScript    | 6       | `strict`, `noUnusedLocals`, `noUnusedParameters`                |
| Vite          | 8       | Path alias `@` → `src/`; dev proxy routes API calls to server   |
| React Router  | 7       | `createBrowserRouter`, data router                              |
| Redux Toolkit | 2       | `configureStore` + `createSlice`                                |
| ArcGIS SDK    | 5       | `@arcgis/core` ES modules only — never `esri-loader`            |
| Tailwind CSS  | 4       | Vite plugin — no `tailwind.config.js`                           |
| DaisyUI       | 5       | Semantic component classes + theme tokens                       |
| Vitest        | 4       | + React Testing Library; all tests in `src/tests/`              |

`/app` is an ES module package (`"type": "module"`).

## Directory Structure

```
app/src/
  app/                     # UI layer
    App.tsx                # Layout shell: Navigation + providers + <Outlet />
    main.tsx               # Entry: router config + provider composition
    layout/                # Chrome components (Navigation)
    components/            # Route pages + feature components
                           #   (Landing, Interface, Map, Clouds, Drawer)
    assets/
    index.css / App.css
  lib/                     # Infrastructure — not UI
    client.ts              # Plain async fetch functions (PascalCase names)
    types.ts               # Shared data shapes — mirror server responses
    arcgis/                # Module-scope ArcGIS config objects
      renderers.ts         #   Renderer instances (symbols, visual variables)
      templates.ts         #   PopupTemplate instances
    context/
      StoreProvider.tsx    # Wraps children with the Redux <Provider>
      WeatherProvider.tsx  # Data provider: fetches → dispatches to Redux
    store/
      store.ts             # Singleton store + AppStore/RootState/AppDispatch
      hooks.ts             # useAppDispatch/useAppSelector/useAppStore
      features/            # One slice per domain (weather.ts, interactions.ts)
  tests/                   # All test files (.test.ts / .test.tsx) + utils.tsx
```

## Bootstrapping & Provider Composition

`main.tsx` defines the router at **module scope** and composes providers
around it:

```tsx
// app/src/app/main.tsx
const router = createBrowserRouter([
  {
    path: "/",
    element: <App />, // layout shell
    children: [
      { path: "/", element: <LandingPage /> },
      { path: "/map", element: <Interface /> },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <StoreProvider>
      <RouterProvider router={router} />
    </StoreProvider>
  </StrictMode>
);
```

- `StoreProvider` is always the outermost application wrapper.
- Add new routes as children of the root `App` entry; each route's page
  component lives in `app/components/`.
- `App.tsx` is only for layout chrome (navigation, wrappers) plus data
  providers that child routes need. It renders `<Outlet />` for child routes.

## Data Providers

A data provider fetches external data and syncs it into Redux. It **wraps its
children** and renders no UI of its own:

```tsx
// lib/context/WeatherProvider.tsx
export function WeatherProvider({ children }: { children: React.ReactNode }) {
  const points = useAppSelector((state) => state.weather.CloudPoints);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(weatherActions.setLoading(true));
        const [layer, points] = await GetCloudCover();
        dispatch(weatherActions.CloudLayer(layer));
        dispatch(weatherActions.CloudPoints(points));
      } catch (error) {
        dispatch(weatherActions.setError(
          error instanceof Error ? error.message : "Failed to load data"
        ));
      } finally {
        dispatch(weatherActions.setLoading(false));
      }
    }

    if (!points) load(); // guard: skip if already loaded
  }, [points, dispatch]);

  return <>{children}</>;
}
```

**Pattern rules:**

- The provider reads from and writes to Redux — it does not hold local state
  for shared data.
- The `useEffect` guard (`if (!data) load()`) prevents redundant fetches on
  re-render (StrictMode double-invokes effects).
- Loading and error states are dispatched to the slice, not kept locally, so
  any component can render them.
- One provider per data domain. Place it where its consumers live — in
  `App.tsx` around `<Outlet />` for app-wide data, or around a single route's
  element for page-scoped data.

## Redux Store

### Store

The store is a singleton created in `store.ts`; **types are inferred from it,
never written by hand**:

```ts
// lib/store/store.ts
export const store = configureStore({
  reducer: { weather: weatherReducer, interactions: interactionsReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

`serializableCheck` is disabled **only** because ArcGIS layer instances live in
the store. Keep everything else in the store plain and serializable.

`StoreProvider` wraps children with the react-redux `<Provider>`, passing the
singleton store directly (no `useRef` — the `react-hooks/refs` lint rule
forbids reading refs during render).

### Typed hooks

**Always use the typed wrappers — never import `useDispatch`/`useSelector`
directly:**

```ts
// lib/store/hooks.ts
export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
export const useAppStore = useStore.withTypes<AppStore>();
```

### Slice conventions

```ts
// lib/store/features/interactions.ts
type InteractionsState = {
  coordinates: [number, number] | null;
};

const initialState: InteractionsState = { coordinates: null };

const interactionsSlice = createSlice({
  name: "interactions",
  initialState,
  reducers: {
    setCoordinates(state, action: PayloadAction<[number, number] | null>) {
      state.coordinates = action.payload; // Immer draft mutation — standard RTK
    },
  },
});

export const interactionsActions = interactionsSlice.actions; // named export
export default interactionsSlice.reducer;                     // default export
```

- State shape is an explicit named type (`XxxState`), not inferred.
- Reducers use standard RTK Immer-style mutation (`state.field = value`).
- Data slices carry their own `loading` and `error` fields alongside the data.
- Export actions namespaced (`export const xxxActions = slice.actions`); the
  reducer is the default export, registered in `store.ts`'s `reducer` map.

## API Client

Client functions live in `lib/client.ts`. They are **plain async functions,
not hooks**, named in `PascalCase`:

```ts
// lib/client.ts
export async function GetCloudCover(): Promise<[...]> {
  const res = await fetch("/weather/cloud-cover");
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud cover: ${res.status}`);
  }
  const points: CloudCoverPoint[] = await res.json();
  // ...transform (build GeoJSON, construct ArcGIS layer)...
  return [layer, points];
}
```

- Use `fetch` directly (no axios); use `URLSearchParams` for query strings.
- **Fetch relative paths** (`/weather/...`) — never hardcode the server origin.
  The Vite dev proxy (and eventually the production reverse proxy) routes the
  prefix to the Express server.
- **Throw on non-OK responses**; the calling provider catches and dispatches
  the error state.
- Transformation from API response to app-ready objects (GeoJSON assembly,
  ArcGIS layer construction) belongs here, not in components or providers.

## Types

Shared data shapes live in `lib/types.ts`. Shapes returned by the server
(e.g. `CloudCoverPoint`) **must mirror the server's types field-for-field** — there
is no shared package, so the contract is maintained by hand on both sides.
Component prop types are declared locally as `type PropsT = { ... }`.

## ArcGIS

- Import from `@arcgis/core` ES modules only. Do not use `esri-loader`.
- Static map configuration — renderers, popup templates (and label classes
  etc. as needed) — lives in `lib/arcgis/` as module-scope instances, one
  file per kind.
- Exactly one component (`components/Map.tsx`) touches the imperative ArcGIS
  API. It holds `Map`/`MapView`/layer instances in refs, initializes the view
  once in a mount effect, and reacts to Redux state (layer swaps, `goTo`
  flights) in separate focused effects. Other components interact with the map
  only through Redux (e.g. dispatching coordinates).

## Component Conventions

**Use early-return guards before the main render. Never use ternaries for
loading/error/empty states at the top level:**

```tsx
export const Clouds = () => {
  const loading = useAppSelector((state) => state.weather.loading);
  const error = useAppSelector((state) => state.weather.error);

  if (loading) return <span className="loading loading-spinner" />;
  if (error) return <div className="text-error p-4">{error}</div>;

  return ( /* main render */ );
};
```

- Components read from Redux directly via `useAppSelector`. Don't thread props
  down for data that lives in the store.
- Local `useState` is fine for ephemeral UI state (search text, toggles).
- Use `Link`/`NavLink` from `react-router` for navigation.

## Import Ordering

Group imports with a single-line comment label. Order:

```tsx
// React
// Router
// Hooks
// Store
// Client
// ArcGIS
// Types
// Styles
// Providers
// Components
```

Use only the groups that apply. No blank lines between items within a group;
one blank line between groups. Cross-module imports use the `@/` alias;
same-folder imports use relative paths.

## Styling — Tailwind v4 + DaisyUI

- Tailwind is loaded as a Vite plugin; there is no `tailwind.config.js`.
- Use DaisyUI semantic classes for components (`btn`, `navbar`, `drawer`,
  `menu`, `collapse`, `input`, `loading`) and prefer semantic color tokens
  (`bg-base-200`, `text-error`) over hardcoded colors so theming keeps working.
- Layout uses Tailwind utility classes (`grid`, `flex`, `h-full`, `p-4`).
- Prose blocks use `@tailwindcss/typography`'s `prose` class.

## Testing — Vitest

`yarn test` (watch) / `yarn vitest run` (once). Config lives in the `test`
block of `vite.config.ts` (`environment: "jsdom"`, `globals: true`) — globals
are on, so `describe`/`it`/`expect`/`vi` need no import. `vitest/globals` is in
`tsconfig.app.json`'s `types`.

```
src/tests/
  utils.tsx                  # createTestStore() + renderWithStore() helper
  client.test.ts             # transform: fetch → GeoJSON → layer
  weather-slice.test.ts      # reducer cases
  interactions-slice.test.ts # reducer cases
  WeatherProvider.test.tsx   # provider → store integration
  Clouds.test.tsx            # component integration (RTL)
  Map.test.tsx               # component integration, ArcGIS faked
```

- All tests go in `src/tests/` with the `.test.ts` / `.test.tsx` suffix — do
  not co-locate tests next to source files. Non-test helpers live there too
  (`utils.tsx`); Vitest's default `include` only picks up `*.test.*`.
- Priorities (testing trophy): pure logic and data transforms first (client
  transform functions, selectors), then Redux reducer cases (call the reducer
  directly — don't mount a store), then component integration tests with
  React Testing Library as the app grows.
- Each `it` tests exactly one behavior.
- **Never test against the singleton store** — `createTestStore()` in
  `tests/utils.tsx` builds a fresh one per test (mirroring `store.ts`'s
  config) so state can't leak between tests. `renderWithStore(ui, store)`
  wraps it in a `<Provider>` via RTL's `wrapper` option (so `rerender` keeps
  the provider) and returns the store for assertions.
- Components read the store, so **drive them through it**: dispatch real
  actions and assert on rendered output or on resulting state. Dispatches
  after `render` must be wrapped in `act()` or React won't flush the effects.
- Assert with plain `expect` — `@testing-library/jest-dom` is not installed
  (`expect(container.innerHTML).toBe("")`, not `toBeEmptyDOMElement()`).
- Fake `@arcgis/core` modules with `vi.mock` — the real ones need a WebGL
  context. `Map.test.tsx` shows the pattern: fake classes that record their
  instances via `vi.hoisted`, asserted through spied `add`/`remove`/`goTo`.
- ESLint has no underscore-ignore rule; an unused mock parameter is an error.
  Put the signature in `vi.fn`'s type argument instead:
  `vi.fn<(blob: Blob) => string>(() => "blob:mock")`.

## ESLint & Prettier

- ESLint flat config: `js.configs.recommended` + `typescript-eslint`
  recommended + `react-hooks` + `react-refresh`. Run `yarn lint` before
  committing.
- Prettier (`prettierrc.yaml`): 80-char width, 2-space indent, double quotes,
  semicolons, trailing commas (ES5), always-parens arrows.
- TypeScript enforces `noUnusedLocals` / `noUnusedParameters` — no dead code.

---

# Backend — `/server`

## Stack

| Tool       | Notes                                                        |
| ---------- | ------------------------------------------------------------ |
| Express    | 5 — routers per domain, JSON responses                       |
| TypeScript | 6, `strict` — **CommonJS** (`module: commonjs`), unlike /app |
| ts-node    | Runs `src/` directly in dev via nodemon                      |
| nodemon    | `nodemon.json` watches `src/**/*.ts`                         |

Dependencies are intentionally minimal: `express`, `cors`, `dotenv` — nothing
else. No ORM, no database, no framework layers. Use node built-ins
(`fs/promises`, `path`) for IO. Adding a dependency requires a reason these
can't cover.

Scripts: `yarn dev` (nodemon), `yarn docker` (nodemon -L, used in Compose),
`yarn build` (tsc → `dist/`), `yarn start`.

## Directory Structure

```
server/src/
  index.ts                 # App setup: middleware, router mounts, listen
  routers/                 # One Express router per URL prefix (weather.ts)
  lib/
    services/              # Data access classes + singleton exports (weather.ts)
    data/                  # (optional) on-disk JSON datasets read by services
  tests/                   # All test files (.test.ts)
```

## Entry Point

`index.ts` does four things only — create the app, apply middleware, mount
routers, listen:

```ts
// server/src/index.ts
const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/weather", weather);

app.get("/healthcheck", (req: Request, res: Response) => {
  res.send("Hello, world!");
});

app.listen(port, () => { ... });
```

- Configuration comes from `process.env` with sensible defaults (`PORT`,
  fallback 3000); bind to `0.0.0.0` so Docker port mapping works.
- Keep `/healthcheck` intact.
- No route logic in `index.ts` — only mounts.

## Routers

One router file per URL prefix in `src/routers/`, exporting a **named**
`express.Router()` that `index.ts` mounts:

```ts
// server/src/routers/weather.ts
export const weather = express.Router();

weather.get("/cloud-cover", async (req: Request, res: Response) => {
  try {
    const points = await Forecast.cloudCover();
    res.send(points);
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
```

- Handlers are thin: call a service method, send the result.
- Every async handler wraps its body in `try/catch` and returns a 500 on
  failure — never let a rejection escape. Serialize `error.message` (a raw
  `Error` JSON-serializes to `{}`).
- No data access or business logic in routers — that lives in services.

## Services

Data access lives in `src/lib/services/` as a **class plus a singleton
instance export** (the class carries the logic; the singleton carries the
cache):

```ts
// server/src/lib/services/weather.ts
export class WeatherService {
  private readonly lats: number[] = []; // CONUS sample grid, built once
  private readonly lons: number[] = [];
  private cloudCache: {
    points: CloudCoverPoint[];
    fetchedAt: number;
  } | null = null;

  async cloudCover(): Promise<CloudCoverPoint[]> {
    if (
      this.cloudCache &&
      Date.now() - this.cloudCache.fetchedAt < CACHE_TTL_MS
    ) {
      return this.cloudCache.points;
    }
    // ...fetch Open-Meteo, map to CloudCoverPoint[], populate cache...
  }
}

export const Forecast = new WeatherService();
```

- Methods return typed, app-ready shapes — upstream fetching, parsing, and
  null-safety happen here, not in routers.
- Third-party API calls happen **only on the server**, inside a service —
  never from the browser (keys, CORS, and caching all live here). Use the
  global `fetch`.
- Cache in a private field; return the cache on repeat calls. Static data
  caches forever; live data caches with a TTL matched to the source's update
  rate (Open-Meteo updates every 15 min → 10-min TTL).
- Response-shape interfaces (e.g. `CloudCoverPoint`) are declared and exported
  from the service file, and must stay in sync with the copy in
  `app/src/lib/types.ts`.
- New data domains get a new method on an existing service, or a new
  class + singleton pair in a new file when the underlying source differs.

## Testing — `node:test`

`yarn test` runs `node --require ts-node/register --test src/tests/*.test.ts`.
The server uses **node's built-in test runner, not Vitest** — it needs no
transform beyond ts-node, and this keeps the dependency list at three. Do not
add Vitest or any other runner here; `/app` and `/server` differ on purpose,
like their module systems.

```
server/src/tests/
  weather-service.test.ts  # grid, mapping, cache TTL, upstream failure
  weather-router.test.ts   # route → JSON, service failure → 500
```

- `node:test` has no globals: import `describe`/`it` from `node:test` and
  `assert` from `node:assert/strict`. Assert with `assert.deepEqual` /
  `assert.equal` / `assert.rejects`.
- Stub with the per-test mocker (`t.mock.method(globalThis, "fetch", ...)`) —
  it restores automatically at test end. `t.mock.timers.enable({ apis: ["Date"]
  })` + `tick()` drives cache-TTL expiry without real waits.
- **Service tests construct a fresh `new WeatherService()`** so the singleton's
  cache can't leak across tests. Router tests are the exception: they mock the
  `Forecast` singleton's method, since that's what the router imports.
- Third-party APIs are never hit for real — always mock `fetch`.
- Router tests bind a throwaway Express app to port 0 (an OS-assigned free
  port), mount just the router under test, and drive it with real `fetch`.
  Close the server in `after`.

## Server Conventions

- Import grouping comments apply here too (`// Express`, `// Middleware`,
  `// Routers`, `// Services`, `// Types`, `// Node`).
- The server is CommonJS — do not add `"type": "module"` or ESM-only
  dependencies.
- Same Prettier conventions as `/app`.

---

## Full-Stack Data Flow

The end-to-end pattern, using the existing feature as the reference:

```
Open-Meteo API → WeatherService (fetch, map, TTL cache) [server/src/lib/services]
             → express.Router GET /weather/cloud-cover   [server/src/routers]
             → Vite dev proxy (/weather → server :3000)  [app/vite.config.ts]
             → GetCloudCover() fetch + transform         [app/src/lib/client.ts]
             → WeatherProvider dispatches to Redux       [app/src/lib/context]
             → components select via useAppSelector      [app/src/app/components]
```

**Proxy wiring:** the app always fetches relative paths, so every server route
prefix must be registered in `server.proxy` in `app/vite.config.ts`. The proxy
target comes from the `SERVER_ORIGIN` env var (default
`http://localhost:3000`; `docker-compose.yaml` sets it to
`http://weatherman-server-service:3000` for the app container). Registering
the prefix is part of finishing any feature that calls the server.

## Adding a Feature — Checklist

1. **Service** — add a typed method (or new service class + singleton) under
   `server/src/lib/services/` that fetches the upstream API (or reads on-disk
   JSON placed under `server/src/lib/data/`).
2. **Router** — add a router in `server/src/routers/` (or extend one); mount
   its prefix in `server/src/index.ts`.
3. **Proxy** — register the route prefix in `server.proxy` in
   `app/vite.config.ts`.
4. **Type** — mirror the response shape in `app/src/lib/types.ts`.
5. **Client** — add a `PascalCase` fetch/transform function to
   `app/src/lib/client.ts` that throws on non-OK.
6. **Slice** — add a slice (with `loading`/`error`) under
   `app/src/lib/store/features/`, register it in `store.ts`.
7. **Provider** — add a `*Provider` in `app/src/lib/context/` that fetches,
   guards, and dispatches; wrap it where its consumers live.
8. **Route + Component** — add the route in `main.tsx` and the page under
   `app/components/`; read from the store with `useAppSelector`, guard with
   early returns.
9. **Tests** — cover the service (mock `fetch`; assert mapping + cache) and
   router in `server/src/tests/`, and the client transform, reducer cases, and
   component behavior in `app/src/tests/`. The cloud-cover feature's tests are
   the reference for each layer.

## Ecosystem Defaults That Do Not Apply Here

These conventions diverge from common tutorials — this project intentionally
does it this way:

- **No `createAsyncThunk` / RTK Query.** Async work lives in data providers
  calling plain client functions.
- **`fetch`, not axios** — on both the client and (if ever needed) the server.
- **Typed hooks only.** Never import `useSelector` / `useDispatch` from
  `react-redux` directly.
- **No `enum`, no `namespace`.** Use `type` unions and plain objects.
- **`@arcgis/core` ES modules, not `esri-loader`.**
- **No database.** The server reads upstream APIs (and on-disk JSON) through
  cached services — don't introduce persistence layers until the data
  outgrows this.
- **Split module systems.** `/app` is ESM, `/server` is CommonJS — don't
  "harmonize" them.
- **Split test runners.** `/app` uses Vitest (it already has the Vite
  pipeline), `/server` uses the built-in `node:test` (it needs no bundler).
  Don't "harmonize" these either.
