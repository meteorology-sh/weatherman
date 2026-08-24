# Evaluation — does the map agree with what Texas actually flies

Two questions, in order, asked of all five programmes Texas licenses.

1. **Is the seeding band in the right place?** Check it against the weather
   balloons the operator briefs on every morning.
2. **Do operators seed near the layers we draw?** Measure the distance from
   every release to the nearest edge of each layer, at the minute and place it
   left the aircraft.

The first is answered and the answer is yes, in all four programmes that fly a
balloon. The second splits three ways: the typical release sits inside the
cloud base we draw and often inside the echo; it sits tens of kilometres from
the cold cloud tops we draw; and it is almost never inside the supercooled
liquid or a seeding opportunity.

A third finding falls out of asking the second question in five places at once:
supercooled liquid under the aircraft is rare in every programme, and radar
is the column that actually splits.

`WEATHERMAN.md` says what the app claims. `MEASUREMENTS.md` says what the free
feeds can answer. This file says what happened when we checked.

---

## The ground truth

Texas licenses several weather modification programmes and everything below is
one of them. The West Texas Weather Modification Association publishes a report
for every day it flies. Each report carries:

- **every flare** — position, UTC minute, aircraft, and whether it was silver
  iodide or salt
- **a sounding table** for Midland and Del Rio, nine readings each
- **the pilots' radio calls**, timed to the minute
- **radar cell readings** — echo top, liquid content, reflectivity

`eval/releases.mjs` downloads the PDFs and writes `eval/data/releases-2025.json`.
**34 flying days, 497 flares with a position, no parse failures.** Each report
states its flare count three times and the parser checks all three against each
other, so a dropped row cannot pass as a quiet day.

Two flares in the season have a time and a county but no coordinates. They stay
in the totals and out of the point results.

---

## Finding 1 — the seeding band is where the balloons put it, in every programme that flies one

The seeding band is the layer of cloud cold enough for silver iodide to work:
from the freezing level up to about −15 °C. Everything the product does depends
on drawing that layer in the right part of the sky.

The National Weather Service flies a balloon from Midland and from Del Rio twice
a day. It carries a thermometer through that exact layer, and the operators read
those ascents every morning and decide whether to fly on them. The 12Z ascent
lands on a model analysis hour, so both sides can be compared without rounding
either.

**Four of the five programmes brief on a balloon and all four are checked here.**
West Texas reads Midland and Del Rio, Trans-Pecos and the Rolling Plains read
Midland, South Texas reads Del Rio.

| Programme      | Ascents | Freezing level | −15 °C height | Band overlap | Cleared 90% |
| -------------- | ------: | -------------: | ------------: | -----------: | ----------: |
| West Texas     |      64 |   −31 m / 45 m |  −26 m / 57 m |    **95.7%** |    56 of 64 |
| Trans-Pecos    |      39 |   −25 m / 32 m |  −10 m / 48 m |    **96.9%** |    36 of 39 |
| South Texas    |      11 |   −20 m / 40 m |  −33 m / 26 m |    **95.3%** |    11 of 11 |
| Rolling Plains |       7 |   −23 m / 15 m |  −66 m / 55 m |    **97.7%** |      6 of 7 |

Each edge column is signed bias, then the typical miss. Bias is the height we
drew minus the balloon's, so −31 m means we put that edge 31 m lower. The
typical miss is the median of the absolute errors, and is always positive.
Band overlap is the median share of the measured layer our layer covers, taken
against the union of the two, so a band drawn far too deep is penalised rather
than rewarded for covering everything. The layer is about 2,400 m deep
throughout.

**Bias sits within 70 m of zero on every edge of every programme**, so the
misses are scatter rather than a standing offset. There is nothing to correct
for, and nothing that is a west Texas peculiarity.

**The Panhandle is the exception and is deliberately not here.** It briefs on a
NAM forecast column rather than an ascent. Checking HRRR against NAM compares
two models and would report their agreement as accuracy, so `balloons.mjs`
refuses that region rather than running it with a footnote.

**The four programmes are not four independent samples.** Midland serves West
Texas, Trans-Pecos and the Rolling Plains, so a morning all three flew is one
balloon counted three times: 121 scored ascents, 101 distinct. The per-programme
rows are still worth reading — they say the result is not an artefact of one
target area — but they may not be added together.

**One ascent is excluded on physical grounds.** South Texas prints a freezing
level of 4072 m and a −15 °C height of 4944 m on 31 March: 872 m apart, which is
17.2 °C/km. The dry adiabatic lapse rate is 9.8 °C/km and is the steepest a deep
layer sustains, so one of those two numbers is a typo. Our column agrees with
the freezing level to 47 m and disagrees with the −15 °C height by 1548 m, but
using that to decide which of their numbers to keep would be judging the ground
truth by the model and then reporting the agreement as accuracy. The whole
morning is dropped from both edges and named in the output instead.

### What this rules out for Finding 3

Finding 3 reports that agreement with supercooled liquid water is low in every
programme, and that radar — not the band — is the column that splits. **It is
not because the band is drawn in the wrong place.** West Texas and the Rolling
Plains have all but the same band accuracy — 95.7% and 97.7% median overlap,
edge biases within 10 m of each other — and their crews' releases fall inside
supercooled liquid water 6.4% and 11.3% of the time. The layer is in the same
right place in both. What differs is how much supercooled water the model puts
inside it, which is the one thing no sounding in the record can check.

---

## Finding 2 — they seed near our liquid, and inside the rain we rule out

The model publishes once an hour. Aircraft do not wait for it. A flare released
at 1843Z is 17 minutes from one reading and 43 from the other, and picking
either one reports a coin toss as though it were a measurement.

So we ask both. Draw the liquid at the hour below and the hour above. If a
place has liquid in both, it had liquid across the whole gap, and which hour you
pick stops mattering.

**All 497 releases of the season. 492 got an answer at both ends.**

| What we asked                          | Held in both | One only | Neither |
| -------------------------------------- | -----------: | -------: | ------: |
| Was there liquid in the seeding band?  |    17 (3.5%) |      120 |     355 |
| Was the cloud seedable, ignoring rain? |    17 (3.5%) |      115 |     360 |
| Was the cloud seedable, rain included? | **0 (0.0%)** |       16 |     476 |

Three things come out of that table.

**Not one flare in the season landed in a place we called seedable at both
hours.** Zero out of 492.

**The first two rows are the same number.** Every place that had liquid also
passed every other test — cloud base, band position, cloud seen, top temperature
— every time. Those four tests never rejected anything all season. In practice
the product is not six tests. It is liquid, and then rain.

**A quarter of flares flip.** 120 of 492 had liquid at one hour and none at the
other. For those, the hour you pick _is_ the answer. This is the timing problem
measured rather than argued about, and it is why single-hour numbers should not
be quoted.

The 17 that had liquid at both hours are not spread out. Five days carry all of them — 19 April
(7 of 13), 22 May (5 of 23), 29 August (3 of 25), 11 August (1 of 46), and
24 October (1 of 17). **The other 29 days contribute nothing.** Whatever the
disagreement is, it is not an even error rate, which means it can be diagnosed.

### Asking how near instead of whether inside

"Inside or outside" is one bit, and it cannot tell a map that is slightly wrong
from a map that is looking at the wrong weather. A release 3 km outside a
contour and one 80 km outside are the same answer above and completely
different results.

So the second pass asks distance instead, and asks it at the minute and place
each flare actually left the aircraft. Each release is compared against the
nearest analysis rather than both sides of a gap — 1843Z goes to 19Z, 17 minutes
away, not to 18Z at 43 — and the remaining minutes are closed with HRRR's own
0–6 km storm motion, which carries the release point to where that air is at the
moment of the frame. The median release is 15 minutes from its analysis and the
furthest is 30, which at 10–25 knots is 5 to 15 km. That is one to five HRRR
cells, so it is not a correction that can be skipped.

### How fine this comparison can be

Each layer is drawn at native sampling. The join lives on HRRR's 3 km cells.
A flare is compared to the snapshot that layer actually had at that minute:
GOES the 5-minute scan nearest the flare, MRMS the 2-minute mosaic nearest it,
HRRR the analysis hour nearest it. Storm motion closes only the leftover
minutes — usually a couple for GOES and radar, up to thirty for HRRR.

| Layer                    | What is read                         | Native sampling      | Drawn at |
| ------------------------ | ------------------------------------ | -------------------- | -------: |
| Cloud base               | Bottom of the lowest cloud, ft MSL   | HRRR, 3 km, hourly   |     3 km |
| Supercooled liquid water | Liquid in the seeding band, g/m²     | HRRR, 3 km, hourly   |     3 km |
| Cloud tops               | Temperature at cloud top, °C         | GOES-East, 2 km / 5 min |     2 km |
| Radar reflectivity       | How hard it is raining, dBZ          | MRMS, 1 km / 2 min   |     1 km |
| Seeding opportunity      | Supercooled liquid where every test passes | The four above, together |     3 km |

**A release is inside a layer when the storm-motion-corrected point sits in
the contour.** Distance is still written. Remaining uncertainty — bearing and
range about 4 km, residual drift if the storm turned — is named, not folded
into the count.

The flare is not the limit. Programmes that print a latitude and a longitude
are good to a couple of kilometres at worst — 94% and 96% of those rows land
in the county they name. The two that print a bearing and a range are coarser:
about 6° of eastward rotation, which is what a magnetic display would mean,
moves a release 4 km at 30 nm.

**The whole season is built this way: 34 flying days, all 497 releases with a
position.**

| Layer                    |      Inside |    Median |  Worst |
| ------------------------ | ----------: | --------: | -----: |
| Cloud base               | 345 (69.4%) |      0 km |  45 km |
| Cloud tops               |    7 (1.4%) |     23 km | 286 km |
| Radar reflectivity       | 302 (60.8%) |      0 km | 388 km |
| Supercooled liquid water |   32 (6.4%) | **46 km** | 447 km |
| Seeding opportunity      |   14 (2.8%) |     45 km | 438 km |

**Cloud base and radar still have the typical release inside.** Median distance
is zero on both: 345 of 497 sit in modelled cloud, 302 in measured echo. A run
that put the flares in the wrong county could not do that to two independent
fields at once. The geometry, the clock and the drift correction survive.

**Cloud tops do not.** GOES draws tops at −5 °C and colder, at 2 km. Seven
releases of 497 sit in that paint; the typical release is 23 km from the
nearest edge. At 12 km those same tops had been a blob the aircraft sat inside.
At native sampling they are anvils and cores, and the crews are not in them.

**The liquid is the disagreement the product runs on.** 32 of 497 releases
(6.4%) sit inside supercooled liquid water. The typical release is 46 km out —
fifteen HRRR cells, which is not an edge of slightly the wrong shape.

**It is a disagreement about days, not a rate.** On one of the 34 days — 4
August, 4 of 5 flares — the typical release is inside supercooled liquid
water. On the other 33 it is further, and those 33 carry 492 of the 497
flares. No day puts every release inside. Ten days put at least one there;
24 days put none there at all, and those 24 carry 288 flares. On eleven days
the median release is more than 100 km from any supercooled liquid we drew,
which is the model holding the liquid somewhere else entirely or holding none
in the target area.

**Almost nothing is inside a seeding opportunity**: 14 releases of 497
(2.8%). That layer rules out rain and they fly into rain, which the next
section is about.

**This does not say which side is wrong.** Either we draw no supercooled liquid
where the crew found some, or they work something a 3 km analysis has nothing
about. What the season establishes is the shape of the disagreement —
concentrated in whole days rather than spread evenly — and a run that fails by
the day is a run that can be diagnosed by asking what those days had in common.

**The drift correction is worth less than it looks on a slow day.** Where the
storm motion runs 4 to 10 knots, twenty minutes moves a release about 3 km —
one HRRR cell, and releases sitting exactly on a contour can cross it either
way. That is the correction operating at the noise floor. At 13 to 25 knots it
is 5 to 15 km and it decides the answer. Both distances are written for every
release, drifted and undrifted, so neither has to be taken on trust.

### Why: we rule out rain, and they seed rain on purpose

**All 17 flares that had liquid at both hours were rejected for rain**, at one
hour or both.
That single test is the entire distance between the second row of the table and
the third.

Across those readings the measured reflectivity runs 15 to 49 dBZ with a median
of 35. The product rules a cloud out at 20. These are not cells that crept over
a line — they are raining hard, and the product is right that they are.

The operators seed them anyway, deliberately. They work the growing turret on
the flank of a storm whose core is already dumping rain.

Native 1 km radar and a 3 km join can tell those two apart, and they still
do not land in a seeding opportunity: 14 of 497 (2.8%), against 32 inside
the liquid. Rain, or another test that rides with it, still takes most of
the liquid the crews are in. Moving the 20 dBZ threshold does not help when
the typical reading on the 17 that had liquid at both hours sits at 35 dBZ.

**This is a finding about the product, not about the operators.**

### What it argues for

Report rain instead of disqualifying on it. Two answers, not one: is this cloud
worth seeding, and has it already spent its liquid. The second is worth showing
and should not silently suppress the first. That is also what the operator does
— they see the echo and fly it anyway.

`eval/between.mjs` already computes this as its own test, so both numbers exist
today with no re-run.

---

## Finding 3 — liquid is rare under the aircraft everywhere, and radar is the column that splits

All five programmes Texas licenses now have a parsed flight record and every
flying day of every one is compared against the same five layers. **116 flying
days, 1,353 releases, five programmes, one question.** Inside means inside the
contour after storm-motion drift, at each layer's native sampling.

| Programme      | Cloud base | Cloud tops | Radar reflectivity | Supercooled liquid water | Seeding opportunity |
| -------------- | ---------: | ---------: | -----------------: | -----------------------: | ------------------: |
| West Texas     |      69.4% |       1.4% |              60.8% |                     6.4% |                2.8% |
| South Texas    |      75.9% |       4.2% |              28.9% |                     2.6% |                2.9% |
| Trans-Pecos    |      76.6% |       2.8% |              68.4% |                     5.5% |                1.3% |
| Rolling Plains |      77.4% |       5.9% |              40.4% |                    11.3% |                6.3% |
| Panhandle      |      73.3% |       1.2% |              53.7% |                    10.9% |                3.1% |

A layer that could not be built for an hour is dropped from that column only,
so the percentages are of the releases that layer could be compared against.
South Texas 26 and 31 March have no GOES-19 sweep at some hours, which is why
cloud tops and the join are short a handful of rows there.

**Cloud base is the column that holds.** 69–77% everywhere, median distance
zero in every programme. **Cloud tops are the column that does not:** 1–6%
inside, typical release 13–23 km from the −5 °C edge. That is the native
2 km GOES field, not a west Texas peculiarity.

**Liquid is low in every programme.** The table below asks it as a distance.

| Programme      | Days | Releases | Inside supercooled liquid water | Median |
| -------------- | ---: | -------: | ------------------------------: | -----: |
| West Texas     |   34 |      497 |                            6.4% |  46 km |
| South Texas    |   12 |       83 |                            2.6% |  25 km |
| Trans-Pecos    |   38 |      465 |                            5.5% |  32 km |
| Rolling Plains |    7 |       53 |                           11.3% |  15 km |
| Panhandle      |   25 |      255 |                           10.9% |  10 km |

The typical release is inside supercooled liquid water on one West Texas day
of 34, one Trans-Pecos day of 38, one Panhandle day of 24, one Rolling Plains
day of seven, and no South Texas day of 11. **Those are not rates that order
programmes.** They say the same thing in five places: a day that puts the
aircraft in our liquid is the exception.

**Radar is the column that actually splits.** Trans-Pecos 68.4%, West Texas
60.8%, the Panhandle 53.7%, the Rolling Plains 40.4%, South Texas 28.9%.
The Rolling Plains number is still two days of seven with nothing nearby —
25 May and 29 May, one of them a sortie whose analysis shows no echo in the
target area. South Texas is low on eleven scored days, not two, and its
typical release is 1.4 km outside the 20 dBZ contour rather than tens of
kilometres away. That is a different shape of miss: they fly the storm, and
the native 1 km echo is a tighter object than the aircraft's position.

**What this rules out is a fault that would be uniform across layers.** A
contouring bug, a units error or a clock set wrong would move cloud base with
liquid, and it does not.

**What it also rules out is reading liquid as a west-to-east airmass
gradient.** The Panhandle and the Rolling Plains sit near 11%; West Texas and
Trans-Pecos near 6%; South Texas at 2.6%. South Texas is the most humid target
area in the state, works maritime air off the Gulf, and it is the lowest, not
the highest. Its freezing level sits near 13,000 ft and the warm cloud below
it is two kilometres deep, so a South Texas cloud can be enormous and hold
very little water in the band we measure. That is a reason a dryness story is
too simple, not a replacement for it. **Where the disagreement is concentrated
is established; what causes it is not.**

**Ruling out rain behaves the same everywhere.** A handful of releases fall
inside a seeding opportunity — 2.8%, 2.9%, 1.3%, 6.3% and 3.1% across the
five. Every operator in Texas seeds the storm the product rules out.

**Two programmes' positions still have to be read as projections.** The
Panhandle and South Texas both print a bearing and a range from an origin
their reports never name, inferred by asking which candidate puts each row in
the county its own row names. Neither is an outlier that would come from
scattering off the wrong origin: the Panhandle's liquid median is the shortest
in the table (10 km), and South Texas cloud base is 76% inside. A projection
off the wrong point would not do that.

## What nothing can check

| Layer                          | What could check it         | Verdict          |
| ------------------------------ | --------------------------- | ---------------- |
| Seeding band geometry          | The balloons                | **Checked**      |
| Temperature profile            | The balloons                | **Checked**      |
| Reflectivity                   | Reported cell readings      | **Checked**      |
| Supercooled liquid in the band | Nothing measures it         | **Unverifiable** |
| Cloud-top phase                | Nothing measures it         | **Unverifiable** |
| Cloud base                     | Pilot calls, twice a season | Anecdote         |
| Warm cloud depth               | In their briefing, not ours | Not produced     |

**The band is right and the liquid inside it is unchecked.** Those two sentences
carry the whole evaluation. The band decides _where_ the liquid is measured; the
liquid itself is the gate — 465 of 497 West Texas releases sit outside it — and
nothing in the Texas record can confirm or deny it.

Salt-flare work is out of scope entirely. The product models the silver-iodide
process only, and warm cloud depth — the reading that decides a salt flare — is
in the operator's briefing and absent from ours.

---

## How to rerun any of it

Everything needs a running server and nothing else. No install, no key.

```bash
docker-compose up -d                   # all four services

# each of these is one run in the evaluation container
run() { docker-compose run --rm weatherman-eval-service node "$@"; }

run releases.mjs                       # the PDFs  → data/releases-2025.json
run balloons.mjs                       # finding 1 → out/balloons-2025.json
run balloons.mjs --score               # finding 1 again, instantly, no fetching
run between.mjs                        # finding 2 → out/between-2025.json
run paint.mjs 2025-04-19               # one day, every layer → out/painted-<date>.json
```

The whole season is built, one day at a time — `paint.mjs` refuses to be useful
any other way, because two runs at once evict each other's grids from the
server's cache. `eval/README.md` has the loop and what the log says.

To look at it rather than read it: the findings are on port 3100 and the maps on
port 5174, both up with the rest of the stack.

**Cost is downloads, not minutes.** Reading one hour out of the archive takes
30–60 seconds; every later question about that same hour is instant. `between.mjs`
asks 994 questions but downloads 125 hours, because flares cluster. The 116 days
of compared layers are 143 MB on disk.

`--resume` continues a run that was interrupted.

**Every figure in the distance table is one request.** `server.mjs` pools the
compared days at `/region/wtwma/near` and the per-day rows come back with it, so
nothing quoted here is arithmetic done twice:

```bash
curl localhost:3100/region/wtwma/near        # or /transpecos/, or /panhandle/
```

The other two programmes are built the same way — `releases.mjs
--region=transpecos` and `panhandle.mjs` read their reports, and `paint.mjs
<date> --region=<id>` builds a day. `eval/README.md` has what each programme's
reports do and do not carry.

---

## Limits to quote alongside the results

**The balloon is close in time, not simultaneous.** It is released about 45
minutes before its nominal hour and reaches the seeding band minutes into the
flight, so the gap is 20–30 minutes. That is survivable here and would not be for
a flare: a temperature profile at 4–7 km moves tens of metres in an hour, while a
growing storm swings 40 dBZ in the same span.

**The sounding numbers are the operator's reading**, lifted from their report
rather than from raw balloon data, so they carry that reading's mistakes. One Del
Rio row states a freezing level below sea level; impossible values are dropped
when scored.

**Two sites, one hour.** Midland and Del Rio bracket the target counties without
sitting inside most of them, and 12Z is morning while seeding flies in the
afternoon.

**Native sampling is the resolution limit of the whole test**: 3 km for the
HRRR fields and the join, 2 km for GOES cloud tops, 1 km for MRMS radar.
A 4 km bearing-and-range error and leftover drift if the storm turned sit
on top of that, and are named per release rather than folded into inside.

**This measures the atmosphere, not what a forecaster could have had.** Each
release is scored against the reading nearest it in time. The model publishes
about 50 minutes after the hour, so nobody actually held the 19Z reading at
1843Z. That is a limit on operating from this platform, not on measuring against
it, and the two must not be quoted as one number.

**Rainfall is not measured and no claim is made about it.** Attribution needs a
randomised or target/control design over seasons, not a season of flare
positions.

**How far back this can go at all:** the model reaches 2014-07-30, radar
2020-10-14, and satellite cloud top only 2023-03-23. The satellite binds.

---

## Sources

- [WTWMA 2025 operations, with the per-day reports](https://westtxwxmod.com/?page_id=23)
- [TDLR — rain enhancement operations in Texas](https://www.tdlr.texas.gov/weather/summary.htm)
- [Census TIGERweb State_County service](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer)
- Friedrich et al. (2020), _Quantifying snowfall from orographic cloud seeding_,
  PNAS 117(10) 5190–5195 — [PMC7071876](https://pmc.ncbi.nlm.nih.gov/articles/PMC7071876/)
- Buckets: `noaa-hrrr-bdp-pds`, `noaa-goes16`, `noaa-goes19`, `noaa-mrms-pds`
