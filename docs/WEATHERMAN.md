# Weatherman — what it is, and what each layer claims

The operator-facing software for a field-deployable cloud-seeding weather station
(part of the Rainmaker project). The station fuses local sensor data with free
national feeds — NEXRAD, GOES, HRRR — into a single _seedability_ verdict: is
there supercooled liquid water in the seeding band worth sending a drone to, and
did seeding work. The system design lives outside this repo at
`/home/nathan/code/rainmaker/weatherman`. This web app is the operator dashboard.

**Scope is Texas, rainy season.** `AGENTS.md` says how the code is written;
`MEASUREMENTS.md` says what the free feeds can and cannot answer, and holds the
sampling rule that decides whether a proposed layer is honest at all. **Read
`MEASUREMENTS.md` before adding a data source** — most of it rules things out.

## Standing rules

- **No raster on any map, ever.** An image has no nodata: it fills clear sky
  opaquely and buries the basemap. Every layer is GeoJSON from our own server.
- **No sampled field is interpolated past what it measured.** Each layer is
  drawn at native sampling — HRRR 3 km, GOES 2 km, MRMS 1 km. The server
  still builds the national grid; the map asks for one window of it, about
  the size of Texas, and does not draw that window when zoomed out further.
  Averaging removes structure and is fine; interpolating invents it and is
  not. The join samples GOES and MRMS onto HRRR's 3 km cells (majority /
  nearest), never the other way. Compare a variable's correlation length to
  the sample spacing before drawing any new field (`MEASUREMENTS.md` §3).
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

**Clicking is how the panel is read.** A click profiles that point's column,
reads that cell's convective diagnostics, and asks every layer what it says over
that one 3 km cell — what the cloud there is made of, which test ruled it out
if any, and when each source saw it. That readout leads the panel because it is
the only part of it about the cloud an operator is looking at.

**A click outside the model does nothing.** The grid is a Lambert quadrilateral
and every readout answers by snapping a click to the nearest cell, so a click on
the ocean would otherwise be answered with the nearest edge cell's weather. The
server refuses it — a 404, because asking about somewhere the model does not
reach is a fair question with the answer "not here", and a 500 would tell an
operator the server broke when nothing did. The map holds the same edge as a
ring and does not send the request at all: the point does not move, so the last
cell an operator picked stays on the panel rather than being replaced by an
error or by a blank.

**Nothing about a point is drawn until one is picked.** There is no _this point_
until someone clicks, and a column, a set of diagnostics and a verdict over the
centre of the country are dashes about a cell nobody asked for. The column _is_
read over that default point on arrival, because that build is the national
profile grid every later click is answered from — warming it, not drawing it, is
the difference between a first click costing ~30 s and costing milliseconds.

**This panel carries no figure about the whole domain.** How much ground in the
country passed every test, how much cloud the satellite sees anywhere, what
share of the grid a radar is looking at — an operator flies one cloud, and none
of it decides anything a sortie does. It reads worse than useless next to a
clicked point: a heading like CLOUD TOPS over a number is indistinguishable from
the same heading over a cell, so a domain total sitting under a click is read as
that cell's. Every one of those summaries is still built and the replay panel
reports them, where the question really is what a whole hour looked like.

**The seeding-opportunity layer is the answer the other four are inputs to**, drawn over
all of them. It is the only layer that starts on: the map opens on its answer,
and the operator switches on whichever inputs they want to check it against.
Switching the amber back on reads the two together — amber with no green over it
is liquid the join rejected, and clicking it says which condition ruled it out.

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
`h5wasm`, contoured on the ABI 2 km grid. Temperature at each pixel comes from
the nearest HRRR 3 km column at that pressure. The join samples those pixels
onto HRRR's 3 km cells.

**This is the one layer built from two sources**, and the split is deliberate:
HRRR nails the thermodynamic profile and is much shakier on cloud, so the
satellite says _where the top is_ and the model says _how cold it is there_. That
also makes it the only cloud layer that can contradict the supercooled-liquid
contours drawn over it.

It has **real nodata** — where the satellite sees no cloud, nothing is drawn. It
is **filtered**: only tops at −5 °C or colder appear, because a warmer top means
the seeding band lies above the cloud entirely, which accounts for most cloudy
ground over a Texas year. The bands are **disjoint, not nested**, and the ramp
runs backwards — warmest band loudest — **because of the ice**. Silver iodide
only does something in a cloud that still holds liquid, and natural ice-forming
particles are scarce in the warmest part of the subzero range and common well
below it, so a colder top is likelier to have frozen on its own and already
spent the water seeding would have converted.

That is a preference, not a test. It cuts both ways — a colder top also means
more of the band sits inside the cloud — and cloud-top temperature is the
coldest part of a cloud rather than a summary of it, so a vigorous cell with a
very cold anvil can still carry liquid in the band. There is **no cold cutoff**
and the coldest band stays on the map. A faint top band under bright liquid
contours is that case rather than a contradiction; **neither layer observes
phase**, so prefer the one that is at least about the liquid and hold it as
HRRR's opinion rather than a measurement (`MEASUREMENTS.md` §2, §4).

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
`HGT:cloud base` says how high the bottom of the cloud sits. **The layer is a
height ramp in ft MSL and makes no other claim** — how far there is to climb
before there is cloud to work with, and nothing about what kind of cloud it is.

Its four bands are **thirds of the aircraft's 18,000 ft service ceiling**, so
every edge traces to one cited number — `CEILING_FT` in
`server/src/lib/services/shared/aircraft.ts`, mirrored in the app's `bands.ts` —
rather than to a coverage table. Two thirds of the ceiling lands on 12,000 ft,
which is also the top of the Texas window; that is a coincidence, and
`bands.test.ts` pins the derivation so it cannot be mistaken for a citation.

It has **real nodata**, and its bands are **disjoint**: a height is a position,
not an accumulation, so exactly one applies to a cell. **The ramp runs
loud-to-quiet**, like the cloud tops — brightness is how short the climb is, not
how big the number is. The last band is open above the ceiling and still drawn,
because a base too high to reach and no cloud at all are different answers.

**MSL because the aircraft is**: a service ceiling, air density and climb
performance all refer to sea level, so this is the datum a sortie is planned in.
The cost is that it says nothing about cloud type — 6,000 ft is a low convective
base at the Gulf coast and near-surface fog on the Llano Estacado. The point
readout carries `cloudBaseAglFt` alongside for that.

**This is the bottom of the cloud, not the bottom of the seeding band.** Where
the column first reaches seeding temperature is a different altitude, often
thousands of feet higher; the candidate summary reports it as
`medianBandBaseFt`.

The **4,000–12,000 ft window** the state's published description names is cited,
reported in the candidate summary, and **drawn nowhere**: read against sea level
it means a different height above ground over every cell, from most of an
8,000 ft layer at the coast down to a sliver over high terrain where its lower
edge is underground. Nothing filters on it, or on the ceiling.

**Depth is not drawn.** `HGT:cloud top` is diagnosed over far less ground than the
base is, so a depth layer would vanish over most of the cloud the base layer
shows. Depth, and whether the seeding band lies between base and top, are
answered at the clicked point instead, and the map's cloud top comes from the
satellite. The rest of the file's diagnostics — CAPE, storm motion, lightning,
vertically integrated liquid, echo top — ride the same build as **attributes on
that point readout, and nothing gates on them.**

### Seeding opportunity — the join

Every layer above, asked at once, per 3 km cell. A cell is a candidate where
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
partition. That is what lets a cell be told the one thing that ruled it out, and
what lets the replay panel say what emptied a whole hour. A blank candidate
layer over an amber liquid layer is a bug report otherwise.

**It exists at the analysis hour only.** It leans on an observed cloud top, and
satellites cannot forecast. `at` replays the whole join at a past hour instead.

**Attributes, never gates**: cloud base against the operational window and band
base against a configured 18,000 ft ceiling, read over candidate ground only and
reported. A band above the ceiling in July is correct output, not a warning.
Mixed-layer CAPE, integrated liquid and storm motion are attributes too, and
they are read at the clicked point rather than as domain peaks — a domain-wide
peak is a number about whichever cell happened to be strongest, which is rarely
the one on screen. Lightning cannot ride here at all: HRRR does not diagnose it
at the analysis hour.

**Absence of radar coverage does not veto.** A third of the mosaic's box has no
radar over it, and no coverage is not a report of clear air — so those cells stay
candidates and the summary counts how much candidate ground was unchecked rather
than cleared. Over a clicked cell the two are named apart: a quiet radar reads
as no echo, and ground no radar covers says so.

**Observed cloud-top phase rides alongside as a fifth reading and not a fifth
test.** Everything the join says about liquid water is HRRR's; GOES publishes a
per-pixel classification of the cloud top as clear, liquid, supercooled, mixed
or ice, and that is the only observation of phase in the app. It is counted two
ways, because the two disagreements cost different things: candidate ground
whose top the satellite already sees frozen may be a cloud that has spent its
liquid, and ground with a supercooled top the model drew nothing over is cloud
that never reached the map to be rejected at all. The clicked point reports the
class in words.

**The second count is the larger and the weaker.** A supercooled top is a
statement about one surface; the liquid field is a path integral through the
seeding band, so a thin supercooled deck can sit honestly below the lowest
contour. It routinely covers more ground than the candidate field, and it is
ground worth looking at rather than a tally of model errors.

**It cannot rule anything out, and the reason is geometry.** The classification
is of the cloud top and the seeding band is inside the cloud, so it never
observes the thing the candidate field claims. It also describes the highest
deck only: cirrus over a growing turret classifies as ice, and that failure
concentrates in exactly the layered scenes where model and satellite are most
likely to differ. The panel says so wherever it prints a phase.

**The cross-check may fail without taking the field with it.** Every other input
decides whether a cell is a candidate, so losing one means the answer would be
wrong. This one decides nothing, so a scene that will not download leaves a
build that reports one fewer thing — and the panel says the check is missing
rather than showing zeroes, which would claim the satellite looked and confirmed
nothing.

**Where the observation is, the map outlines.** The confirmed ground is traced a
second time from the same array and drawn as a hollow outline over the field, at
the field's lowest level only — one boundary, because the fills underneath
already say how much liquid is there and this says only which of it has an
observation behind it. One switch drives both: an outline with no field under it
would mark ground the map is not drawing. It is an annotation and never a
subset, and clicking inside or outside it returns a candidate either way.

**The outline is about phase, not temperature.** It encloses cells whose top the
satellite classifies as supercooled or mixed. Liquid stays liquid well past
−20 °C, so a colder top can be inside the outline and a warmer one outside it —
that is the outline working, not failing. Cloud-top temperature ranks cloud and
cannot separate a turret that has frozen from one that has not; this can.

**A point is read against the cell whose footprint covers it.** A cell's
footprint is the 3 km block that was averaged into it — a square in the grid's
own rows and columns — and that is the square the contours are traced from, so
the readout and the bands are answering in the same space. Not the nearest cell
_centre_ in latitude and longitude: HRRR's grid is Lambert, its rows lean away
from the central meridian, and near a boundary the nearest centre is a different
cell from the one the ground belongs to.

**A band's drawn edge is smoothed, and near a concave corner it overhangs a cell
it excludes.** The tracer cuts across a corner rather than turning it, so where a
band bends inward — around a hole, along a one-cell diagonal — the fill covers
part of a neighbouring cell that failed a test. A click there reads that
neighbour, correctly: the cell is excluded and the band is what is drawn
loosely. No cell lookup closes this, because there is nothing wrong with the
lookup; it is the price of a smooth boundary over a 3 km grid, and it is worst
exactly where the candidate field is thinnest. **The coordinates in the panel
are the answer**, not the pixel under the cursor.

**The map is drawn from one build and the panel answers from the current one,
so the map follows the build.** The server rebuilds the join as its sources roll
— a satellite sweep every 5 minutes, a radar scan every 2 — while the layers
fetch their geometry once. A build is named by all four times together, and when
a click's answer names a newer one than the layers hold, the field and its
outline are refetched. Nothing polls: a map nobody has clicked can be sitting on
the build it opened on, and the panel prints every source's scan time so that is
visible rather than implied.

**A rejection for "no cloud seen" is a rejection by the pressure retrieval.**
That retrieval has no answer over a large share of low warm liquid cloud, so the
phase scan can be describing the top of a cloud the cloud-top layer reports
clear sky over. The panel prints both, and a cell rejected this way is usually
one a warm top would have rejected anyway — but the reason it gives is about the
instrument (`MEASUREMENTS.md` §4).

#### Two seeding strategies, and which one this map serves

Texas seeds **growing convective turrets**: cloud base 4,000–12,000 ft, a top
normally between −5 and −10 °C, seeded through cloud-base inflow, with severe
storms excluded under TDLR permit. That is glaciogenic seeding of young cloud
that has not yet frozen on its own — silver iodide does nothing in a cloud that
already has ice, because the process seeding exists to trigger is the one that
has already run there.

**The candidate field does not select for that.** Its mask has a warm edge at
−5 °C and no cold edge at all, so a young turret with a −8 °C top and a mature
complex under a −60 °C anvil both qualify, identically. That is deliberate:
there is no cold cutoff because a physical cutoff needs a citation and none
supports a particular number, and because a colder top also means the seeding
band is more fully enclosed by cloud. The two readings pull opposite ways and
neither gates (`MEASUREMENTS.md` §4).

**The observed phase outline is the first thing that separates them without a
threshold.** A classified cloud top is measured, not chosen, so it draws the
young-turret distinction that a temperature cutoff would have had to invent. It
is drawn and never filtered, because a spreading anvil classifies as ice over
cloud that is still growing underneath it — the outline says where the evidence
is, not where the cloud is.

**What the map still cannot tell you is whether a cloud is growing.** One scene
gives the state of a cloud top, not its direction, and a turret that has just
frozen looks the same as one that froze an hour ago. Until that is answered, the
outline narrows where to look and the operator judges the rest.

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
             → grib_get_data (eccodes) → native 3 km Lambert grid
             → marching squares + hole nesting
             → GET /forecast/clouds?hour=N → ForecastCloudsLayer.url

GET /forecast/meta → GetForecastMeta() → ForecastProvider → forecast slice
                   → TimeSlider selects `hour` → Map.tsx repoints the layer
```

The cloud-top layer is the only one assembled from two sources, and the only one
whose geometry is observed:

```
noaa-goes19 listing → newest sweep both products filed [services/goes/sweep.ts]
             → its ABI-L2-ACHP2KMC scene (4.1 MB NetCDF4)
             → h5wasm → cloud-top pressure + projection constants
             → ABI 2 km grid, temperature from nearest HRRR column
             → Hrrr.column() supplies TMP at that pressure
             → mask to tops colder than −5 °C, disjoint bands
             → GET /cloudtop/temperature → CandidateCloudTopLayer.url
```

The phase scene is read off the same bucket by the same machinery, from the
**same sweep** — the two are never asked separately, or the join would report a
cloud top and a cloud phase measured five minutes apart. It is the one GOES
product with no layer and no route: the join reads it and the panel reports it.

```
noaa-goes19 listing → the same sweep's ABI-L2-ACTPC scene (666 KB NetCDF4)
             → h5wasm → one class per pixel + projection constants
                                                [services/goes/scene.ts]
             → ABI 2 km → HRRR 3 km, commonest class per cell
             → CandidateStats.phase + CandidatePoint.topPhase
```

The cloud-base build serves a layer **and** a point readout, because both come
out of the same nine `wrfsfc` records:

```
NOMADS HRRR .idx → byte-range subset of the 2D diagnostics (~10 MB, 9 records)
             → grib_filter with a sentinel outside the physical range
             → native 3 km, NaN where unsampled
             → disjoint bands on the operational window
             → GET /forecast/cloudbase?hour=N → CandidateCloudBaseLayer.url

GET /forecast/sounding?lat&lon&hour → the same cached grid, read at one cell
                                    → Sounding.diagnostics → Convective panel
```

The point sounding is the one HRRR product small enough to ride the whole pattern
into the store — a dozen levels over one point, not a field. That build is a
_national_ profile grid rather than a point query, so the first click pays ~25 s
and every later one is answered from the same cached grid in ~11 ms.

The join answers a click the same way, off the same build the map is drawing:

```
GET /candidate/point?lat&lon → the cached join, read at one cell
                             → CandidatePointProvider → seedability slice
                             → CloudHere selects via useAppSelector
```

**The build keeps the arrays it joined**, not just the contours, which is what
lets a click be answered from the picture on screen rather than from a fresh
read of five sources. They are references to grids each source already caches,
so keeping them cost nothing.

That settles a cell **within** a build. Across builds it takes the store: the
summary route names the build the layers opened on, every click's answer names
the build it came off, and a change sends the field and its outline back for the
new geometry.

```
GET /candidate/field/stats → SeedabilityProvider → seedability.drawn
GET /candidate/point       → CandidatePointProvider → seedability.drawn
                           → Map.tsx refreshes the field and its outline
```

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
