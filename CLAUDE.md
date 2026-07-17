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

**The two maps.** The app has two map routes, and the split is editorial, not
cosmetic:

- **`/map/forecast` — modelled.** HRRR cloud cover, contoured server-side into
  nested GeoJSON polygons, with a slider stepping f00–f18. **Satellites cannot
  forecast**, so nothing observed can appear here; this map is entirely model
  output. Contours are used rather than a raster because a raster has no
  nodata — infrared paints warm clear sky opaquely and buries the basemap,
  while a 0%-cloud contour simply isn't drawn.
- **`/map/candidate` — observed.** GOES-East imagery (GeoColor / Band13) plus
  the Open-Meteo grid stats. This is "what is the sky doing right now".

**Current example feature:** national cloud cover, which comes from two
sources with different jobs:

- **Cloud *shape*: GOES-East imagery.** The map shows NASA GIBS WMTS tiles of
  GOES-East ABI — `GeoColor` (true colour by day) and `Band13` clean infrared
  (cloud-top brightness temperature) — switchable from the sidebar. ~2 km
  native, new scene every 10 minutes, no API key. Tiles go browser → GIBS
  directly, like the basemap; they do not pass through our server.
- **Cloud *quantities*: the Open-Meteo grid.** The server samples a ~180-point
  grid across the continental U.S. (cached in-memory) and serves it at
  `/weather/cloud-cover`. It feeds the sidebar stats and the fly-to list —
  **not** the map graphics. It is wired end-to-end (upstream API → service →
  router → proxy → client → Redux → component) and remains the reference
  implementation of the full-stack data pattern all future features should
  follow.

**Why the split:** the grid is 3° spacing — ~300 km between samples, ~85,000
km² per point. Cloud structure lives at 1–50 km, so interpolating that grid
into a surface would draw shapes the data never measured. On a tool that
decides whether to launch a drone, that is not an acceptable picture. Sampled
model values answer "how much, on average"; only imagery answers "what shape,
where". Do not render the grid as a continuous field. (An earlier version drew
it as scaled/coloured point markers; that was replaced by the imagery, and an
earlier "supply chain explorer" example was removed as dead code — see git
history.)

**The rule is not "never draw surfaces"** — it is *don't draw structure finer
than your sampling*. Compare the variable's correlation length to the sample
spacing before drawing any new field: cloud shape (1–50 km) may not be
contoured from a 3° grid, but HRRR's native 3 km cloud cover may, and isotherm
height (~1000 km, synoptic) would be honest even on the coarse grid.
Block-averaging 3 km → 12 km *removes* structure and is fine; interpolating
300 km → 12 km *invents* it and is not. `MEASUREMENTS.md` §5 has the table.

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
  MEASUREMENTS.md            # Candidate data sources for future layers
```

`MEASUREMENTS.md` is a **decision document, not a description of the code** —
it surveys the free national feeds against the seedability criteria and
records which layers we might build next. Read it before adding a data
source; it already documents which ones are dead ends and why.

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
                           #   (Landing, Forecast, Candidate, Map, Clouds,
                           #    CloudLayers, TimeSlider, Drawer)
    assets/
    index.css / App.css
  lib/                     # Infrastructure — not UI
    client.ts              # Plain async fetch functions (PascalCase names)
    types.ts               # Shared data shapes — mirror server responses
    arcgis/                # Module-scope ArcGIS config objects
      layers.ts            #   GOES WebTileLayer instances + GoesLayers map,
                           #   ForecastCloudsLayer (GeoJSONLayer)
      legends.ts           #   Legend data per layer (ramp, ticks, caveat)
      renderers.ts         #   CLOUD_BANDS + the forecast contour renderer
    context/
      StoreProvider.tsx    # Wraps children with the Redux <Provider>
      WeatherProvider.tsx  # Data provider: fetches → dispatches to Redux
      ForecastProvider.tsx # Data provider: HRRR run metadata
    store/
      store.ts             # Singleton store + AppStore/RootState/AppDispatch
      hooks.ts             # useAppDispatch/useAppSelector/useAppStore
      features/            # One slice per domain (weather.ts, interactions.ts,
                           #   forecast.ts)
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
      // Page-scoped data: the provider wraps just this route's element.
      {
        path: "/map/forecast",
        element: (
          <ForecastProvider>
            <Forecast />
          </ForecastProvider>
        ),
      },
      { path: "/map/candidate", element: <Candidate /> },
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
- **Page routes live under `/map/…`; server prefixes live at the root.** The
  dev proxy forwards every `/forecast*` request to Express, so a *page* at
  `/forecast` gets swallowed by the API and the browser renders Express's
  "Cannot GET /forecast". Keep the two namespaces apart.
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
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

The store holds **only plain, serializable data** — RTK's `serializableCheck`
is on, at its default. ArcGIS objects must never go in it: layers are
module-scope singletons in `lib/arcgis/layers.ts`, and the store holds the
`CloudLayerId` string naming which one is active. (An earlier version put a
`GeoJSONLayer` in the store and had to disable `serializableCheck` for it;
don't reintroduce that.)

**Bulk geometry stays out of the store too.** A forecast frame is ~1.4 MB of
contours; 19 of them would be ~27 MB, and `serializableCheck` deep-walks state
on every dispatch. So `ForecastCloudsLayer` is pointed at
`/forecast/clouds?hour=N` and fetches the frame itself — the store holds only
the `hour`. Same reasoning as the GIBS carve-out: what the store carries is
the *selection*, not the payload.

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
export async function GetCloudCover(): Promise<CloudCoverPoint[]> {
  const res = await fetch("/weather/cloud-cover");
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud cover: ${res.status}`);
  }
  const points: CloudCoverPoint[] = await res.json();
  return points;
}
```

- Use `fetch` directly (no axios); use `URLSearchParams` for query strings.
- **Fetch relative paths** (`/weather/...`) — never hardcode the server origin.
  The Vite dev proxy (and eventually the production reverse proxy) routes the
  prefix to the Express server.
- **Throw on non-OK responses**; the calling provider catches and dispatches
  the error state.
- Any transformation from API response to app-ready objects belongs here, not
  in components or providers. `GetCloudCover` currently needs none — it returns
  the server's shape as-is.

## Types

Shared data shapes live in `lib/types.ts`. Shapes returned by the server
(e.g. `CloudCoverPoint`) **must mirror the server's types field-for-field** — there
is no shared package, so the contract is maintained by hand on both sides.
Component prop types are declared locally as `type PropsT = { ... }`.

## ArcGIS

- Import from `@arcgis/core` ES modules only. Do not use `esri-loader`.
- Static map configuration — layer instances, legend data (and renderers,
  popup templates etc. if markers ever return) — lives in `lib/arcgis/` as
  module-scope instances, one file per kind.
- Exactly one component (`components/Map.tsx`) touches the imperative ArcGIS
  API. It holds `Map`/`MapView` in refs, initializes the view once in a mount
  effect, and reacts to Redux state (layer visibility, `goTo` flights) in
  separate focused effects. Other components interact with the map only
  through Redux (e.g. dispatching coordinates or a `CloudLayerId`).
- Both GOES layers are added to the map once and toggled via `.visible`, so
  switching does not refetch tiles. Visibility is derived from the store in
  one effect — never set `visible` from anywhere else.

### GIBS tile layers

GIBS publishes each layer only to a fixed maximum zoom (its matrix set:
`GoogleMapsCompatible_Level7` = zoom 0–7, `Level6` = 0–6). One level past that
the endpoint returns **400**, not an empty tile. So every GOES layer must cap
its `tileInfo` LODs to match its matrix set:

```ts
tileInfo: TileInfo.create({ size: 256, numLODs: 8 }), // Level7 -> LODs 0..7
```

Past the last LOD ArcGIS stretches the deepest tiles instead of requesting
ones that don't exist. `tests/layers.test.ts` pins each cap; if you add a GOES
layer, check its matrix set in the capabilities document and pin it too:
`https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml`
(5 MB; needs redirect-following).

Legend colours must come from the layer's published GIBS colour map, linked in
that layer's `<ows:Metadata>` — never eyeballed from a screenshot. Band13's is
`Clean_Longwave_Infrared_Window_Band.xml` (brightness temperature in °C, -92
to +57).

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

**The app is dark, and the theme is pinned to it** in `src/app/index.css`:

```css
@plugin "daisyui/index.js" {
  themes: dark --default;
}
```

This is load-bearing. The chrome hardcodes `bg-black` and the ArcGIS dark
theme is imported, so if DaisyUI falls back to its light default,
`text-base-content` resolves to dark text painted onto black and the sidebar
becomes unreadable. Don't remove the pin, and don't "fix" contrast by
hardcoding text colours on top of it — that just hides the theme break.

## Testing — Vitest

`yarn test` (watch) / `yarn vitest run` (once). Config lives in the `test`
block of `vite.config.ts` (`environment: "jsdom"`, `globals: true`) — globals
are on, so `describe`/`it`/`expect`/`vi` need no import. `vitest/globals` is in
`tsconfig.app.json`'s `types`.

```
src/tests/
  utils.tsx                  # createTestStore() + renderWithStore() helper
  client.test.ts             # fetch + throw-on-non-OK
  weather-slice.test.ts      # reducer cases
  interactions-slice.test.ts # reducer cases
  forecast-slice.test.ts     # reducer cases
  layers.test.ts             # GIBS URLs + LOD caps per matrix set
  legends.test.ts            # ramp anchors, tick + seeding-band positions
  renderers.test.ts          # CLOUD_BANDS contract + stacked alpha maths
  WeatherProvider.test.tsx   # provider → store integration
  ForecastProvider.test.tsx  # provider → store integration
  Clouds.test.tsx            # component integration (RTL)
  CloudLayers.test.tsx       # switcher + legend rendering
  TimeSlider.test.tsx        # slider range, valid-time arithmetic, states
  Map.test.tsx               # component integration per mode, ArcGIS faked
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
  instances via `vi.hoisted`, asserted through spied `goTo` and `visible`
  flags. It fakes `@/lib/arcgis/layers` too; `layers.test.ts` covers the real
  layer objects, which construct fine in jsdom.
- **Assert the numbers a legend is derived from, not just its labels.** A test
  that only reads the caption "−12 to −5 °C" passes even when the bracket is
  drawn in the wrong place — `legends.test.ts` pins the percentages instead.
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

**One system dependency: `libeccodes-tools`**, installed via `apt-get` in
`Dockerfiles/Dockerfile.local`. `ForecastService` shells out to its
`grib_get_data` to read HRRR GRIB2. It is deliberately *not* an npm package —
the npm list stays at three. Decoding GRIB2 by hand would be ~200 lines of
bit-unpacking we'd own; eccodes is ECMWF's own tool and is in Debian main.
(wgrib2, the more famous equivalent, has **no Debian package at all** and
would need a source build with gfortran.) Reasoning and alternatives:
`MEASUREMENTS.md` §6.

**If the forecast route 500s with `spawn grib_get_data ENOENT`, the image is
stale — rebuild it** (`docker-compose up --build`). Source is bind-mounted so
TypeScript changes hot-reload, but the apt layer does not.

Scripts: `yarn dev` (nodemon), `yarn docker` (nodemon -L, used in Compose),
`yarn build` (tsc → `dist/`), `yarn start`.

## Directory Structure

```
server/src/
  index.ts                 # App setup: middleware, router mounts, listen
  routers/                 # One Express router per URL prefix
                           #   (weather.ts, forecast.ts)
  lib/
    services/              # Data access classes + singleton exports
                           #   (weather.ts → Forecast, forecast.ts → Hrrr)
    data/                  # (optional) on-disk JSON datasets read by services
  tests/                   # All test files (.test.ts)
```

Note the singleton names: `weather.ts` exports `Forecast` (the Open-Meteo
grid) and `forecast.ts` exports `Hrrr` (the HRRR contours). Confusing, but
`Forecast` was there first and is the reference feature's name.

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
  forecast-service.test.ts # marching squares (holes, edges), run discovery
  forecast-router.test.ts  # route → GeoJSON, hour passthrough, 500s
```

- `forecast-service.test.ts` drives `polygons()` with hand-built grids (a solid
  blob, a donut, disjoint blobs, a blob flush against the edge) rather than
  real GRIB — the contouring is pure and needs no network or eccodes. Assert
  *geometry*, not ring counts: that a donut yields **one polygon with two
  rings** is the thing that breaks, and it renders as solid cloud when it does.

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
             → GetCloudCover() fetch                     [app/src/lib/client.ts]
             → WeatherProvider dispatches to Redux       [app/src/lib/context]
             → components select via useAppSelector      [app/src/app/components]
```

The forecast feature follows the same path with one deliberate deviation — the
frames are too big for the store, so only the *metadata* rides the full
pattern and the geometry goes straight to the layer:

```
NOMADS HRRR .idx → byte-range GRIB2 subset (~930 KB of a 390 MB file)
             → grib_get_data (eccodes) → block-average 3 km → 12 km
             → marching squares + hole nesting            [lib/services/forecast.ts]
             → GET /forecast/clouds?hour=N                [routers/forecast.ts]
             → ForecastCloudsLayer.url                    [lib/arcgis/layers.ts]

GET /forecast/meta → GetForecastMeta() → ForecastProvider → forecast slice
                   → TimeSlider selects `hour` → Map.tsx repoints the layer
```

A given run+hour never changes, so `ForecastService` caches frames forever and
evicts only when the run rolls (~5 s cold, ~0 ms warm). Concurrent requests for
the same frame collapse onto one download.

Map **imagery** deliberately does not follow this path — tile layers stream
browser → GIBS directly, exactly as the ArcGIS basemap does. The "third-party
calls only on the server" rule exists for keys, CORS and caching; a keyless
public tile service has none of those problems, and proxying every tile
through Express would only add latency. Anything that returns **data** (JSON
we parse, cache, or reshape) still goes through a service.

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
10. **Run it** — start both services and drive the actual page before calling
    it done. The suites fake ArcGIS and the network, so they cannot tell you
    whether imagery painted, a URL 404s, or text is invisible against the
    background. Every one of those has bitten this feature.

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
