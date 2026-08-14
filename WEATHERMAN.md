# Weatherman — what it is, and what each layer claims

The operator-facing software for a field-deployable cloud-seeding weather station
(part of the Rainmaker project). The station fuses local sensor data with free
national feeds — NEXRAD, GOES, HRRR — into a single _seedability_ verdict: is
there supercooled liquid water in the seeding band worth sending a drone to, and
did seeding work. The system design lives outside this repo at
`/home/nathan/code/rainmaker/weatherman`. This web app is the operator dashboard.

**Scope is Texas, rainy season.** `CLAUDE.md` says how the code is written;
`MEASUREMENTS.md` says what the free feeds can and cannot answer, and holds the
sampling rule that decides whether a proposed layer is honest at all. **Read
`MEASUREMENTS.md` before adding a data source** — most of it rules things out.

## Standing rules

- **No raster on any map, ever.** An image has no nodata: it paints clear sky
  opaquely and buries the basemap. Every layer is GeoJSON from our own server.
- **No sampled field is interpolated past what it measured.** Block-averaging
  3 km → 12 km removes structure and is fine; interpolating 300 km → 12 km
  invents it and is not. Compare a variable's correlation length to the sample
  spacing before drawing any new field (`MEASUREMENTS.md` §3).
- **A source too sparse to pass that test is drawn as points, and only points** —
  colour banding in a marker ramp, each marker where the observation was, nothing
  between them.
- **A threshold needs a citation, not a coverage table.** Coverage figures say
  what a threshold costs, never whether it is real.
- **Nothing streams browser → third party except the basemap.** Everything else
  is data we parse, reproject, cache and reshape, so it goes through a service.

## The three map routes

Two differ editorially, not cosmetically; the third is the same layers at a
different hour.

### `/map/forecast` — modelled

HRRR cloud cover, contoured server-side into nested polygons, with a slider
stepping f00–f18. **Satellites cannot forecast**, so nothing observed appears
here. This map is entirely model output.

### `/map/candidate` — observed

Five layers, and they are not the same kind of claim. Bottom to top:

| Layer                    | Claim        | Source                    |
| ------------------------ | ------------ | ------------------------- |
| Cloud base               | modelled     | HRRR `wrfsfc`             |
| Cloud-top temperature    | observed     | GOES-East geometry + HRRR |
| Supercooled liquid water | **modelled** | HRRR `wrfprs`             |
| Radar reflectivity       | measured     | MRMS                      |

The supercooled-liquid contours are the deliberate exception on an observed map,
and the sidebar says so. The radar mosaic is the only measurement on either map.
Clicking anywhere profiles that point's column and reads that cell's convective
diagnostics.

**The seeding-opportunity layer is the answer the other four are inputs to**, drawn over
all of them. It is the only layer that starts on: the map opens on its answer,
and the operator switches on whichever inputs they want to check it against.
Switching the amber back on reads the two together — amber with no green over it
is liquid the join rejected, and the panel says which condition ruled it out.

**Cloud base sits at the bottom because it is the question asked first** — can an
aircraft climb into this cloud at all — and the layers above are answers about a
cloud you can reach.

### `/map/replay` — the candidate map at an hour you pick

**The same layers as the candidate map, with the same defaults and the same
legends**, rebuilt from that hour's own sources: the HRRR cycle initialised then,
and the satellite and radar scans nearest it. A layer offered live and not here
is one an operator cannot check against a seeding log. The left panel is a
calendar, what actually loaded, and the seeding-opportunity summary — the one
readout that says something about the hour as a whole rather than about one
unjoined source.

**Nothing is drawn until every source has answered.** The sources take 10 s to
40 s and do not finish together, so revealing each as it landed put two dates on
the map at once. `ReplayProvider` awaits the _stats_ routes — which build the
same cached scenes the geometry routes serve — and only then does the store's
`ready` move and the layers point at the hour. Picking a date clears `ready`,
which blanks the map immediately rather than leaving the old hour under a new
date. The warms run in parallel, so a cold hour costs the slowest source rather
than the sum of them, and the geometry that follows is cache-warm (<0.5 s each).
That is what makes the layers appear together.

**Its layers are separate ArcGIS instances**, not the candidate map's pointed at
a date. Sharing them would leave a past date's url on the live map, and the bug
would read as a caching failure rather than a shared object. The live candidate
layers are explicitly hidden in replay mode for the same reason: **showing
today's scene under a past date is the one thing this page must never do.**

## The layers, and what each is for

**The split, in one line:** the satellite answers "what shape, where, and how cold
on top"; the model answers "how much, of what, at what temperature _inside_".
Neither substitutes for the other.

### Cloud shape and top temperature — GOES-East, decoded server-side

`ABI-L2-ACHP2KMC` — cloud-top **pressure**, CONUS, 2 km, 4.1 MB a scene, a new
scene every 5 minutes, keyless on `noaa-goes19`. NetCDF4/HDF5, read with
`h5wasm`, reprojected from the ABI fixed grid onto the same 12 km grid everything
else contours on, and turned into a temperature using HRRR's profile at that
pressure.

**This is the one layer built from two sources**, and the split is deliberate:
HRRR nails the thermodynamic profile and is much shakier on cloud, so the
satellite says _where the top is_ and the model says _how cold it is there_. That
also makes it the only cloud layer that can contradict the supercooled-liquid
contours drawn over it.

It has **real nodata** — where the satellite sees no cloud, nothing is drawn. It
is **filtered**: only tops at −5 °C or colder appear, because a warmer top means
the seeding band lies above the cloud entirely, which accounts for most cloudy
ground over a Texas year. The bands are **disjoint, not nested**, and the ramp
runs backwards — warmest band loudest — because the warm end is the target and
the cold end is cirrus covering most of the sky. There is **no cold cutoff**
(`MEASUREMENTS.md` §4).

### Cloud phase and quantity — HRRR

Cloud cover and precipitation on the forecast map; supercooled liquid water and
the point sounding on the candidate map. All decoded from GRIB2 server-side and
contoured.

Supercooled liquid water is the one field that is **derived rather than read**.
`CLWMR` is 3D over 40 pressure levels, and the seeding band moves — 425–525 mb
over Texas in July, 700–950 mb in a winter airmass — so it is integrated over
exactly the levels whose temperature is in the band at each point, never drawn at
a fixed level.

**The band is −5 °C to −18 °C, and its two edges are different kinds of number.**
−5 °C is physics: silver iodide barely nucleates ice above it. −18 °C is a
judgement about where the _supply_ of liquid thins out, because natural ice
nuclei activate and take it first; AgI itself keeps working to roughly −20 °C.
Both edges live in `SEEDING` in `server/src/lib/services/hrrr/slw.ts`, mirrored by
`BAND_WARMEST_C`/`BAND_COLDEST_C` in the app. **Every caption, legend bracket and
readout reads the band from one of those two places.**

### Cloud base and the convective diagnostics — HRRR `wrfsfc`

The file the cloud-cover and precipitation layers already download.
`HGT:cloud base` is the variable Texas practice selects on, banded on the
**4,000–12,000 ft window** the state's published description names — a cited
figure, drawn and reported, **never used to filter**.

It has **real nodata**, and its bands are **disjoint** for a reason the ramp shape
carries: the field is a window with a wrong side at each end, not a magnitude.
Below it is fog, above it is usually the base of a cirrus deck with clear air
underneath. So the lit band is the one in the middle.

**Depth is not drawn.** `HGT:cloud top` is diagnosed over far less ground than the
base is, so a depth layer would vanish over most of the cloud the base layer
shows. Depth, and whether the seeding band lies between base and top, are
answered at the clicked point instead, and the map's cloud top comes from the
satellite. The rest of the file's diagnostics — CAPE, storm motion, lightning,
vertically integrated liquid, echo top — ride the same build as **attributes on
that point readout, and nothing gates on them.**

### Seeding opportunity — the join

Every layer above, asked at once, per 12 km cell. A cell is a candidate where
all four hold:

- HRRR has supercooled liquid in the seeding band, at or above 10 g/m²
- the model gives a cloud base, and it sits **below the band's cold edge**
- GOES sees a cloud top at or colder than −5 °C
- MRMS is not already watching the cell rain, at or above 20 dBZ

**The band-inside-cloud test is an interval overlap.** Cloud spans base to top;
the band spans its warm edge (−5 °C, lower) to its cold edge (−18 °C, higher).
Two intervals overlap when each starts below where the other ends, so the halves
are `cloud top > band base` — which is exactly the satellite's −5 °C test — and
`cloud base < band top`, against the **cold** edge. Comparing the base against
the warm edge instead discards clouds whose base is already colder than −5 °C,
and those have the band inside them from the bottom up.

**The value drawn is the liquid water path itself**, on the liquid layer's own
levels. The join filters cells; it does not rescore them. That is what makes the
two readable against each other.

**Rejections are charged to exactly one test**, in the order above, so they
partition and the panel can say what emptied the map. A blank candidate layer
over an amber liquid layer is a bug report otherwise.

**It exists at the analysis hour only.** It leans on an observed cloud top, and
satellites cannot forecast. `at` replays the whole join at a past hour instead.

**Attributes, never gates**: cloud base against the operational window, band base
against a configured 18,000 ft ceiling, mixed-layer CAPE, integrated liquid and
storm motion — all read over candidate ground only, all reported. A band above
the ceiling in July is correct output, not a warning. Lightning cannot ride here
at all: HRRR does not diagnose it at the analysis hour.

**Absence of radar coverage does not veto.** A third of the mosaic's box has no
radar over it, and no coverage is not a report of clear air — so those cells stay
candidates and the panel reports how much ground was unchecked rather than
cleared.

### Rain — MRMS

The observed check on all of it. **Radar cannot see supercooled liquid water** —
it shows precipitation that already formed, which is the negative signal: the
cloud has already converted its liquid, so seeding has no headroom. **Radar tells
you which candidates to cross off, not where to go.** Quiet air over a cloud is
no evidence about what is inside it.

## Historical replay — the `at` parameter

Every data route takes an optional `at` (ISO 8601). **Absent means live**, and a
request without it takes exactly the code path it took before replay existed —
the live map is never routed through a historical branch to get today's weather.
`parseAt` in `lib/services/shared/replay.ts` is the one place it is read.

`at` names the **HRRR cycle**, not the valid time: `?at=2025-05-15T18:00:00Z` is
the 18z run, and `hour` still selects f00–f18 within it. The scene-based services
resolve it differently — they list the archive and take the nearest scan,
refusing anything more than 30 minutes away rather than captioning an unrelated
scene with the time that was asked for.

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
  The `Origin` on a `Cycle` selects that path, so it cannot be forgotten.
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

## Data flow

**The radar mosaic is the reference implementation** — every layer of the pattern
is visible in it, and its decode is one gzipped GRIB2 message rather than the
byte-range juggling the HRRR products need.

```
MRMS .latest.grib2.gz → RadarService (fetch, decode, contour, TTL cache)
             → GET /radar/reflectivity/stats     [routers/radar.ts]
             → Vite dev proxy (/radar → :3000)   [app/vite.config.ts]
             → GetRadarStats()                   [app/src/lib/client.ts]
             → RadarProvider dispatches to Redux [app/src/lib/context]
             → Radar selects via useAppSelector  [app/src/app/components]
```

Its **geometry** takes the shortcut every contoured layer takes — one build
serves both, so the frame feeds the layer's `url` directly and only the summary
rides the full pattern:

```
GET /radar/reflectivity → CandidateRadarLayer.url  [lib/arcgis/layers.ts]
                        → reflectivity → band fill [lib/arcgis/renderers.ts]
```

The forecast layers follow the same path: only the _metadata_ rides the store,
and the frames go straight to the layer.

```
NOMADS HRRR .idx → byte-range GRIB2 subset (~930 KB of a 390 MB file)
             → grib_get_data (eccodes) → block-average 3 km → 12 km
             → marching squares + hole nesting
             → GET /forecast/clouds?hour=N → ForecastCloudsLayer.url

GET /forecast/meta → GetForecastMeta() → ForecastProvider → forecast slice
                   → TimeSlider selects `hour` → Map.tsx repoints the layer
```

The cloud-top layer is the only one assembled from two sources, and the only one
whose geometry is observed:

```
noaa-goes19 listing → newest ABI-L2-ACHP2KMC scene (4.1 MB NetCDF4)
             → h5wasm → cloud-top pressure + projection constants
             → ABI fixed grid → HRRR's 12 km grid   [services/goes/abi.ts]
             → Hrrr.column() supplies TMP at that pressure
             → mask to tops colder than −5 °C, disjoint bands
             → GET /cloudtop/temperature → CandidateCloudTopLayer.url
```

The cloud-base build serves a layer **and** a point readout, because both come
out of the same nine `wrfsfc` records:

```
NOMADS HRRR .idx → byte-range subset of the 2D diagnostics (~10 MB, 9 records)
             → grib_filter with a sentinel outside the physical range
             → block-average 3 km → 12 km, majority rule, NaN where unsampled
             → disjoint bands on the operational window
             → GET /forecast/cloudbase?hour=N → CandidateCloudBaseLayer.url

GET /forecast/sounding?lat&lon&hour → the same cached grid, read at one cell
                                    → Sounding.diagnostics → Convective panel
```

The point sounding is the one HRRR product small enough to ride the whole pattern
into the store — a dozen levels over one point, not a field. That build is a
_national_ profile grid rather than a point query, so the first click pays ~25 s
and every later one is answered from the same cached grid in ~11 ms.

**Cache policy follows the source's own cycle.** A given HRRR run+hour never
changes, so frames cache forever and evict only when the run rolls. Profile grids
are ~12 MB each, so only the last few hours are kept. Radar and cloud-top scenes
arrive continuously with no publication cycle to key off, so both use a 5-minute
TTL and each frame carries its own valid time — the sidebar reports the scene's
age rather than implying it is live.

## Colour

One hue per claim, and they cannot be swapped without the map lying:

| Hue     | Layer                      |
| ------- | -------------------------- |
| Slate   | cloud top — context        |
| Violet  | cloud base                 |
| Amber   | modelled liquid water      |
| Cyan    | rain, modelled or measured |
| Emerald | seeding opportunity        |

Cyan is the same on both maps deliberately: it is the same quantity, and the two
never share a map. On `/map/forecast` it is what the model says will fall; on
`/map/candidate` it is what a radar just watched fall. Giving observed rain its
own hue would imply it is a different variable.

## What is still not solvable from national feeds

**Nothing free and national measures supercooled liquid water in the vertical.**
Radar cannot see it, satellite sees the top only, CIP publishes no API. The phase
and quantity of liquid _inside_ the −5…−18 °C band remains HRRR's simulation
until a ground station measures it.

So the app honestly shows **candidate volumes** — it cannot render a verdict.
That is not a defect; it is the gap the station exists to fill, and the map's job
is to tell you where to tow it.
