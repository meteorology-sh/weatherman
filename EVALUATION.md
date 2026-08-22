# Evaluation — does the map agree with what Texas actually flies

Two questions, in order, asked of all five programmes Texas licenses.

1. **Is the seeding band in the right place?** Check it against the weather
   balloons the operator briefs on every morning.
2. **Do operators seed near what we paint?** Measure the distance from every
   release to the nearest edge of each layer, at the minute and place it left
   the aircraft.

The first is answered and the answer is yes, in all four programmes that fly a
balloon. The second splits three ways: they
fly inside the cloud and the echo we draw; on 10 of 34 days they fly in the
liquid we paint and on the other 24 they are cells away from it; and they are
almost never inside the finished join, because the join rules out rain and rain
is what they fly into.

A third finding falls out of asking the second question in five places at once:
the layer the product runs on agrees with the crews at one end of Texas and not
at the other, and the reason is not the one that fitted when only three
programmes had been read.

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

Each edge column is bias, then the typical miss. Band overlap is the median
share of the measured layer our layer covers, taken against the union of the
two, so a band drawn far too deep is penalised rather than rewarded for
covering everything. The layer is about 2,400 m deep throughout.

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

Finding 3 reports that agreement with painted liquid varies by a factor of two
across the state. **It is not because the band is drawn in the wrong place.**
West Texas and the Rolling Plains have all but the same band accuracy — 95.7%
and 97.7% median overlap, edge biases within 10 m of each other — and their
crews' releases fall within a cell of painted liquid 36.0% and 56.3% of the
time. The layer is in the same right place in both. What differs is how much
supercooled water the model puts inside it, which is the one thing no sounding
in the record can check.

---

## Finding 2 — they seed near our liquid, and inside the rain we rule out

The model publishes once an hour. Aircraft do not wait for it. A flare released
at 1843Z is 17 minutes from one reading and 43 from the other, and picking
either one reports a coin toss as though it were a measurement.

So we ask both. Paint the liquid at the hour below and the hour above. If a
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
each flare actually left the aircraft. Each release is charged to the nearest
analysis rather than to both sides of a gap — 1843Z goes to 19Z, 17 minutes
away, not to 18Z at 43 — and the remaining minutes are closed with HRRR's own
0–6 km storm motion, which carries the release point to where that air is at the
moment of the frame. The median release is 15 minutes from its analysis and the
furthest is 30, which at 10–25 knots is 5 to 15 km. That is most of a grid cell,
so it is not a correction that can be skipped.

**The whole season is built this way: 34 flying days, all 497 releases with a
position.** Being inside is a distance of zero, so the first column counts
releases the paint already covers and the second counts those within one 12 km
cell — which is as fine as anything drawn on this grid can resolve.

| Layer                    |      Inside | Within a cell |    Median |  Worst |
| ------------------------ | ----------: | ------------: | --------: | -----: |
| Cloud base               | 356 (71.6%) |   439 (88.3%) |      0 km |  48 km |
| Cloud tops               | 324 (65.2%) |   436 (87.7%) |      0 km | 220 km |
| Radar reflectivity       | 339 (68.2%) |   437 (87.9%) |      0 km | 383 km |
| Supercooled liquid water |  74 (14.9%) |   179 (36.0%) | **34 km** | 463 km |
| Seeding opportunity      |    3 (0.6%) |     46 (9.3%) |     75 km | 481 km |

**Three of the five layers agree with where Texas flies.** Nearly nine releases
in ten sit within a cell of modelled cloud base, of a satellite cloud top and of
measured echo. Whatever else is wrong, the geometry, the clock and the drift
correction are not: a run that put the flares in the wrong place could not land
them inside three independent fields at once.

**The liquid is the disagreement, and it is the layer the product runs on.** One
release in seven is inside painted liquid and about one in three is within a
cell of it. The typical release is 34 km out — three cells, which is not a
contour of slightly the wrong shape.

**It is a disagreement about days, not a rate.** On 10 of the 34 days the
typical release is within a cell of painted liquid; on the other 24 it is
further, and those 24 carry 399 of the 497 flares. Six days put _every_ release
within a cell — 29 April, 22 May, 10 June, 4 August, 18 August and 24 October —
and ten days put none there at all. On eleven days the median release is more
than 100 km from any liquid we painted, which is the model holding the liquid
somewhere else entirely or holding none in the target area.

**Almost nothing is inside the finished join**: 3 releases of 497, on 30 June
and 18 August. The join rules out rain and they fly into rain, which the next
section is about.

**This does not say which side is wrong.** Either we paint no liquid where the
crew found some, or they work something a 12 km analysis has nothing about. What
the season establishes is the shape of the disagreement — concentrated in whole
days rather than spread evenly — and a run that fails by the day is a run that
can be diagnosed by asking what those days had in common.

**The drift correction is worth less than it looks on a slow day.** Where the
storm motion runs 4 to 10 knots, twenty minutes moves a release about 3 km —
under a quarter of a cell, and releases sitting exactly on a contour can cross
it either way. That is the correction operating at the noise floor. At 13 to
25 knots it is 5 to 15 km and it decides the answer. Both distances are written
for every release, drifted and undrifted, so neither has to be taken on trust.

### Why: we rule out rain, and they seed rain on purpose

**All 17 flares that had liquid at both hours were rejected for rain**, at one
hour or both.
That single test is the entire distance between the second row of the table and
the third.

Across those readings the measured reflectivity runs 15 to 49 dBZ with a median
of 35. The product rules a cloud out at 20. These are not cells that crept over
a line — they are raining hard, and the product is right that they are.

The operators seed them anyway, deliberately. They work the growing turret on
the flank of a storm whose core is already dumping rain. **A 12 km cell cannot
tell those two apart.** The release point and the mature core 8 km away land in
the same cell, and the averaged reflectivity is dominated by the core — the part
of the storm the crew is deliberately avoiding.

So the test asks a fair question — has this cloud already spent its liquid — at
a resolution that cannot answer it. Moving the threshold does not help when the
typical cell sits at 35 dBZ.

**This is a finding about the product, not about the operators.**

### What it argues for

Report rain instead of disqualifying on it. Two answers, not one: is this cloud
worth seeding, and has it already spent its liquid. The second is worth showing
and should not silently suppress the first. That is also what the operator does
— they see the echo and fly it anyway.

`eval/between.mjs` already computes this as its own test, so both numbers exist
today with no re-run.

---

## Finding 3 — the liquid disagreement is concentrated, and not where dryness would put it

All five programmes Texas licenses now have a parsed flight record and every
flying day of every one is painted against the same five layers. **116 flying
days, 1,353 releases, five programmes, one question.**

| Programme      | Days | Releases | In painted liquid | Within a cell | Median |
| -------------- | ---: | -------: | ----------------: | ------------: | -----: |
| West Texas     |   34 |      497 |             14.9% |         36.0% |  34 km |
| South Texas    |   12 |       83 |             13.0% |         48.1% |  13 km |
| Trans-Pecos    |   38 |      465 |             19.6% |         49.2% |  13 km |
| Rolling Plains |    7 |       53 |             16.7% |         56.3% |  11 km |
| Panhandle      |   25 |      255 |             34.1% |         75.0% |   4 km |

**The other layers do not vary this way.** Cloud base lands within a cell of
88% to 98% of releases in all five, cloud tops 87% to 95%. The one exception is
Rolling Plains radar at 69.8%, and it is two days of seven — one of them a
sortie flown after midnight UTC that the analysis paints nothing anywhere near.
Only the liquid moves everywhere at once, and it moves by a factor of two from
one end of the state to the other.

**The spread is real at the ends and unresolved in the middle.** Counted by day
rather than by release — releases within a sortie are all near each other, so a
day succeeds or fails as one thing — the typical release is within a cell of
painted liquid on 10 of 34 West Texas days and 15 of 23 Panhandle days. Those
two are far enough apart, on enough days, to be a difference. The other three
sit between them on 11, 37 and 6 days: 4 of 11 in South Texas, 19 of 37 in
Trans-Pecos, 3 of 6 in the Rolling Plains. **Seven days cannot order anything**,
and the two small programmes are quoted here to say what they are, not to rank
them.

**What this rules out is a fault that would be uniform.** A contouring bug, a
units error or a threshold set wrong would hurt the Panhandle exactly as much as
West Texas, and it does not.

**What it also rules out is the explanation that fitted three programmes.** With
West Texas, Trans-Pecos and the Panhandle alone the ordering ran with the
airmass — driest worst, coldest and highest best — and dry air carrying less
supercooled liquid than the model thinks was the obvious reading. South Texas
breaks it. It is the most humid target area in the state, works maritime air off
the Gulf, and it lands beside West Texas rather than beside the Panhandle. Its
freezing level sits near 13,000 ft against the Panhandle's, and the warm cloud
below it is two kilometres deep, so a South Texas cloud can be enormous and hold
very little water in the band the layer paints. That is a reason the airmass
story is too simple, not a replacement for it. **Where the disagreement is
concentrated is established; what causes it is not.**

**Ruling out rain behaves the same everywhere.** Twenty releases of 1,353 fall
inside the finished join — 3, 5, 9, 0 and 3 across the five. Every operator in
Texas seeds the storm the product rules out, and the one programme with none
inside is the one with 83 releases.

**Two programmes' positions corroborate their own projection.** The Panhandle
and South Texas both print a bearing and a range from an origin their reports
never name, inferred by asking which candidate puts each row in the county its
own row names. The Panhandle agrees with painted liquid better than any
programme that prints coordinates. A projection off the wrong origin scatters;
neither of these does.

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
liquid itself decides 78.5% of all answers, and nothing in the Texas record can
confirm or deny it.

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
asks 994 questions but downloads 125 hours, because flares cluster. The 34 days
of painted layers are 20 MB on disk and about an hour and a half of downloading.

`--resume` continues a run that was interrupted.

**Every figure in the distance table is one request.** `server.mjs` pools the
painted days at `/region/wtwma/near` and the per-day rows come back with it, so
nothing quoted here is arithmetic done twice:

```bash
curl localhost:3100/region/wtwma/near        # or /transpecos/, or /panhandle/
```

The other two programmes are built the same way — `releases.mjs
--region=transpecos` and `panhandle.mjs` read their reports, and `paint.mjs
<date> --region=<id>` paints a day. `eval/README.md` has what each programme's
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

**A 12 km cell is the resolution limit of the whole test**, and it is what
defeats the rain question above.

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
