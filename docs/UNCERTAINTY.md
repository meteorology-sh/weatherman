# Uncertainty — how precisely we draw, and how stale the model is

Two numbers decide how finely any of this can be read: the size of the
cell a layer is drawn from, and the age of the model under it. Neither is
an error bar on the season — this is a note on what the map can and cannot
resolve, and how to quantify the model's age when it matters.

---

## 1. How finely each fill is drawn

Every fill starts as a grid and is traced into rings. The evaluation asks
for `fine=1` and gets the grid at its native cell. The map asks for the
native cell too, but only while the screen can show it; otherwise
`prepareDraw` averages 4×4 blocks before tracing.

| Source                      | Native cell | Evaluation traces | Map traces       |
| --------------------------- | ----------- | ----------------- | ---------------- |
| HRRR — base, CCL, liquid    | 3 km        | 3 km              | **12 km**        |
| MRMS — reflectivity         | 1 km        | 1 km              | 4 km             |
| GOES ABI — cloud top, phase | 2 km nadir  | 2 km              | 8 km             |
| Cloud base join             | 3 km        | 3 km              | **12 km**        |
| Seeding opportunity         | 3 km        | 3 km              | 3 km, then 12 km |

**The seeding opportunity is the exception, because it is a gate.** Every
other fill is a continuous field with an edge to interpolate along, and
averaging one removes structure without inventing any — the right
operation at any zoom. The opportunity is 0 or 1. Averaging it does not
smooth an edge, it takes a vote: a 4×4 block is drawn only where nine of
its sixteen native cells qualify, so up to seven cells of ground under a
drawn block can refuse, and a qualifying cell with eight qualifying
neighbours is not drawn at all. A click always reads the native cell, so
the two disagree wherever the vote went against the cell under the cursor.

Measured over one 1.5° × 1.2° window against the same field traced native:
**20.1% of the drawn fill refuses on a click, and 50.6% of the ground that
qualifies is not drawn.** Both directions, and neither is visible from the
map alone.

**The rule the map follows.** A native cell earns its own ring while it
covers at least one screen pixel; wider than that the average is not a
compromise but the finest thing the display can resolve, and native rings
would be structure below a pixel, fetched on every pan and never seen. The
crossover is 3 km to the pixel. A program-sized view is about 1.1 km to
the pixel and traces native; the whole country in the same window is about
4.5 km and takes the average. Every zoom an operator decides from is on
the native side of it, and `tracesNative` is asked on every settle, so the
resolution follows the zoom rather than the held request window.

**What the native trace costs.** The count that grows is polygons, not
bytes — the field fragments into the islands the average had merged.

| Window        | Coverage | Traced | Payload | Polygons | Vertices | Response |
| ------------- | -------- | ------ | ------- | -------- | -------- | -------- |
| Texas         | —        | 12 km  | 23 KB   | 27       | 1,310    | ~48 ms   |
| Texas         | —        | 3 km   | 43 KB   | 131      | 2,433    | ~60 ms   |
| Whole country | 3.3%     | 12 km  | 107 KB  | 106      | 6,254    | ~166 ms  |
| Whole country | 3.3%     | 3 km   | 192 KB  | 590      | 11,075   | ~190 ms  |

Over a program-sized window the native fill stays small on the days that
matter: across the season's painted analysis hours it is a median of 23
polygons, 82 at the ninetieth percentile, and 166 at its worst.

Three more things shape a ring after the grid is chosen:

| Step                 | What it does                                                                                                                                             | Size                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Stair simplification | Collapses marching-square steps into a diagonal                                                                                                          | 0.4 cell                  |
| Minimum ring         | Islands and holes below one cell are not drawn                                                                                                           | 1 cell                    |
| Corner rounding      | Two Chaikin passes on the map only; the evaluation keeps the stairs                                                                                      | map only                  |
| Vertex placement     | Continuous fields put the vertex where the value reaches the level; the gate fills (seeding opportunity, echo past freezing) keep the cell-edge midpoint | ±½ cell on the gate fills |

The gate fills keep midpoints deliberately: interpolating a 0/1 mask
collapses a one-cell feature to a point. So the seeding opportunity's edge
is known to about half a 3 km cell wherever it is traced native, and half
a 12 km block on the country view.

Painted rings are also rounded to three decimal places of longitude and
latitude when stored, about 110 m. That is well inside every number above
and can be ignored.

**How to say this on the map.** The honest phrasing for the legend is that
a fill marks cells, not a coastline: the edge is where a 3 km cell stopped
qualifying. On the country view it is drawn at 12 km, and a release within
a block of the edge is not outside the layer in any meaningful sense.

## 2. The HRRR time delta

The model half of every join is an hourly analysis; the radar and
satellite halves answer about the minute they were asked for. The gap
between them is the delta, and it turns into distance through the storm
motion.

**The arithmetic.** Displacement in kilometers is
`storm motion (kt) × 1.852 × minutes ÷ 60`. Every painted flare carries
its own storm motion in `drift.stormMotionKt`, so the season can be
summarized without assuming a speed.

**Two different ages.** They differ by an hour and they answer different
questions.

| Age of the HRRR analysis at the moment of release | Median |    90th |     Max |
| ------------------------------------------------- | -----: | ------: | ------: |
| As the evaluation asks — nearest analysis         | 14 min |  27 min |  30 min |
| As an operator could have had — newest posted     | 79 min | 105 min | 109 min |

| How far the storm moves over that age |  Median |    90th |     Max |
| ------------------------------------- | ------: | ------: | ------: |
| Evaluation                            |  5.3 km | 13.0 km | 26.5 km |
| Operational                           | 31.7 km | 54.6 km | 97.8 km |

The evaluation asks for the analysis nearest the release minute, which is
the closest reading of the atmosphere at that moment. HRRR posts roughly
50 minutes after its cycle time, so the newest analysis anyone actually
has in the cockpit is between 50 and 110 minutes old. The second row is
what a real dispatch runs on.

**Why this is smaller than it looks.** The delta applies only to the model
half. Where a fill's edge is placed by radar or satellite — the seeding
opportunity, the merged cloud base, echo past freezing — that edge is
current to the minute, which is why those layers are not drifted at all
(`eval/README.md`, the clock rule). What ages inside them is the base
height and the freezing level, and neither moves like a storm: they are
smooth fields that change over hours, not minutes.

So the useful statement is not "the model is 79 minutes old" but: **the
shape of the fill is current; the heights inside it are up to two hours
old.** The heights are also the half validated against radiosondes to tens
of meters, which is what makes that acceptable.

**What is worth measuring next.** Re-run one program with the model half
taken from f01 and f02 rather than the analysis, and compare the fill.
That is the only way to separate "the analysis was stale" from "the
forecast was wrong," and it is the number an operating program would
quote.

## 3. What the CCL fallback costs

The merged cloud base takes HRRR's own base where the model has a cloud
and the convective condensation level where it does not. Against the
sounding tables, the CCL runs 287 m low with a 342 m typical miss — about
940 and 1,120 feet.

That sounds worse than it is, at the use it is put to. The base is tested
against one bound, 18,000 ft MSL:

| At the release cell                                    | Share |
| ------------------------------------------------------ | ----: |
| Base came from the CCL rather than HRRR                | 20.5% |
| Base within 940 ft of the ceiling (the CCL bias)       |  1.4% |
| Base within 1,120 ft of the ceiling (the typical miss) |  1.7% |

Median base at a release is 10,516 ft MSL. A thousand feet of error at ten
thousand feet does not move a test set at eighteen thousand: at most 1.4%
of flare verdicts could flip on the CCL's bias, and the layer is gated by
a measured echo top regardless, which is the stronger of the two tests.

**Where it would matter.** Any rule that uses the base as a continuous
quantity rather than against a distant bound. Warm-cloud depth is the
obvious one — freezing level minus base is about 5,000 ft in West Texas,
and 940 ft is a fifth of it. If a hygroscopic rule is ever built (§5), the
CCL's bias stops being negligible and has to be carried.

## 4. Position precision, in one table

The reports do not locate flares equally well, and the check that says so
does not involve Weatherman at all: does the release land inside the
county its own row names?

| Program        | Lands in its named county | Seeding opportunity |
| -------------- | ------------------------: | ------------------: |
| Trans Pecos    |                 **96.1%** |               91.1% |
| West Texas     |                 **93.8%** |               83.5% |
| South Texas    |                     78.3% |               54.9% |
| Panhandle      |                     76.5% |               72.5% |
| Rolling Plains |                     58.5% |               62.5% |

The two rank almost together, which is the first thing to say about any
difference between programs. Restricting each program to the flares that
do land in their named county:

| Program        | In its named county | Somewhere else |
| -------------- | ------------------: | -------------: |
| Trans Pecos    |               91.9% |          72.2% |
| West Texas     |               84.1% |          74.2% |
| Panhandle      |               75.9% |          61.7% |
| Rolling Plains |           **75.9%** |          42.1% |
| South Texas    |           **50.9%** |          66.7% |

Rolling Plains rises from 62.5% to 75.9% once the badly located flares are
set aside: most of its gap is the report format, not the weather. South
Texas moves the wrong way. Whatever is happening there is not a position
problem.

## 5. Do South Texas and Rolling Plains need a different evaluation?

Probably yes for South Texas, and for a reason the reports show plainly.
The clouds are not the same clouds.

Median values at the release cell:

| Program         | Cloud base MSL | Base above ground |      Echo top | Top past freezing |
| --------------- | -------------: | ----------------: | ------------: | ----------------: |
| Trans Pecos     |      10,916 ft |          7,730 ft |     32,808 ft |         17,886 ft |
| West Texas      |      10,108 ft |          7,601 ft |     30,156 ft |         15,246 ft |
| Panhandle       |      10,684 ft |          7,755 ft |     34,449 ft |         19,054 ft |
| Rolling Plains  |      10,034 ft |          7,794 ft |     29,117 ft |         14,750 ft |
| **South Texas** |   **6,423 ft** |      **5,627 ft** | **18,248 ft** |      **6,644 ft** |

South Texas seeds into cloud whose base is four thousand feet lower and
whose top is twelve thousand feet lower than everywhere else in the state
— Gulf-fed convection rather than high-plains or mountain storms. The
seeding opportunity's own refusals say the same thing:

| Program        | Said FLY | Refused: top below freezing | Refused: base too high |
| -------------- | -------: | --------------------------: | ---------------------: |
| Trans Pecos    |      90% |                          8% |                     1% |
| West Texas     |      83% |                         12% |                     2% |
| Panhandle      |      73% |                         18% |                     6% |
| Rolling Plains |      53% |                     **32%** |                     9% |
| South Texas    |      59% |                     **37%** |                     1% |

The fill is not failing to find these clouds. It is finding them and
declaring them too warm on top, which is exactly what a rule written for
ice-nucleating seeding should do over a warm-topped cloud.

**The salt-flare question, measured.** Every program flies both kinds of
flare, and the day totals in the reports say how many of each:

| Program        | Glaciogenic | Hygroscopic | Hygroscopic share |
| -------------- | ----------: | ----------: | ----------------: |
| West Texas     |       1,080 |          55 |              4.8% |
| Trans Pecos    |       1,143 |          51 |              4.3% |
| Panhandle      |         499 |          37 |              6.9% |
| South Texas    |         205 |          18 |              8.1% |
| Rolling Plains |          71 |           7 |              9.0% |

South Texas and Rolling Plains do lean harder on salt, but by six points,
not by a category. Nine percent of releases cannot carry a thirty-point
difference in overlap. And the counts are per day, not per flare, in the
three programs that report them that way — so a hygroscopic release cannot
be excluded from scoring today, only bounded at under a tenth of the
releases.

**The conclusion.** Rolling Plains is mostly a position problem and is
already most of the way back once that is accounted for. South Texas is a
cloud-population problem: a warm-based, warm-topped regime being judged by
a cold-cloud rule. The fix is a second fill for hygroscopic seeding —
warm-cloud depth from base to freezing level, a base the aircraft can
reach, and the updraft flank — reported beside the glaciogenic one rather
than blended into it. Until that exists, South Texas should be reported as
its own line and not pooled into a season figure that means something
different for it.

## 6. What a radial program is

Three of the five programs do not print where a flare was released. They
print a direction and a distance, and leave the starting point unsaid.

A row reads like _115° at 39 nautical miles_ — go out on a compass heading
of 115 degrees for 39 nautical miles and that is where the flare left the
airplane. This is the ordinary way a radar operator talks: the display is
centered on the radar, so everything on it is naturally a bearing and a
range from the middle of the screen.

Two things are missing from that, and both cost us.

**Where the center is.** The reports never say. `positions.mjs` settles it
by trying candidate origins and keeping the one that puts the most flares
inside the county their own row already names: the radar at Amarillo for
the Panhandle, the town of Pleasanton for South Texas. Both are
inferences, and a center placed a few miles wrong slides every flare in
that program by the same few miles.

**Which north the compass points at.** The bearings are magnetic.
Aviation measures a bearing from magnetic north using the variation of
record the FAA assigns the airport or navaid it is taken from — a value
fixed at an epoch, not moved each year with the field. Amarillo's is 8°E
and Pleasanton's is 6°E, both at epoch 2000, and each region's
`magneticVariationDeg` adds it to every printed bearing before the flare
is placed. It is not a small correction: at 39 nautical miles eight
degrees moves a flare about 10 km, more than three of the cells the fills
are drawn on.

`positions.mjs` is the check. A bearing read against the wrong north
turns every flare by the same angle, so the flares that miss their named
county all lean one way; read against the right one, a miss is a pilot
naming the county they were working and leans neither way. It prints the
split and the further turn that would place the most flares, and both
should read even and zero.

Rolling Plains is a different failure. It prints real coordinates, but
rounded to a tenth of a degree on some rows — and a tenth of a degree is
11 km, which is nearly four cells. The number looks precise and is not.

**What is left.** The center is still an inference. A distance measured
for a radial program is a distance from an inferred point, and should be
read as such.
