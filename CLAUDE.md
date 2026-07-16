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

**Current example feature:** a geospatial "supply chain explorer" — the server
reads company records from JSON on disk and serves them at `/geo/companies`;
the app renders them as an interactive ArcGIS map with search. It is not fully
wired end-to-end yet, but it is the reference implementation of the full-stack
data pattern all future features should follow.

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
| Vitest        | 4       | In devDependencies; tests go in `src/tests/` when added         |

`/app` is an ES module package (`"type": "module"`).

## Directory Structure

```
app/src/
  app/                     # UI layer
    App.tsx                # Layout shell: Navigation + providers + <Outlet />
    main.tsx               # Entry: router config + provider composition
    layout/                # Chrome components (Navigation)
    components/            # Route pages + feature components
                           #   (Landing, Interface, Map, Explorer, Drawer)
    assets/
    index.css / App.css
  lib/                     # Infrastructure — not UI
    client.ts              # Plain async fetch functions (PascalCase names)
    types.ts               # Shared data shapes — mirror server responses
    arcgis/                # Module-scope ArcGIS config objects
      renderers.ts         #   UniqueValueRenderer / SimpleRenderer instances
      labels.ts            #   LabelClass instances
      templates.ts         #   PopupTemplate instances
    context/
      StoreProvider.tsx    # Wraps children with the Redux <Provider>
      PointProvider.tsx    # Data provider: fetches → dispatches to Redux
    store/
      store.ts             # Singleton store + AppStore/RootState/AppDispatch
      hooks.ts             # useAppDispatch/useAppSelector/useAppStore
      features/            # One slice per domain (arcgis.ts, interactions.ts)
  tests/                   # All test files (.test.ts / .test.tsx)
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
// lib/context/PointProvider.tsx
export function PointProvider({ children }: { children: React.ReactNode }) {
  const metadata = useAppSelector((state) => state.maps.PointMetadata);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(mapActions.setLoading(true));
        const [layer, metadata, companies] = await GetCompanies();
        dispatch(mapActions.PointLayers(layer));
        dispatch(mapActions.PointMetadata(metadata));
        dispatch(mapActions.setCompanies(companies));
      } catch (error) {
        dispatch(mapActions.setError(
          error instanceof Error ? error.message : "Failed to load data"
        ));
      } finally {
        dispatch(mapActions.setLoading(false));
      }
    }

    if (!metadata) load(); // guard: skip if already loaded
  }, [metadata, dispatch]);

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
  reducer: { maps: mapsReducer, interactions: interactionsReducer },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({ serializableCheck: false }),
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

`serializableCheck` is disabled **only** because ArcGIS layer instances live in
the store. Keep everything else in the store plain and serializable.

`StoreProvider` wraps children with the react-redux `<Provider>` (holding the
instance in a `useRef`).

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
export async function GetCompanies(): Promise<[...]> {
  const res = await fetch("/geo/companies");
  if (!res.ok) {
    throw new Error(`Failed to fetch companies: ${res.status}`);
  }
  const companies: CompanyPin[] = await res.json();
  // ...transform (build GeoJSON, construct ArcGIS layer)...
  return [layer, geojson, companies];
}
```

- Use `fetch` directly (no axios); use `URLSearchParams` for query strings.
- **Fetch relative paths** (`/geo/...`) — never hardcode the server origin.
  The Vite dev proxy (and eventually the production reverse proxy) routes the
  prefix to the Express server.
- **Throw on non-OK responses**; the calling provider catches and dispatches
  the error state.
- Transformation from API response to app-ready objects (GeoJSON assembly,
  ArcGIS layer construction) belongs here, not in components or providers.

## Types

Shared data shapes live in `lib/types.ts`. Shapes returned by the server
(e.g. `CompanyPin`) **must mirror the server's types field-for-field** — there
is no shared package, so the contract is maintained by hand on both sides.
Component prop types are declared locally as `type PropsT = { ... }`.

## ArcGIS

- Import from `@arcgis/core` ES modules only. Do not use `esri-loader`.
- Static map configuration — renderers, label classes, popup templates — lives
  in `lib/arcgis/` as module-scope instances, one file per kind.
- Exactly one component (`components/Map.tsx`) touches the imperative ArcGIS
  API. It holds `Map`/`MapView`/layer instances in refs, initializes the view
  once in a mount effect, and reacts to Redux state (layer swaps, `goTo`
  flights) in separate focused effects. Other components interact with the map
  only through Redux (e.g. dispatching coordinates).

## Component Conventions

**Use early-return guards before the main render. Never use ternaries for
loading/error/empty states at the top level:**

```tsx
export const Explorer = () => {
  const loading = useAppSelector((state) => state.maps.loading);
  const error = useAppSelector((state) => state.maps.error);

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

Vitest is in devDependencies; no tests exist yet. When adding them:

- All tests go in `src/tests/` with the `.test.ts` / `.test.tsx` suffix — do
  not co-locate tests next to source files.
- Add a `"test": "vitest"` script and the vitest config block (`environment:
  "jsdom"`, `globals: true`) inside `vite.config.ts` with the first test.
- Priorities (testing trophy): pure logic and data transforms first (client
  transform functions, selectors), then Redux reducer cases (call the reducer
  directly — don't mount a store), then component integration tests with
  React Testing Library as the app grows.
- Each `it` tests exactly one behavior.

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
  routers/                 # One Express router per URL prefix (geo.ts)
  lib/
    services/              # Data access classes + singleton exports (disk.ts)
    data/                  # On-disk JSON datasets read by services
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
app.use("/geo", geo);

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
// server/src/routers/geo.ts
export const geo = express.Router();

geo.get("/companies", async (req: Request, res: Response) => {
  try {
    const companies = await DataStore.companies();
    res.send(companies);
  } catch (error) {
    res.status(500).json({ error: error });
  }
});
```

- Handlers are thin: call a service method, send the result.
- Every async handler wraps its body in `try/catch` and returns
  `res.status(500).json({ error })` on failure — never let a rejection escape.
- No data access or business logic in routers — that lives in services.

## Services

Data access lives in `src/lib/services/` as a **class plus a singleton
instance export** (the class carries the logic; the singleton carries the
cache):

```ts
// server/src/lib/services/disk.ts
export class DataService {
  private readonly dataPath: string;
  private companyCache: CompanyPin[] | null = null;

  async read<T = unknown>(filename: string): Promise<T> { ... }

  async companies(): Promise<CompanyPin[]> {
    if (this.companyCache) return this.companyCache;
    // ...read + join JSON files, populate cache...
  }
}

export const DataStore = new DataService();
```

- Methods return typed, app-ready shapes — joining, parsing, and null-safety
  happen here, not in routers.
- Cache expensive reads in a private field; return the cache on repeat calls.
- Response-shape interfaces (e.g. `CompanyPin`) are declared and exported from
  the service file, and must stay in sync with the copy in
  `app/src/lib/types.ts`.
- New data domains get a new method on an existing service, or a new
  class + singleton pair in a new file when the underlying source differs.

## Server Conventions

- Import grouping comments apply here too (`// Express`, `// Middleware`,
  `// Routers`, `// Services`, `// Types`).
- The server is CommonJS — do not add `"type": "module"` or ESM-only
  dependencies.
- Same Prettier conventions as `/app`.

---

## Full-Stack Data Flow

The end-to-end pattern, using the existing feature as the reference:

```
JSON on disk → DataService (read, join, cache)        [server/src/lib/services]
            → express.Router GET /geo/companies        [server/src/routers]
            → Vite dev proxy (/geo → server :3000)     [app/vite.config.ts]
            → GetCompanies() fetch + transform         [app/src/lib/client.ts]
            → PointProvider dispatches to Redux        [app/src/lib/context]
            → components select via useAppSelector     [app/src/app/components]
```

**Proxy wiring:** the app always fetches relative paths, so every server route
prefix must be registered in `server.proxy` in `app/vite.config.ts`, targeting
the Express server (`http://localhost:3000` locally;
`http://weatherman-server-service:3000` inside Compose). The proxy map is
currently empty — wiring it is part of finishing any feature that calls the
server.

## Adding a Feature — Checklist

1. **Service** — add a typed method (or new service class + singleton) under
   `server/src/lib/services/`; put source data under `server/src/lib/data/`.
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
- **No database.** The server reads JSON from disk through cached services —
  don't introduce persistence layers until the data outgrows this.
- **Split module systems.** `/app` is ESM, `/server` is CommonJS — don't
  "harmonize" them.
