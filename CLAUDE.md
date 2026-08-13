# Weatherman: A Full-Stack Template

## What This Is

A full-stack TypeScript application at an early scaffolding stage: a React SPA
in `/app` and an Express API in `/server`, orchestrated with Docker Compose.

**Product context:** Weatherman is the operator-facing software for a
field-deployable cloud-seeding weather station (part of the Rainmaker project).
The station fuses local sensor data with free national feeds (NEXRAD, GOES,
HRRR) into a single _seedability_ verdict — is there supercooled liquid water
in the seeding band worth sending a drone to, and did seeding work? The
system design lives outside this repo at `/home/nathan/code/rainmaker/weatherman`
(see its `README.md` and `docs/`). This web app will become the operator
dashboard for that station.

**The three map routes.** Two of them differ editorially, not cosmetically; the
third is the same layers at a different hour:

- **`/map/forecast` — modelled.** HRRR cloud cover, contoured server-side into
  nested GeoJSON polygons, with a slider stepping f00–f18. **Satellites cannot
  forecast**, so nothing observed can appear here; this map is entirely model
  output.
- **`/map/candidate` — observed.** Four layers, and they are not the same kind
  of claim. Bottom to top: HRRR cloud base (_modelled_, off by default), GOES-East
  cloud-top temperature (_observed_ cloud tops), the HRRR supercooled-liquid
  contours for the analysis hour (_modelled_ — the deliberate exception, and the
  sidebar says so), and the MRMS radar mosaic (_measured_, and the only
  measurement on either map). Clicking anywhere profiles that point's column and
  reads that cell's convective diagnostics. This is "what is the sky doing right
  now, and how high".

  **Cloud base sits at the bottom because it is the question asked first** — can
  an aircraft climb into this cloud at all — and the other three are answers
  about a cloud you can reach. It is the only layer here that starts hidden: a
  fourth fill switched on by default lands on three an operator already reads.

- **`/map/replay` — the candidate map at an hour you pick.** Its three layers,
  rebuilt from that hour's own sources: the HRRR cycle initialised then,
  and the satellite and radar scans nearest it. The left panel is a calendar and
  nothing else — no stats blocks, because a replay with four unjoined readouts is
  the candidate map with a different clock on it, and the panel is being kept
  clear for the candidate field that will earn it.

  **Nothing is drawn until every source has answered.** The three take 10 s to
  40 s and do not finish together, so revealing each as it landed put two dates
  on the map at once. `ReplayProvider` awaits all three _stats_ routes — which
  build the same cached scenes the geometry routes serve — and only then does
  the store's `ready` move and the layers point at the hour. Picking a date
  clears `ready`, which blanks the map immediately rather than leaving the old
  hour under a new date. Warming the three in parallel takes ~43 s against ~87 s
  sequentially, and the geometry that follows is cache-warm (<0.5 s each), which
  is what makes the layers appear together.

  **Its layers are separate ArcGIS instances**, not the candidate map's pointed at
  a date. Sharing them would leave a 2025 url on the live map, and the bug would
  read as a caching failure rather than a shared object. The live candidate layers
  are explicitly hidden in replay mode for the same reason: showing today's scene
  under a past date is the one thing this page must never do.

  **There is no raster on any of these maps, and none may be added.** An image has
  no nodata: it paints clear sky opaquely and buries the basemap. Every layer is
  GeoJSON from our own server.

**The layers, and what each is for:**

- **Cloud _shape_ and _top temperature_: GOES-East, decoded server-side.**
  `ABI-L2-ACHP2KMC` — cloud-top **pressure**, CONUS, 2 km, 4.1 MB a scene, a new
  scene every 5 minutes, keyless on `noaa-goes19`. It is NetCDF4/HDF5, read with
  `h5wasm`, reprojected from the ABI fixed grid onto the same 12 km grid
  everything else here contours on, and turned into a temperature using HRRR's
  profile at that pressure.
  **This is the one layer built from two sources**, and the split is deliberate:
  HRRR nails the thermodynamic profile and is much shakier on cloud, so the
  satellite says _where the top is_ and the model says _how cold it is there_.
  That also makes it the only cloud layer that can contradict the
  supercooled-liquid contours drawn over it.
  It has **real nodata** — where the satellite sees no cloud, nothing is drawn.
  And it is **filtered to C2**: only tops at −5 °C or colder appear, because a
  warmer top means the seeding band lies above the cloud entirely, which
  accounts for most cloudy ground over a Texas year. The bands are **disjoint,
  not nested** — see `bandFeatures` in `contour.ts`, and `MEASUREMENTS.md` §4
  for why there is no cold cutoff.
- **Cloud _phase and quantity_: HRRR.** Cloud cover and precipitation on the
  forecast map, supercooled liquid water and the point sounding on the
  candidate map — all decoded from GRIB2 server-side and contoured. See
  "Full-Stack Data Flow".
- **Cloud _base_, and the convective diagnostics: HRRR's `wrfsfc`**, the file the
  cloud-cover and precipitation layers already download. `HGT:cloud base` is the
  variable Texas practice selects on, banded on the **4,000–12,000 ft window**
  the state's published description names — a cited figure, drawn and reported,
  never used to filter. It has **real nodata**, and its bands are **disjoint**
  for a reason the ramp shape has to carry: the field is a window with a wrong
  side at each end, not a magnitude. Below it is fog, above it is usually the
  base of a cirrus deck with clear air underneath.
  **Depth is not drawn.** `HGT:cloud top` is diagnosed over far less ground than
  the base is, so a depth layer would vanish over most of the cloud the base
  layer shows; depth and C2 are answered at the clicked point instead, and the
  map's cloud top comes from the satellite. The rest of the file's
  diagnostics — CAPE, storm motion, lightning, vertically integrated liquid,
  echo top — ride the same build as **attributes on that point readout**, and
  nothing gates on them.
- **Rain: MRMS.** The observed check on all of it.

**Why the split:** the satellite answers "what shape, where, and how cold on
top"; the model answers "how much, of what, at what temperature _inside_".
Neither substitutes for the other, and **no sampled field is ever interpolated
past what it measured.**

**The rule is not "never draw surfaces"** — it is _don't draw structure finer
than your sampling_. Compare the variable's correlation length to the sample
spacing before drawing any new field: cloud shape (1–50 km) may not be
contoured from a 3° grid, but HRRR's native 3 km cloud cover may, and isotherm
height (~1000 km, synoptic) would be honest even on the coarse grid.
Block-averaging 3 km → 12 km _removes_ structure and is fine; interpolating
300 km → 12 km _invents_ it and is not. `MEASUREMENTS.md` §3 has the table.

**A source too sparse to pass that test is drawn as points, and only points** —
colour banding in a marker ramp instead of a fill, each marker where the
observation was, and nothing interpolated between them. Every layer currently in
the app is a contoured field, so there is no in-repo example to copy; build the
point shape from the source's own sampling rather than adapting a contour layer.

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
  MEASUREMENTS.md            # Physics and sampling limits on any layer
```

`MEASUREMENTS.md` holds the **standing constraints**, not a description of the
code: what the free national feeds can and cannot answer, and the sampling rule
that decides whether a proposed layer is honest at all. Read it before adding a
data source — most of it rules things out.

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

| Tool          | Version | Notes                                                         |
| ------------- | ------- | ------------------------------------------------------------- |
| React         | 19      | StrictMode always on                                          |
| TypeScript    | 6       | `strict`, `noUnusedLocals`, `noUnusedParameters`              |
| Vite          | 8       | Path alias `@` → `src/`; dev proxy routes API calls to server |
| React Router  | 7       | `createBrowserRouter`, data router                            |
| Redux Toolkit | 2       | `configureStore` + `createSlice`                              |
| ArcGIS SDK    | 5       | `@arcgis/core` ES modules only — never `esri-loader`          |
| Tailwind CSS  | 4       | Vite plugin — no `tailwind.config.js`                         |
| DaisyUI       | 5       | Semantic component classes + theme tokens                     |
| Vitest        | 4       | + React Testing Library; all tests in `src/tests/`            |

`/app` is an ES module package (`"type": "module"`).

## Directory Structure

```
app/src/
  app/                     # UI layer
    App.tsx                # Layout shell: Navigation + providers + <Outlet />
    main.tsx               # Entry: router config + provider composition
    layout/                # Chrome components (Navigation)
    components/            # Route pages + feature components
                           #   Pages:   Landing, Forecast, Candidate, Replay
                           #   Map:     Map
                           #   Panels:  ForecastLayers, CandidateLayers,
                           #            ReplayLayers, ReplayCalendar,
                           #            ReplayStatus,
                           #            CloudBase, CloudTop, Convective,
                           #            Liquid, Radar, Sounding,
                           #            TimeSlider, Drawer
                           #   Legends: Ramp, CloudTopRamp, CloudBaseRamp
                           #   Shared:  LayerToggle (switch + its legend)
    assets/
    index.css / App.css
  lib/                     # Infrastructure — not UI
    client.ts              # Plain async fetch functions (PascalCase names)
    types.ts               # Shared data shapes — mirror server responses
    arcgis/                # Module-scope ArcGIS config objects
      layers.ts            #   CandidateCloudTopLayer, CandidateCloudBaseLayer,
                           #   the HRRR and MRMS contour GeoJSONLayers, and the
                           #   Replay* trio
      legends.ts           #   Legend data per layer (ramp, ticks, caveat)
      renderers.ts         #   Contour BANDS + the two disjoint band sets
                           #   (CLOUD_TOP_BANDS, CLOUD_BASE_BANDS) + renderers
    context/
      StoreProvider.tsx    # Wraps children with the Redux <Provider>
      ForecastProvider.tsx # Data provider: HRRR run metadata
      CandidateProvider.tsx# Data provider: supercooled-liquid stats (app-wide)
      CloudBaseProvider.tsx# Data provider: HRRR cloud-base stats (page-scoped);
                           #   warms the build the point diagnostics share
      CloudTopProvider.tsx # Data provider: GOES cloud-top stats (page-scoped)
      RadarProvider.tsx    # Data provider: radar scene stats (page-scoped)
      SoundingProvider.tsx # Data provider: point profile; refetches on click
      ReplayProvider.tsx   # Data provider: warms all three replayed sources
                           #   before the map may draw any of them
    store/
      store.ts             # Singleton store + AppStore/RootState/AppDispatch
      hooks.ts             # useAppDispatch/useAppSelector/useAppStore
      features/            # One slice per domain (forecast.ts, candidate.ts,
                           #   cloudbase.ts, cloudtop.ts, radar.ts, replay.ts,
                           #   sounding.ts, interactions.ts)
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
      // Page-scoped providers stack around the one route that needs them.
      { path: "/map/candidate",
        element: /* CloudBase > CloudTop > Radar > Sounding */ ... },
      // The replay provider warms all three of that hour's sources before the
      // map is allowed to draw any of them.
      { path: "/map/replay", element: <ReplayProvider><Replay /></ReplayProvider> },
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
  dev proxy forwards every `/forecast*` request to Express, so a _page_ at
  `/forecast` gets swallowed by the API and the browser renders Express's
  "Cannot GET /forecast". Keep the two namespaces apart.
- `App.tsx` is only for layout chrome (navigation, wrappers) plus data
  providers that child routes need. It renders `<Outlet />` for child routes.

## Data Providers

A data provider fetches external data and syncs it into Redux. It **wraps its
children** and renders no UI of its own:

```tsx
// lib/context/RadarProvider.tsx
export function RadarProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.radar.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(radarActions.setLoading(true));
        const stats = await GetRadarStats();
        dispatch(radarActions.setStats(stats));
      } catch (error) {
        dispatch(
          radarActions.setError(
            error instanceof Error ? error.message : "Failed to load data",
          ),
        );
      } finally {
        dispatch(radarActions.setLoading(false));
      }
    }

    if (!stats) load(); // guard: skip if already loaded
  }, [stats, dispatch]);

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
`CloudLayerId` string naming which one is active. Putting a `GeoJSONLayer` in
the store forces `serializableCheck` off, which is not an acceptable trade.

**Bulk geometry stays out of the store too.** A forecast frame is ~1.4 MB of
contours; 19 of them would be ~27 MB, and `serializableCheck` deep-walks state
on every dispatch. So `ForecastCloudsLayer` is pointed at
`/forecast/clouds?hour=N` and fetches the frame itself — the store holds only
the `hour`. Every contoured layer works this way — the cloud-top bands are
~800 KB and go straight to `CandidateCloudTopLayer` too, while only the summary
rides the store. What the store carries is the _selection_ and the _summary_,
never the payload.

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
export default interactionsSlice.reducer; // default export
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
export async function GetRadarStats(): Promise<RadarStats> {
  const res = await fetch("/radar/reflectivity/stats");
  if (!res.ok) {
    throw new Error(`Failed to fetch radar mosaic: ${res.status}`);
  }
  const stats: RadarStats = await res.json();
  return stats;
}
```

- Use `fetch` directly (no axios); use `URLSearchParams` for query strings.
- **Fetch relative paths** (`/radar/...`) — never hardcode the server origin.
  The Vite dev proxy (and eventually the production reverse proxy) routes the
  prefix to the Express server.
- **Throw on non-OK responses**; the calling provider catches and dispatches
  the error state.
- Any transformation from API response to app-ready objects belongs here, not
  in components or providers. Most functions here need none — the services
  already return app-ready shapes — but `GetSounding` is the exception worth
  copying: the app holds a point as `[lon, lat]` because that is what an ArcGIS
  click hands back, and the server takes `lat`/`lon`, so the swap happens here,
  once, rather than at every call site.

## Types

Shared data shapes live in `lib/types.ts`. Shapes returned by the server
(e.g. `RadarStats`) **must mirror the server's types field-for-field** — there
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
- Every layer is added to the map once and toggled via `.visible`, so switching
  routes does not refetch. Visibility is derived from the store in one effect —
  never set `visible` from anywhere else.

### Two shapes of polygon layer, and when to use which

Both are GeoJSON from our own server, and the difference is not cosmetic:

- **Nested contours** (`features()` server-side, stacked `Ramp` in the panel).
  Cloud cover, precipitation, supercooled liquid water, reflectivity. An area
  meeting the top level is painted by every band, so the fills composite and
  each one stays faint. Use this when the field's extremes are rare and "more"
  genuinely means "more".
- **Disjoint bands** (`bandFeatures()` server-side, unstacked ramp in the
  panel). Cloud-top temperature, cloud base. Exactly one band applies to a cell
  and nothing composites, so each swatch is the literal fill and the legend
  reads them straight.

**Check the coverage of each level before choosing.** Nesting only works where
the extremes are rare. If every level covers a similar share of the grid, the
bands are four rings almost on top of each other and paint a third of the map at
full opacity. Cloud-top temperature is bimodal — warm low cloud, or very cold
cirrus, little between — which nesting cannot express, so it uses disjoint
bands. Cloud base is bimodal the same way, and worse for nesting: it is a
**window**, so "lower" is better only until it becomes fog.

A third shape exists for sparse point sources: discrete classes on a marker
ramp. Nothing in the app needs it now — see the sparse-source rule near the top.

**The opacity ramp is not always quiet-to-loud, and is not always a ramp.**
Cloud-top temperature runs backwards — warmest band loudest — because the warm
end is the target and the cold end is cirrus covering most of the sky. Cloud
base runs neither way: the lit band is the one in the middle, because the field
is a window with a wrong side at each end. `renderers.test.ts` pins both
directions. Take the shape from what the field means, not from a house style.

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
  client.test.ts             # fetch + throw-on-non-OK, one block per route
  interactions-slice.test.ts # reducer cases
  forecast-slice.test.ts     # reducer cases
  candidate-slice.test.ts    # reducer cases
  radar-slice.test.ts        # reducer cases
  sounding-slice.test.ts     # reducer cases, incl. clearing on a new point
  layers.test.ts             # layer URLs + schemas, cloud-top + radar contracts
  cloudtop-slice.test.ts     # reducer cases
  CloudTopProvider.test.tsx  # provider → store integration
  CloudTop.test.tsx          # sidebar stats, incl. the cloud-free scene
  cloudbase-slice.test.ts    # reducer cases, incl. starting hidden
  CloudBaseProvider.test.tsx # provider → store integration
  CloudBase.test.tsx         # sidebar stats, incl. the cloud-free domain
  Convective.test.tsx        # point diagnostics, and C2's three answers
  legends.test.ts            # ramp anchors, tick + seeding-band positions
  renderers.test.ts          # BANDS contracts, stacked alpha, solo vs stacked
  ForecastProvider.test.tsx  # provider → store integration
  CandidateProvider.test.tsx # provider → store integration
  RadarProvider.test.tsx     # provider → store integration
  SoundingProvider.test.tsx  # provider → store, incl. refetch on a new point
  ForecastLayers.test.tsx    # toggles + legend rendering
  CandidateLayers.test.tsx   # toggles + both kinds of legend
  Liquid.test.tsx            # sidebar stats, incl. the "nothing to seed" case
  Radar.test.tsx             # sidebar stats, incl. coverage and a quiet scene
  Sounding.test.tsx          # altitudes, incl. below-ground and no-band cases
  TimeSlider.test.tsx        # slider range, valid-time arithmetic, states
  Map.test.tsx               # component integration per mode, ArcGIS faked
  replay-slice.test.ts       # reducer cases, incl. blanking on a new hour
  ReplayCalendar.test.tsx    # month grid, UTC arithmetic, disabled bounds
  ReplayProvider.test.tsx    # provider → store, incl. the all-three gate
  ReplayStatus.test.tsx      # spinner, error, and the scan times that drew
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
  that only reads the caption passes even when the bracket is drawn in the
  wrong place — `legends.test.ts` pins the percentages instead, and pins them
  against `BAND_WARMEST_C`/`BAND_COLDEST_C` rather than literals so the bracket
  has to follow the band when it moves.
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

| Tool       | Notes                                                      |
| ---------- | ---------------------------------------------------------- |
| Express    | 5 — routers per domain, JSON responses                     |
| TypeScript | 6, `strict` — **CommonJS** (`module: node16`), unlike /app |
| ts-node    | Runs `src/` directly in dev via nodemon                    |
| nodemon    | `nodemon.json` watches `src/**/*.ts`                       |

Dependencies are intentionally minimal: `express`, `cors`, `dotenv`, `h5wasm`.
No ORM, no database, no framework layers. Use node built-ins (`fs/promises`,
`path`) for IO.

**Adding one is allowed, but it has to clear a bar**: a real reason the existing
stack cannot cover it, a package that is actually maintained, and no redundancy
with what is already installed. Bring evidence — last publish date,
downloads/month, dependency count, whether it needs a native build — and verify
it on real data rather than from its README. `h5wasm` is the worked example:
NIST, zero dependencies, WASM so no native toolchain, and it is the only HDF5
reader that surfaces a GOES scene's **attributes** — without them the fill
value, scale factor and projection constants would have to be hardcoded against
a file that already carries them.

**`h5wasm` is ESM-only, and this server is CommonJS.** That is why
`tsconfig.json` sets `"module": "node16"` rather than `"commonjs"`: the output
is still CommonJS (there is no `"type": "module"` in `package.json`, and every
static import still compiles to `require()`), but `node16` stops TypeScript
downlevelling `await import()` into `require()`, which cannot load an ESM-only
package. `cloudtop.ts` loads it through a lazy dynamic import and declares the
slice of its API it uses locally, so the package never appears in a static
import position.

**One system dependency: `libeccodes-tools`**, installed via `apt-get` in
`Dockerfiles/Dockerfile.local`. `ForecastService` shells out to its
`grib_get_data` to read HRRR GRIB2. It is deliberately _not_ an npm package.
Decoding GRIB2 by hand would be ~200 lines of bit-unpacking we'd own; eccodes is
ECMWF's own tool and is in Debian main. `grib_get_data` also returns lat/lon per
point for HRRR's **Lambert Conformal** grid, so the service does no projection
maths. wgrib2, the more famous equivalent, has **no Debian package at all** and
would need a gcc/gfortran source build in the `node` image.

**Two stale-container failures, and they need different commands.** Source is
bind-mounted, so TypeScript changes hot-reload; nothing else does.

- **`spawn grib_get_data ENOENT`** — the apt layer is stale.
  `docker-compose up --build` fixes it.
- **`TS2307: Cannot find module '<pkg>'`** after adding an npm dependency —
  `--build` is **not** enough. `docker-compose.yaml` masks `node_modules` with
  an **anonymous volume** (`- /usr/src/server/node_modules`) so the container
  keeps its own copy rather than the host's, and Compose _preserves anonymous
  volumes when it recreates a container_. The image rebuilds with the new
  package and then the stale volume is remounted straight over it. Use:

  ```bash
  docker-compose up --build --renew-anon-volumes
  ```

  (`docker-compose down -v` then `up --build` does the same thing.) This bit
  after `h5wasm` was added for the cloud-top layer.

Scripts: `yarn dev` (nodemon), `yarn docker` (nodemon -L, used in Compose),
`yarn build` (tsc → `dist/`), `yarn start`.

## Directory Structure

```
server/src/
  index.ts                 # App setup: middleware, router mounts, listen
  routers/                 # One Express router per URL prefix
                           #   (cloudtop.ts → /cloudtop, forecast.ts →
                           #    /forecast, radar.ts → /radar)
  lib/
    services/              # Data access classes + singleton exports
                           #   (forecast.ts → Hrrr, radar.ts → Mrms,
                           #    cloudtop.ts → Goes)
                           # Shared infrastructure, no source of its own:
                           #   contour.ts (marching squares + features()
                           #     and bandFeatures()),
                           #   grib.ts (eccodes, streaming values),
                           #   abi.ts (GOES fixed-grid geolocation)
    data/                  # (optional) on-disk JSON datasets read by services
  tests/                   # All test files (.test.ts)
```

Note the singleton names: `forecast.ts` exports `Hrrr` (the HRRR contours),
`radar.ts` exports `Mrms` and `cloudtop.ts` exports `Goes`. The file is named
for the product; the singleton is named for the source it fetches from.

## Entry Point

`index.ts` does four things only — create the app, apply middleware, mount
routers, listen:

```ts
// server/src/index.ts
const app: Express = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use("/radar", radar);

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
// server/src/routers/radar.ts
export const radar = express.Router();

radar.get("/reflectivity", async (req: Request, res: Response) => {
  try {
    const frame = await Mrms.reflectivity();
    res.send(frame);
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
// server/src/lib/services/radar.ts
export class RadarService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;

  async reflectivity(): Promise<RadarFrame> {
    return (await this.scene()).frame;
  }

  /** The same build's summary. Asking for either warms both. */
  async reflectivityStats(): Promise<RadarStats> {
    return (await this.scene()).stats;
  }

  private async scene(): Promise<Scene> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
    // ...fetch, decode, contour, populate cache...
  }
}

export const Mrms = new RadarService();
```

- Methods return typed, app-ready shapes — upstream fetching, parsing, and
  null-safety happen here, not in routers.
- Third-party API calls happen **only on the server**, inside a service —
  never from the browser (keys, CORS, and caching all live here). Use the
  global `fetch`.
- Cache in a private field; return the cache on repeat calls. Data keyed by a
  publication cycle caches forever and evicts when the cycle rolls (a given HRRR
  run+hour never changes); a continuous feed caches with a TTL matched to how
  fast it moves and to what a build costs (MRMS refreshes every ~2 min, a build
  is ~9 s → 5-min TTL).
- **One build, several answers.** Where a frame and its summary come from the
  same decode, expose both as methods over one cached build rather than
  fetching twice — see `RadarService` above and `Hrrr.liquid`/`liquidStats`.
- Response-shape interfaces (e.g. `RadarStats`) are declared and exported
  from the service file, and must stay in sync with the copy in
  `app/src/lib/types.ts`.
- New data domains get a new method on an existing service, or a new
  class + singleton pair in a new file when the underlying source differs.

## Historical replay — the `at` parameter

Every data route takes an optional `at` (ISO 8601). **Absent means live**, and a
request without it takes exactly the code path it took before replay existed —
the live map is never routed through a historical branch to get today's weather.
`parseAt` in `lib/services/replay.ts` is the one place it is read.

`at` names the **HRRR cycle**, not the valid time: `?at=2025-05-15T18:00:00Z`
is the 18z run, and `hour` still selects f00–f18 within it. The scene-based
services resolve it differently — they list the archive and take the nearest
scan, refusing anything more than 30 minutes away rather than captioning an
unrelated scene with the time that was asked for.

Each source has its own keyless archive, all verified reachable:

| Source    | Archive                                                           |
| --------- | ----------------------------------------------------------------- |
| HRRR      | `noaa-hrrr-bdp-pds`, same path shape as NOMADS after the base     |
| GOES-East | `noaa-goes19`, already date-keyed by `/YYYY/DDD/HH/`              |
| MRMS      | `noaa-mrms-pds`, `CONUS/MergedBaseReflectivityQC_00.50/YYYYMMDD/` |

**Three traps, and all three fail quietly:**

- **S3 ignores multi-range requests.** NOMADS answers 16 ranges with a `206` and
  a multipart body; S3 returns **`200` and the entire ~398 MB object** — not a
  416, not an error. The result decodes correctly and costs 400× too much, which
  is why `fetchRangesOneByOne` issues one request per range and **asserts 206**.
  The `Origin` on a `Cycle` is what selects that path, so it cannot be forgotten.
- **The archive names cloud mixing ratio `CLMR`; NOMADS names it `CLWMR`.** Only
  the `.idx` lookup sees it — eccodes reports `clwmr` on both — and it throws as
  though the field were missing rather than renamed. `CLWMR_NAME` keys it by
  origin.
- **GOES-19 became GOES-East in April 2025.** Earlier dates need `noaa-goes16`,
  so the calendar floors at 2025-04-07 rather than half-drawing a map.

**Cache policy splits by origin.** Live frames are evicted when the run rolls; a
replayed run never rolls, so evicting against it would throw away the live map's
frames the moment someone opened a historical date. Archive entries are capped by
count instead, and the two coexist.

## Testing — `node:test`

`yarn test` runs `node --require ts-node/register --test src/tests/*.test.ts`.
The server uses **node's built-in test runner, not Vitest** — it needs no
transform beyond ts-node, and this keeps the dependency list short. Do not
add Vitest or any other runner here; `/app` and `/server` differ on purpose,
like their module systems.

```
server/src/tests/
  cloudtop-service.test.ts # ABI geolocation, pressure→temperature, bands
  cloudtop-router.test.ts  # route → GeoJSON, both source times, 500s
  forecast-service.test.ts # marching squares (holes, edges), run discovery
  forecast-router.test.ts  # route → GeoJSON, hour passthrough, 500s
  sounding.test.ts         # isotherm interpolation, inversions, nearest cell
  cloudbase-service.test.ts# sparse block average, window stats, C2 at a point
  multipart.test.ts        # byte-range reassembly, in file order
  radar-service.test.ts    # dBZ averaged in Z, the two sentinels, row order
  radar-router.test.ts     # route → GeoJSON, scene time, 500s
  replay.test.ts           # `at` parsing, cycle resolution, the 206 assertion
```

- `forecast-service.test.ts` drives `polygons()` with hand-built grids (a solid
  blob, a donut, disjoint blobs, a blob flush against the edge) rather than
  real GRIB — the contouring is pure and needs no network or eccodes. Assert
  _geometry_, not ring counts: that a donut yields **one polygon with two
  rings** is the thing that breaks, and it renders as solid cloud when it does.

- `node:test` has no globals: import `describe`/`it` from `node:test` and
  `assert` from `node:assert/strict`. Assert with `assert.deepEqual` /
  `assert.equal` / `assert.rejects`.
- Stub with the per-test mocker (`t.mock.method(globalThis, "fetch", ...)`) —
  it restores automatically at test end. `t.mock.timers.enable({ apis: ["Date"]
})` + `tick()` drives cache-TTL expiry without real waits.
- **Service tests construct a fresh instance** (`new RadarService()`) so the
  singleton's cache can't leak across tests. Router tests are the exception:
  they mock the singleton's method (`Hrrr`, `Mrms`, `Goes`), since that is
  what the router imports.
- **Where a build needs eccodes and a 900 KB fixture, test the pure parts
  instead** — `blockAverage`, `summarize`, `isothermFt`, `nearestCell` and
  `sceneTime` are exported for exactly that reason, and they are where the
  reasoning lives. Don't commit GRIB fixtures to get at the wrapper around
  them.
- Third-party APIs are never hit for real — always mock `fetch`.
- Router tests bind a throwaway Express app to port 0 (an OS-assigned free
  port), mount just the router under test, and drive it with real `fetch`.
  Close the server in `after`.

## Server Conventions

- Import grouping comments apply here too (`// Express`, `// Middleware`,
  `// Routers`, `// Services`, `// Types`, `// Node`).
- The server emits CommonJS — do not add `"type": "module"`. An ESM-only
  dependency is allowed but must be loaded through a lazy `await import()`; see
  `cloudtop.ts` and the `"module": "node16"` note in the Stack section.
- Same Prettier conventions as `/app`.

---

## Full-Stack Data Flow

The end-to-end pattern. **The radar mosaic is the reference implementation** —
every layer of the pattern is visible in it, and its decode step is one gzipped
GRIB2 message rather than the byte-range juggling the HRRR products need.

```
MRMS .latest.grib2.gz → RadarService (fetch, decode, contour, TTL cache) [lib/services/radar.ts]
             → express.Router GET /radar/reflectivity/stats  [routers/radar.ts]
             → Vite dev proxy (/radar → server :3000)        [app/vite.config.ts]
             → GetRadarStats() fetch                         [app/src/lib/client.ts]
             → RadarProvider dispatches to Redux             [app/src/lib/context]
             → Radar selects via useAppSelector              [app/src/app/components]
```

Its **geometry** takes the shortcut every contoured layer takes — one build
serves both, so `/radar/reflectivity` feeds `CandidateRadarLayer.url` directly
and only the summary rides the full pattern above:

```
GET /radar/reflectivity → CandidateRadarLayer.url    [lib/arcgis/layers.ts]
                        → reflectivity → band fill   [lib/arcgis/renderers.ts]
```

The forecast feature follows the same path with one deliberate deviation — the
frames are too big for the store, so only the _metadata_ rides the full
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

The cloud-top layer is the only one assembled from two sources, and it is the
only one whose geometry is observed:

```
noaa-goes19 S3 listing → newest ABI-L2-ACHP2KMC scene (4.1 MB NetCDF4)
             → h5wasm → cloud-top pressure + projection constants
             → ABI fixed grid → HRRR's 12 km grid (abi.ts)
             → Hrrr.column() supplies TMP at that pressure  [services/forecast.ts]
             → mask to tops colder than -5 C, disjoint bands [services/cloudtop.ts]
             → GET /cloudtop/temperature                     [routers/cloudtop.ts]
             → CandidateCloudTopLayer.url                    [lib/arcgis/layers.ts]

GET /cloudtop/temperature/stats → GetCloudTopStats() → CloudTopProvider
                                → cloudtop slice → CloudTop panel
```

The cloud-base layer is the one build that serves a layer **and** a point
readout, because both come out of the same nine `wrfsfc` records:

```
NOMADS HRRR .idx → byte-range subset of the 2D diagnostics (~10 MB, 9 records)
             → grib_filter with a sentinel outside the physical range
             → block-average 3 km → 12 km, majority rule, NaN where unsampled
             → disjoint bands on the operational window  [lib/services/forecast.ts]
             → GET /forecast/cloudbase?hour=N            [routers/forecast.ts]
             → CandidateCloudBaseLayer.url               [lib/arcgis/layers.ts]

GET /forecast/cloudbase/stats → GetCloudBaseStats() → CloudBaseProvider
                              → cloudbase slice → CloudBase panel

GET /forecast/sounding?lat&lon&hour → the same cached grid, read at one cell
                              → Sounding.diagnostics → Convective panel
```

The decode inside that reference build, in full — one gzipped GRIB2 message
rather than byte ranges of a huge one:

```
MRMS .latest.grib2.gz → gunzip → grib_filter (eccodes), streamed
             → block-average 1 km → 12 km, in Z not dBZ
             → marching squares                          [lib/services/radar.ts]
             → GET /radar/reflectivity                   [routers/radar.ts]
             → CandidateRadarLayer.url                   [lib/arcgis/layers.ts]
```

The point sounding is the one HRRR product small enough to ride the whole
pattern into the store — it is a dozen levels over one point, not a field:

```
GET /forecast/sounding?lat&lon&hour → Hrrr.sounding()     [lib/services/forecast.ts]
             → GetSounding() → SoundingProvider → sounding slice
             → Sounding panel; Map.tsx dispatches setPoint on click
```

That build is a _national_ profile grid (TMP+HGT, 50 mb, 400–1000 mb) rather
than a point query, so the first click pays ~25 s and every later one is
answered from the same cached grid in ~11 ms.

**Cache policy follows the source's own cycle, not a habit.** A given HRRR
run+hour never changes, so `ForecastService` caches frames forever and evicts
only when the run rolls (~5 s cold, ~0 ms warm); profile grids are ~12 MB each,
so only the last few hours are kept. Concurrent requests for the same build
collapse onto one download. `RadarService` and `CloudTopService` are the
opposite case — scenes arrive continuously with no publication cycle to key
off — so both use a plain 5-minute TTL, and each frame carries its own valid
time so the sidebar can report the scene's age rather than implying it is live.

**Nothing streams browser → third party except the basemap.** Everything else
returns _data_ we parse, reproject, cache and reshape, so it goes through a
service. If a future layer is genuinely just tiles, the rule relaxes — keys,
CORS and caching are what it protects, and a keyless public tile service
has none of those problems.

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
   component behavior in `app/src/tests/`. The radar tests are the reference for
   each layer.
10. **Run it** — start both services and drive the actual page before calling
    it done. The suites fake ArcGIS and the network, so they cannot tell you
    whether a layer painted, a URL 404s, or text is invisible against the
    background.

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
