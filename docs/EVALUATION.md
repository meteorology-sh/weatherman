# Evaluation — does the map agree with what Texas actually flies

**Evaluate against the season** means: score every located 2025 flare
against Weatherman's own layers at that minute, re-score the 12Z balloons
against the modeled seeding band, and store JSON the eval app reads as
regional maps and tables.

Three analyses of every painted 2025 release, then one check of the seeding
band against the balloons. The tables below are the complete Texas season in
`eval/out/`: the original layers, the fills the operator map draws, and the
Texas selection features, on every located flare. How to run that job is
`eval/README.md`.

1. **How many flares sat in each original Weatherman layer?** Cloud base,
   cloud tops, radar reflectivity, supercooled liquid water, and the
   supercooled liquid water, at the minute and place each flare left the
   aircraft.
2. **How many flares sat in each fill the operator map draws, and how
   much ground did each one paint?** The seeding opportunity, the
   cloud-base fill, and echo past freezing. Overlap without area cannot
   tell selecting from painting: a fill that covers the target area
   contains every release.
3. **How many flares sat in each Texas selection feature?** Upwind of the
   heaviest rain, inside 20 dBZ, nearer the edge than the core, and an
   18 dBZ echo top at or above freezing.
4. **Is the seeding band in the right place?** The layer we draw against
   the radiosonde table in that day's report.

The numbers below are the same counts the evaluation app already shows.
This file is those tables written out.

**These tables were painted before the seeding opportunity took its
current form.** They score a fill whose base test was the service ceiling
alone, which rejected a cell the model had no cloud base in and had no
12,000 ft AGL criterion, and a base fill drawn on a 4,000–12,000 ft
window rather than an upper bound. `INVESTIGATION.md` Finding 9 is what
those numbers showed and what changed because of it. Reprint this file
from a repainted `eval/out/` before quoting any figure here as the
current fill's score.

`WEATHERMAN.md` says what the app claims. `MEASUREMENTS.md` says what the
free feeds can answer. The comparison itself is the harness in `eval/`.

---

## The ground truth

Texas licenses several weather modification programs. Everything below is
one of them. Each daily report carries every flare — position, UTC minute,
aircraft, and whether it was silver iodide or salt — and, where the program
briefs on a balloon, a sounding table.

**117 flying days, 1,353 located flares.** Nine more releases have a time
and no usable position, so they are out of the point results: two West
Texas with a county and no coordinates, six Trans Pecos on 27 March with
nothing, and one Trans Pecos longitude of −1033.7377. 27 March is a flying
day with no located flare, which is why the painted season is 116 days.
The Panhandle briefs on a NAM forecast column rather than a balloon, so it
is in the flare tables and out of the band table.

The flare tables are the 116 painted days. The band table is calculated
from the balloon JSON on flying days; that comparison does not need the
painted frames.

---

## Flare overlap with each fill the operator map draws

The operator map draws three fills: the seeding opportunity, the cloud-base
window, and echo past freezing under the radar. The seeding opportunity is a
composite of the Texas tests, drawn as one fill so the operator can see where
to click. These are the layers a crew would have had in front of them.

| Program        | Releases | Seeding opportunity |       Base window | Echo past freezing |
| -------------- | -------: | ------------------: | ----------------: | -----------------: |
| West Texas     |      497 |     279/497 (56.1%) |   266/497 (53.5%) |    325/497 (65.4%) |
| Trans Pecos    |      465 |     305/461 (66.2%) |   324/465 (69.7%) |    349/461 (75.7%) |
| Panhandle      |      255 |     154/255 (60.4%) |   125/255 (49.0%) |    149/255 (58.4%) |
| South Texas    |       83 |       32/71 (45.1%) |     28/83 (33.7%) |      24/83 (28.9%) |
| Rolling Plains |       53 |       21/48 (43.8%) |     22/53 (41.5%) |      22/48 (45.8%) |
| Season         |    1,353 |   791/1,332 (59.4%) | 765/1,353 (56.5%) |  869/1,344 (64.7%) |

**The seeding opportunity covers 59.4% of releases**, against 6.9% for
supercooled liquid water in the first table. The fill Texas would actually
have flown accepts the rain a liquid test rules out.

The evaluation app shows these three on the program page and as columns
on every release under THE FLARES.

## Ground each of those fills painted

An overlap figure alone cannot tell a fill that selects from a fill that
covers everything. This is the median ground each fill drew per analysis
hour, against the ground that hour was asked about — the same window the
painter used. Each of these three is a single-level mask, so the area of
its polygons is the ground it covers; the banded layers are left out
because one number over a ramp would not mean the same thing.

| Program        | Hours | Ground asked | Seeding opportunity |     Base window | Echo past freezing |
| -------------- | ----: | -----------: | ------------------: | --------------: | -----------------: |
| West Texas     |    82 |      892,872 |       45,880 (5.1%) | 246,193 (27.6%) |      39,964 (4.5%) |
| Trans Pecos    |    88 |      199,195 |       16,229 (8.1%) |  87,082 (43.7%) |      11,661 (5.9%) |
| Panhandle      |    51 |       51,430 |       7,160 (13.9%) |  16,787 (32.6%) |      6,205 (12.1%) |
| South Texas    |    22 |       78,429 |      12,448 (15.9%) |  29,313 (37.4%) |      9,605 (12.2%) |
| Rolling Plains |    10 |       65,362 |       7,610 (11.6%) |  23,465 (35.9%) |      7,383 (11.3%) |

Square kilometers. The programs are not comparable across rows: each
paints its own window, and West Texas's is more than four times the size
of Trans Pecos's, so the share is the column to read.

**The seeding opportunity found 59.4% of the releases on 5–16% of the
ground.** That ratio, not the overlap on its own, is what a change to the
join has to hold or improve.

---

## Flare overlap with each Texas selection feature

Texas programs select the upwind side of a raining cell, near the edge,
with the echo top at or above freezing. The evaluation app already scores
those four features at the analysis each flare is charged to. The table
below is that page, pooled.

Inside 20 dBZ means the drifted point sat in a contiguous radar object.
Echo top is the measured 18 dBZ height against the modeled freezing
level. Nearer the edge and upwind are distances and heading on that same
object. A flare with no 20 dBZ echo within about 40 km is a no on radar
and is dropped from the other columns rather than counted as a no there.

| Program        | Releases |            Upwind |         In 20 dBZ |     Nearer the edge | Echo top past freezing |
| -------------- | -------: | ----------------: | ----------------: | ------------------: | ---------------------: |
| West Texas     |      497 |   229/442 (51.8%) |   303/497 (61.0%) |     447/470 (95.1%) |        463/467 (99.1%) |
| Trans Pecos    |      465 |   167/421 (39.7%) |   310/465 (66.7%) |     429/458 (93.7%) |        453/454 (99.8%) |
| Panhandle      |      255 |   119/234 (50.9%) |   129/255 (50.6%) |     242/255 (94.9%) |        244/246 (99.2%) |
| South Texas    |       83 |     31/76 (40.8%) |     24/83 (28.9%) |      83/83 (100.0%) |          74/81 (91.4%) |
| Rolling Plains |       53 |     25/40 (62.5%) |     20/53 (37.7%) |       45/48 (93.8%) |          45/47 (95.7%) |
| Season         |    1,353 | 571/1,213 (47.1%) | 786/1,353 (58.1%) | 1,246/1,314 (94.8%) |    1,279/1,295 (98.8%) |

**Just over half the releases sat inside 20 dBZ. Almost all of those
storms had an 18 dBZ top at or above freezing.** The typical geometry is
nearer the edge than the heaviest rain (94.8%). Upwind of the heaviest
rain is about half (47.1%). South Texas is the program that sits
outside the rain: 24 of 83 inside 20 dBZ.

These four features are overlap with the object they already fly.

The evaluation app shows these four on the program page and as columns
on every release under THE FLARES.

---

## The seeding band against the balloons

The seeding band is the layer of cloud cold enough for silver iodide to
work: from the freezing level up to about −15 °C. Everything the product
does depends on drawing that layer in the right part of the sky.

The National Weather Service flies a balloon from Midland and from Del Rio
twice a day. Four programs brief on those ascents: West Texas reads both,
Trans Pecos and the Rolling Plains read Midland, South Texas reads Del Rio.
The 12Z ascent lands on a model analysis hour, so neither side is rounded
to meet the other.

Each edge column is signed bias, then the typical miss. Bias is the height
we drew minus the balloon's, so a negative number means we put that edge
lower. The typical miss is the median of the absolute errors. Band overlap
is the mean share of the combined layer both sides agree on, so a band
drawn far too deep is penalized rather than rewarded for covering
everything.

| Program        | Ascents | Freezing level | −15 °C height | Band overlap | Cleared 90% |
| -------------- | ------: | -------------: | ------------: | -----------: | ----------: |
| West Texas     |      64 |   −31 m / 45 m |  −26 m / 57 m |    **94.7%** |    56 of 64 |
| Trans Pecos    |      39 |   −25 m / 32 m |  −10 m / 48 m |    **95.5%** |    36 of 39 |
| South Texas    |      11 |   −20 m / 40 m |  −33 m / 26 m |    **95.2%** |    11 of 11 |
| Rolling Plains |       7 |   −23 m / 15 m |  −66 m / 55 m |    **95.4%** |      6 of 7 |

The layer is 2,429 m deep at the median. Bias sits within 70 m of zero on
every edge, so the misses are scatter rather than a standing offset.

**The four programs are not four independent samples.** Midland serves
West Texas, Trans Pecos and the Rolling Plains, so a morning all three
flew is one balloon counted three times: 121 scored ascents, 101 distinct.
The 101 distinct mornings have a mean overlap of 95.0%. The
per-program rows say the result is not an artifact of one target area.
They should not be added together.

**One ascent is excluded on physical grounds.** South Texas prints a
freezing level of 4072 m and a −15 °C height of 4944 m on 31 March: 872 m
apart, 17.2 °C/km. The dry adiabatic lapse rate is 9.8 °C/km. One of those
two numbers is a typo, and using our column to decide which to keep would
be judging the balloon by the model. The whole morning is dropped from
both edges.

The evaluation app draws every scored ascent as a pair of columns and
lists the overlap of each one in a table, under THE BAND.

**The Panhandle is not in this table.** It briefs on a NAM forecast
column. Checking HRRR against NAM compares two models and would report
their agreement as accuracy.

---

## Limits to quote alongside the results

**The balloon is close in time, not simultaneous.** It is released about 45
minutes before its nominal hour and reaches the seeding band minutes into
the flight, so the gap is 20–30 minutes. That is survivable here and would
not be for a flare: a temperature profile at 4–7 km moves tens of meters in
an hour, while a growing storm swings 40 dBZ in the same span.

**The sounding numbers are the operator's reading**, lifted from their
report rather than from raw balloon data, so they carry that reading's
mistakes. Impossible values are dropped when scored.

**Two sites, one hour.** Midland and Del Rio bracket the target counties
without sitting inside most of them, and 12Z is morning while seeding flies
in the afternoon.

**Native sampling is the resolution limit of the flare tables**: 3 km for
the HRRR fields, 2 km for GOES cloud tops, 1 km for the radar
storm. A 4 km bearing-and-range error and leftover drift if the storm
turned sit on top of that, and are named per release rather than folded
into inside. Two programs print a bearing and a range from an origin
their reports never name; those rows are projections.

**This measures the atmosphere, not what a forecaster could have had.**
Each release is scored against the reading nearest it in time. The model
publishes about 50 minutes after the hour, so nobody actually held the 19Z
reading at 1843Z. That is a limit on operating from this platform, not on
measuring against it, and the two must not be quoted as one number.

**Rainfall is not measured and no claim is made about it.** Attribution
needs a randomized or target/control design over seasons, not a season of
flare positions.

**How far back this can go at all:** the model reaches 2014-07-30, radar
2020-10-14, and satellite cloud top only 2023-03-23. The satellite binds.

---

## Reproducing this

SSH into the us-east-1 box, start one Weatherman API per painter, and run
one `paint.mjs` per flying day in parallel, then `balloons.mjs` for each
sonde program. How to run that job, what JSON it writes, and how the
eval app should drive from those files, is `eval/README.md`. The flight
records are already in `eval/data/`.

The flare tables are pooled from the painted files. Band overlap is
calculated from the balloon JSON.

```bash
node eval/verify.mjs
node eval/score-season.mjs
```

The evaluation app at `/<program>` lists the flare tables and THE BAND.
This file is the result. After a complete Texas `out/`, reprint the
tables from `score-season.mjs` into this file.

## Sources

- [WTWMA 2025 operations, with the per-day reports](https://westtxwxmod.com/?page_id=23)
- [TDLR — rain enhancement operations in Texas](https://www.tdlr.texas.gov/weather/summary.htm)
- [Census TIGERweb State_County service](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer)
- Friedrich et al. (2020), _Quantifying snowfall from orographic cloud seeding_,
  PNAS 117(10) 5190–5195 — [PMC7071876](https://pmc.ncbi.nlm.nih.gov/articles/PMC7071876/)
- Buckets: `noaa-hrrr-bdp-pds`, `noaa-goes16`, `noaa-goes19`, `noaa-mrms-pds`
