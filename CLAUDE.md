# Weatherman — coding standards

How this repository is written. **What it is and what its layers mean lives in
`WEATHERMAN.md`; the physics and sampling limits live in `MEASUREMENTS.md`.**
Read `WEATHERMAN.md` before touching a layer and `MEASUREMENTS.md` before adding
a data source.

A React SPA in `/app` and an Express API in `/server`, orchestrated with Docker
Compose.

## Principles

- **Neat and organized.** Every file has one job and a predictable home.
  Infrastructure (`lib/`) is separated from UI (`app/`); routers are separated
  from services. Split a file before it sprawls — ~150 lines is the smell
  threshold for a component, and a module that needs a paragraph to say what it
  does is two modules.
- **Minimize dependencies.** Prefer the platform (`fetch`, `fs/promises`,
  `URLSearchParams`) and what is already installed. A new dependency needs a
  reason the existing stack cannot cover, a maintained package, and no
  redundancy with what is here. Bring evidence — last publish, downloads,
  dependency count, whether it needs a native build — and verify it on real data
  rather than from its README.
- **Follow the existing pattern.** Each layer below has one canonical example in
  the code. Copy its shape rather than inventing a parallel approach.
- **Write in plain technical language.** Say it the way you would say it out loud
  to another engineer. Short sentences, ordinary words, the direct verb — "this
  reads the cloud base", not "this facilitates the ingestion of cloud-base data".
  Keep every fact, name, number, file path, unit and threshold exactly as it is;
  plain language is about the words around them, never about dropping or
  rounding them. This governs code comments, docs, commit messages and anything
  the operator reads.
- **Name a thing by what it measures, not by its code.** The criterion labels
  C1–C7 are planning shorthand. They belong in `PLAN.md`, `INVESTIGATION.md` and
  the system design, and **nowhere in the app** — not in the UI, not in code
  comments, not in test names. A label is not a reason. Write the thing the
  criterion is about: "the seeding band has to lie between cloud base and cloud
  top". The same holds for field names, sentinel values and product codes, which
  are implementation rather than information.
- **Docs are axioms, not logs.** State the rule that holds now. No "decided",
  "rejected", "verified", "was X until Y". Evidence and dates belong in
  `PLAN.md` and `INVESTIGATION.md`, which are allowed to argue.

## Repository layout

```
weatherman/
  app/                       # React SPA (Vite dev server, port 5173)
  server/                    # Express API (ts-node/nodemon, port 3000)
  docker-compose.yaml        # Runs both services with bind mounts + HMR
  CLAUDE.md                  # This file — how the code is written
  WEATHERMAN.md              # What the app is, and what each layer claims
  MEASUREMENTS.md            # Physics and sampling limits on any layer
  PLAN.md / INVESTIGATION.md # Where the arguing happens
```

## Running it

```bash
docker-compose up            # both services, source bind-mounted
cd app && yarn dev           # or individually
cd server && yarn dev
```

Compose service names: `weatherman-app-service`, `weatherman-server-service`.
Each has its own `Dockerfiles/Dockerfile.local` (plain `node` image + `yarn`).
The server's in-container script is `yarn docker` (`nodemon -L`, for polling
across bind mounts) and it exposes `GET /healthcheck`.

**Two stale-container failures need different commands.** Source is
bind-mounted, so TypeScript hot-reloads; nothing else does.

- `spawn grib_get_data ENOENT` — the apt layer is stale. `docker-compose up
--build`.
- `TS2307: Cannot find module '<pkg>'` after adding a dependency — `--build` is
  **not** enough. `docker-compose.yaml` masks `node_modules` with an anonymous
  volume, and Compose preserves anonymous volumes when it recreates a container,
  so the stale volume remounts over the new image. Use `docker-compose up --build
--renew-anon-volumes`.

## Formatting and linting

One Prettier config at the repo root, `.prettierrc.yaml`: 80-char width, 2-space
indent, double quotes, semicolons, ES5 trailing commas. It is dotted so Prettier
auto-discovers it — a config it cannot find is a config that silently does not
apply.

- `yarn format` / `yarn format:check` in either package.
- Editors format on save via `.vscode/settings.json`.
- A `PostToolUse` hook (`.claude/settings.json` → `.claude/format.sh`) formats
  files Claude edits, so never shell out to Prettier by hand.
- ESLint flat config in `/app`: `js.configs.recommended` + `typescript-eslint` +
  `react-hooks` + `react-refresh`. Run `yarn lint` before committing.
- TypeScript enforces `noUnusedLocals` / `noUnusedParameters`. No dead code.

---

# Frontend — `/app`

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

## Directory structure

```
app/src/
  app/                     # UI layer
    App.tsx                # Layout shell: Navigation + providers + <Outlet />
    main.tsx               # Entry: router config + provider composition
    layout/                # Chrome: Navigation, Drawer
    components/            # One directory per route, plus what they share
      Landing.tsx          #   The landing page
      Map.tsx              #   The one component touching ArcGIS imperatively
      panel/               #   Sidebar parts more than one route uses
      forecast/            #   /map/forecast and its panel
      candidate/           #   /map/candidate and its panel
      replay/              #   /map/replay and its panel
    assets/
    index.css / App.css
  lib/                     # Infrastructure — not UI
    client.ts              # Plain async fetch functions (PascalCase names)
    types.ts               # Shared data shapes — mirror server responses
    arcgis/
      layers.ts            #   Module-scope GeoJSONLayer instances
      legends.ts           #   Per layer: on-screen name, source, what it
                           #   measures, and what it does not tell you
      bands.ts             #   Contour levels, colours and labels per layer
      renderers.ts         #   The ArcGIS symbols those bands are painted with
    context/               # One data provider per domain
    store/
      store.ts             # Singleton store + AppStore/RootState/AppDispatch
      hooks.ts             # useAppDispatch/useAppSelector/useAppStore
      features/            # One slice per domain
  tests/                   # All test files (.test.ts / .test.tsx), plus
                           # utils.tsx and arcgis-fakes.ts
```

## Routing and provider composition

`main.tsx` defines the router at module scope and composes providers around it.
`StoreProvider` is always the outermost wrapper. Page-scoped providers wrap the
single route element that needs them; app-wide ones wrap `<Outlet />` in
`App.tsx`.

**Page routes live under `/map/…`; server prefixes live at the root.** The dev
proxy forwards every `/forecast*` request to Express, so a _page_ at `/forecast`
is swallowed by the API and the browser renders Express's "Cannot GET /forecast".
Keep the two namespaces apart.

`App.tsx` is only layout chrome plus providers child routes need, and renders
`<Outlet />`.

## Data providers

A data provider fetches external data and syncs it into Redux. It wraps its
children and renders no UI:

```tsx
// lib/context/RadarProvider.tsx
export function RadarProvider({ children }: { children: React.ReactNode }) {
  const stats = useAppSelector((state) => state.radar.stats);
  const dispatch = useAppDispatch();

  useEffect(() => {
    async function load() {
      try {
        dispatch(radarActions.setLoading(true));
        dispatch(radarActions.setStats(await GetRadarStats()));
      } catch (error) {
        dispatch(
          radarActions.setError(
            error instanceof Error ? error.message : "Failed to load data"
          )
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

- The provider reads from and writes to Redux. It holds no local state for
  shared data.
- The `useEffect` guard prevents redundant fetches — StrictMode double-invokes
  effects.
- Loading and error states are dispatched to the slice, not kept locally.
- One provider per data domain, placed where its consumers live.

## Redux store

The store is a singleton created in `store.ts`; **types are inferred from it,
never written by hand**.

```ts
export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
```

**The store holds only plain, serializable data** — RTK's `serializableCheck` is
on at its default and stays on. Two consequences:

- **No ArcGIS objects.** Layers are module-scope singletons in
  `lib/arcgis/layers.ts`; the store holds a string naming which is active.
- **No bulk geometry.** A contour frame is ~1.4 MB and `serializableCheck`
  deep-walks state on every dispatch. Layers are pointed at a server URL and
  fetch their own geometry. **The store carries the selection and the summary,
  never the payload.**

`StoreProvider` passes the singleton directly — no `useRef`, which the
`react-hooks/refs` lint rule forbids reading during render.

**Always use the typed hooks.** Never import `useDispatch`/`useSelector`
directly.

### Slice conventions

```ts
type InteractionsState = { coordinates: [number, number] | null };
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
- Data slices carry their own `loading` and `error` alongside the data.
- Actions are exported namespaced; the reducer is the default export and is
  registered in `store.ts`.

## API client

Client functions live in `lib/client.ts` as **plain async functions, not hooks**,
named in `PascalCase`:

```ts
export async function GetRadarStats(): Promise<RadarStats> {
  const res = await fetch("/radar/reflectivity/stats");
  if (!res.ok) {
    throw new Error(`Failed to fetch radar mosaic: ${res.status}`);
  }
  return res.json();
}
```

- `fetch` directly, no axios. `URLSearchParams` for query strings.
- **Fetch relative paths** — never hardcode the server origin. The Vite dev proxy
  routes the prefix to Express.
- **Throw on non-OK**; the calling provider catches and dispatches the error.
- Any transformation from API response to app-ready object belongs here, not in
  components or providers. `GetSounding` is the one to copy: the app holds a
  point as `[lon, lat]` because that is what an ArcGIS click returns and the
  server takes `lat`/`lon`, so the swap happens here once rather than at every
  call site.

## Types

Shared shapes live in `lib/types.ts` and **must mirror the server's types
field-for-field** — there is no shared package, so the contract is maintained by
hand on both sides. Component prop types are declared locally as
`type PropsT = { … }`.

## ArcGIS

- Import from `@arcgis/core` ES modules only. Never `esri-loader`.
- Static map configuration — layer instances, legend data, renderers — lives in
  `lib/arcgis/` as module-scope instances, one file per kind.
- **Exactly one component (`components/Map.tsx`) touches the imperative API.** It
  holds `Map`/`MapView` in refs, initializes the view once in a mount effect, and
  reacts to Redux state in separate focused effects. Everything else interacts
  with the map through Redux.
- Every layer is added to the map once and toggled via `.visible`, so switching
  routes does not refetch. **Visibility is derived from the store in one effect**
  — never set `visible` from anywhere else.

### Two shapes of polygon layer

Both are GeoJSON from our own server, and the choice is not cosmetic:

- **Nested contours** — `features()` server-side, stacked `Ramp` in the panel. An
  area meeting the top level is painted by every band, so fills composite and
  each stays faint. Use where the field's extremes are rare and "more" genuinely
  means "more".
- **Disjoint bands** — `bandFeatures()` server-side, unstacked ramp. Exactly one
  band applies to a cell and nothing composites, so each swatch is the literal
  fill and the legend reads straight.

**Measure the coverage of each level before choosing.** Nesting only works where
the extremes are rare; if every level covers a similar share of the grid the
bands are four rings almost on top of each other painting a third of the map at
full opacity. A bimodal field takes disjoint bands.

**The opacity ramp is not always quiet-to-loud, and is not always a ramp.** Take
its shape from what the field means, not from a house style. `renderers.test.ts`
pins the directions. Which layer uses which, and why, is in `WEATHERMAN.md`.

A third shape exists for sparse point sources: discrete classes on a marker ramp,
each marker where the observation was, nothing interpolated between them. Nothing
in the app needs it yet, so there is no in-repo example to copy — build it from
the source's own sampling rather than adapting a contour layer.

## Component conventions

**A component lives in the directory of the route that renders it.** A page and
its panel are one folder — `candidate/` holds the page, its switches and every
readout under them. Something a second route starts using moves out rather than
being imported across: sidebar parts shared by two panels go to `panel/`, and
`Map.tsx` sits at the components root because all three routes mount it.

**A layer is named on screen in SCREAMING_SNAKE_CASE** — `CLOUD_BASE`,
`SUPERCOOLED_LIQUID_WATER` — and the name lives in that layer's `LayerLegend` in
`lib/arcgis/legends.ts`. Switches, panel headings and tests read it from there,
so a layer has one name everywhere and renaming it is one edit. The name still
says what the layer measures; the case is the only shorthand allowed.

**Every layer's prose lives in its `LayerLegend`, and both maps read it.** The
candidate map and the replay map draw the same layers at different hours, so
descriptions that differed between them would be describing the same layer two
ways. `about` says what the thing is and how it is made; `caveat` says what it
does not tell you. Both are rendered by `LayerDefinitions` in a DaisyUI collapse under
the switch — printed inline they bury the ramp, which is the part read every
time.

**Panel text is undimmed.** No `opacity-*` on anything carrying words; the
DaisyUI classes that dim themselves (`stat-title`, `stat-desc`, `prose`) are
un-dimmed once in `index.css` rather than fought per component. Muting is for a
control that cannot act — the greyed ramp at an hour its layer cannot draw.

**Use early-return guards. Never ternaries for loading/error/empty at the top
level:**

```tsx
export const Clouds = () => {
  const loading = useAppSelector((state) => state.weather.loading);
  const error = useAppSelector((state) => state.weather.error);

  if (loading) return <span className="loading loading-spinner" />;
  if (error) return <div className="text-error p-4">{error}</div>;

  return; /* main render */
};
```

- Components read Redux directly via `useAppSelector`. Don't thread props down
  for data that lives in the store.
- Local `useState` is fine for ephemeral UI state.
- Use `Link`/`NavLink` from `react-router`.

## Import ordering

Group imports with a single-line comment label, in this order:

```
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

Use only the groups that apply. No blank lines within a group; one between
groups. Cross-module imports use the `@/` alias; same-folder imports are
relative.

## Styling — Tailwind v4 + DaisyUI

- Tailwind is a Vite plugin; there is no `tailwind.config.js`.
- Use DaisyUI semantic classes (`btn`, `navbar`, `drawer`, `menu`, `collapse`,
  `input`, `loading`) and semantic color tokens (`bg-base-200`, `text-error`)
  over hardcoded colors, so theming keeps working.
- Layout uses Tailwind utilities. Prose blocks use `prose` from
  `@tailwindcss/typography`.

**The app is dark and the theme is pinned to it** in `src/app/index.css`:

```css
@plugin "daisyui/index.js" {
  themes: dark --default;
}
```

This is load-bearing. The chrome hardcodes `bg-black` and the ArcGIS dark theme
is imported, so if DaisyUI falls back to its light default `text-base-content`
resolves to dark text on black and the sidebar becomes unreadable. Don't remove
the pin, and don't "fix" contrast by hardcoding text colours on top of it — that
hides the theme break rather than fixing it.

## Testing — Vitest

`yarn test` (watch) / `yarn vitest run` (once). Config is the `test` block of
`vite.config.ts` (`environment: "jsdom"`, `globals: true`), so
`describe`/`it`/`expect`/`vi` need no import.

- All tests live in `src/tests/` with a `.test.ts` / `.test.tsx` suffix — never
  co-located. Non-test helpers live there too (`utils.tsx`,
  `arcgis-fakes.ts`); Vitest's default `include` only picks up `*.test.*`.
- Priorities (testing trophy): pure logic and data transforms first, then reducer
  cases called directly, then component integration with RTL.
- Each `it` tests exactly one behavior.
- **Never test against the singleton store.** `createTestStore()` in
  `tests/utils.tsx` builds a fresh one per test; `renderWithStore(ui, store)`
  wraps it in a `<Provider>` via RTL's `wrapper` option and returns the store.
- Components read the store, so **drive them through it**: dispatch real actions
  and assert on rendered output or resulting state. Dispatches after `render`
  must be wrapped in `act()` or React won't flush the effects.
- Assert with plain `expect` — `@testing-library/jest-dom` is not installed
  (`expect(container.innerHTML).toBe("")`, not `toBeEmptyDOMElement()`).
- **Fake `@arcgis/core` with `vi.mock`** — the real modules need a WebGL context.
  `tests/arcgis-fakes.ts` holds the fakes: classes that record their instances,
  asserted through spied `goTo` and `visible`. Each `vi.mock` factory imports
  that module rather than closing over it, which is what lets `Map.test.tsx` and
  `MapReplay.test.tsx` drive one map without keeping two copies of it. It fakes
  `@/lib/arcgis/layers` too; `layers.test.ts` covers the real layer objects,
  which construct fine in jsdom.
- **Assert the numbers a legend is derived from, not just its labels.** A test
  that reads only the caption passes when the bracket is drawn in the wrong
  place. Pin percentages against the named constants, not literals, so the
  bracket has to follow the band when it moves.
- ESLint has no underscore-ignore rule, so an unused mock parameter is an error.
  Put the signature in `vi.fn`'s type argument instead:
  `vi.fn<(blob: Blob) => string>(() => "blob:mock")`.

---

# Backend — `/server`

| Tool       | Notes                                                      |
| ---------- | ---------------------------------------------------------- |
| Express    | 5 — routers per domain, JSON responses                     |
| TypeScript | 6, `strict` — **CommonJS** (`module: node16`), unlike /app |
| ts-node    | Runs `src/` directly in dev via nodemon                    |
| nodemon    | `nodemon.json` watches `src/**/*.ts`                       |

Dependencies are intentionally minimal: `express`, `cors`, `dotenv`, `h5wasm`.
No ORM, no database, no framework layers. Use node built-ins for IO.

**The server emits CommonJS — do not add `"type": "module"`.** An ESM-only
dependency is allowed but must be loaded through a lazy `await import()`.
`tsconfig.json` sets `"module": "node16"` rather than `"commonjs"` for exactly
this: the output is still CommonJS, but `node16` stops TypeScript downlevelling
`await import()` into `require()`, which cannot load an ESM-only package.
`goes/cloudtop.ts` is the worked example — it loads `h5wasm` lazily and declares the
slice of its API it uses locally, so the package never appears in a static import
position.

**One system dependency: `libeccodes-tools`**, installed via `apt-get` in
`Dockerfiles/Dockerfile.local`, not npm. `grib_get_data` and `grib_filter` read
GRIB2, and `grib_get_data` returns lat/lon per point for HRRR's Lambert grid so
the server does no projection maths.

Scripts: `yarn dev`, `yarn docker`, `yarn build` (tsc → `dist/`), `yarn start`,
`yarn test`, `yarn format`.

## Directory structure

```
server/src/
  index.ts                 # App setup: middleware, router mounts, listen
  routers/                 # One Express router per URL prefix
  lib/
    services/              # One directory per source, and what they share
      hrrr/                #   forecast.ts     -> Hrrr
                           #   bytes.ts        cycles, byte ranges, messages
                           #   slw.ts          the seeding-band integral
                           #   profile.ts      pressure levels + isotherms
                           #   diagnostics.ts  the wrfsfc 2D fields
      goes/                #   cloudtop.ts     -> Goes
                           #   abi.ts          fixed-grid geolocation
      mrms/                #   radar.ts        -> Mrms
      candidate/           #   field.ts        -> Seedability
                           #   join.ts         the join and its summary
      shared/              # No source of its own:
                           #   contour.ts      marching squares, features(),
                           #                   bandFeatures(), the frame shape
                           #   grib.ts         eccodes, streaming values
                           #   grid.ts         the 12 km grid + block averaging
                           #   replay.ts       the `at` parameter
    data/                  # (optional) on-disk JSON datasets read by services
  tests/                   # All test files (.test.ts)
```

**The file is named for the product; the singleton is named for the source; the
directory is named for the feed.** A module that reads one source lives in that
source's directory, however pure it is — `profile.ts` is HRRR's vertical
coordinate and sits under `hrrr/` even though it touches no network. `shared/`
is for modules with no source at all, and a module that ends up importing from
two feeds belongs there or in the service that joins them.

## Entry point

`index.ts` does four things only — create the app, apply middleware, mount
routers, listen. Configuration comes from `process.env` with defaults; bind to
`0.0.0.0` so Docker port mapping works. Keep `/healthcheck` intact. No route
logic here, only mounts.

## Routers

One router file per URL prefix, exporting a **named** `express.Router()`:

```ts
export const radar = express.Router();

radar.get("/reflectivity", async (req: Request, res: Response) => {
  try {
    res.send(await Mrms.reflectivity());
  } catch (error) {
    res
      .status(500)
      .json({ error: error instanceof Error ? error.message : String(error) });
  }
});
```

- Handlers are thin: call a service method, send the result.
- Every async handler wraps its body in `try/catch` and returns 500 — never let a
  rejection escape. Serialize `error.message`; a raw `Error` JSON-serializes to
  `{}`.
- No data access or business logic in routers.

## Services

Data access lives in `src/lib/services/` as a **class plus a singleton instance
export** — the class carries the logic, the singleton carries the cache:

```ts
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
    /* fetch, decode, contour, cache */
  }
}

export const Mrms = new RadarService();
```

- Methods return typed, app-ready shapes. Upstream fetching, parsing and
  null-safety happen here, not in routers.
- **Third-party calls happen only on the server, inside a service** — never from
  the browser. Keys, CORS and caching all live here. Use the global `fetch`.
- **One build, several answers.** Where a frame and its summary come from the
  same decode, expose both over one cached build rather than fetching twice.
- Cache in a private field. Data keyed by a publication cycle caches forever and
  evicts when the cycle rolls; a continuous feed caches with a TTL matched to how
  fast it moves and what a build costs. Collapse concurrent requests for the same
  build onto one download.
- Response-shape interfaces are declared and exported from the service file and
  must stay in sync with `app/src/lib/types.ts`.
- New data domains get a new method on an existing service, or a new class +
  singleton in a new file when the underlying source differs.

## Testing — `node:test`

`yarn test` runs `node --require ts-node/register --test src/tests/*.test.ts`.
**The server uses node's built-in runner, not Vitest** — it needs no transform
beyond ts-node, and this keeps the dependency list short. Do not add another
runner; `/app` and `/server` differ on purpose, like their module systems.

- `node:test` has no globals: import `describe`/`it` from `node:test` and
  `assert` from `node:assert/strict`.
- Stub with the per-test mocker (`t.mock.method(globalThis, "fetch", …)`) — it
  restores automatically. `t.mock.timers.enable({ apis: ["Date"] })` + `tick()`
  drives cache-TTL expiry without real waits.
- **Service tests construct a fresh instance** (`new RadarService()`) so the
  singleton's cache cannot leak across tests. Router tests are the exception:
  they mock the singleton's method, since that is what the router imports.
- **Where a build needs eccodes and a large fixture, test the pure parts
  instead.** `blockAverage`, `blockAverageSparse`, `accumulate`, `nearestCell`,
  `isothermFt`, `isothermFieldFt`, `diagnostics`, `baseStats` and `sceneTime` are
  exported for exactly that reason, and they are where the reasoning lives.
  **Don't commit GRIB fixtures to get at the wrapper around them.**
- Drive the contourer with hand-built grids — a solid blob, a donut, disjoint
  blobs, a blob flush against the edge. **Assert geometry, not ring counts**:
  that a donut yields one polygon with two rings is the thing that breaks, and it
  renders as solid cloud when it does.
- Third-party APIs are never hit for real — always mock `fetch`.
- Router tests bind a throwaway Express app to port 0, mount just the router
  under test, and drive it with real `fetch`. Close the server in `after`.
- Import grouping comments apply here too (`// Express`, `// Middleware`,
  `// Routers`, `// Services`, `// Types`, `// Node`).

---

## Adding a feature — checklist

1. **Service** — a typed method (or new class + singleton) under
   `server/src/lib/services/`.
2. **Router** — a router in `server/src/routers/`; mount its prefix in
   `server/src/index.ts`.
3. **Proxy** — register the route prefix in `server.proxy` in
   `app/vite.config.ts`. The app fetches relative paths, so this is part of
   finishing any feature that calls the server. Give it a timeout that fits a
   cold build.
4. **Type** — mirror the response shape in `app/src/lib/types.ts`.
5. **Client** — a `PascalCase` function in `app/src/lib/client.ts` that throws on
   non-OK.
6. **Slice** — a slice with `loading`/`error` under
   `app/src/lib/store/features/`, registered in `store.ts`.
7. **Provider** — a `*Provider` in `app/src/lib/context/` that fetches, guards
   and dispatches; wrap it where its consumers live.
8. **Route + component** — the route in `main.tsx`, the page under
   `app/components/`; read the store with `useAppSelector`, guard with early
   returns.
9. **Tests** — service and router in `server/src/tests/`; client transform,
   reducer cases and component behavior in `app/src/tests/`. The radar tests are
   the reference for each layer.
10. **Run it** — start both services and drive the actual page before calling it
    done. The suites fake ArcGIS and the network, so they cannot tell you whether
    a layer painted, a URL 404s, or text is invisible against the background.

## Ecosystem defaults that do not apply here

- **No `createAsyncThunk` / RTK Query.** Async work lives in data providers
  calling plain client functions.
- **`fetch`, not axios** — on both client and server.
- **Typed hooks only.** Never `useSelector` / `useDispatch` from `react-redux`.
- **No `enum`, no `namespace`.** Use `type` unions and plain objects.
- **`@arcgis/core` ES modules, not `esri-loader`.**
- **No database.** The server reads upstream APIs through cached services.
- **Split module systems.** `/app` is ESM, `/server` is CommonJS — don't
  "harmonize" them.
- **Split test runners.** `/app` uses Vitest, `/server` uses `node:test` — don't
  harmonize these either.
