# Proxy — do the Texas selection features describe where crews fly

The four columns under "Flare overlap with each Texas selection feature" in
`EVALUATION.md` are a proxy for the decision Texas rain-enhancement
programs already make: upwind of the heaviest rain, inside 20 dBZ,
nearer the edge than the core, and an 18 dBZ echo top at or above
freezing. The candidate map's seeding-opportunity join is a different
mask and is not this proxy.

This file asks how many 2025 releases held **all four** at the drifted
point, and whether that conjunction is a fair stand-in for how a
meteorologist actually picks a cell. The counts are from the same painted
files `EVALUATION.md` reprints, using the same yes/no rules
`eval/lib/storm-score.mjs` already applies. How Texas selects, in their
words, is `INVESTIGATION.md` §2.

---

## How many flares held all four

A flare holds all four when each column is a yes, not a blank. A blank is
a test that had nothing to read — no heading, no echo top, no 20 dBZ
object within about 40 km — and is dropped from that column's
denominator in `EVALUATION.md`. Here a blank is not a yes, so a flare
that cannot answer a column does not hold all four.

| Program      | Releases | All four | Of those that could answer all four |
| -------------- | -------: | -------: | ----------------------------------: |
| West Texas     |      497 | 138/497 (27.8%) |                   138/429 (32.2%) |
| Trans Pecos    |      465 | 100/465 (21.5%) |                   100/399 (25.1%) |
| Panhandle      |      255 |  63/255 (24.7%) |                    63/208 (30.3%) |
| South Texas    |       83 |   14/83 (16.9%) |                     14/63 (22.2%) |
| Rolling Plains |       53 |   10/53 (18.9%) |                     10/36 (27.8%) |
| Season         |    1,353 | 325/1,353 (24.0%) |                 325/1,135 (28.6%) |

**325 of 1,353 located flares sat upwind, inside 20 dBZ, nearer the
edge, with the echo top past freezing.** 1,135 of 1,353 could answer
every column. The 218 that could not are mostly a missing storm heading
or a missing echo top, not a no.

The product already flags a related geometry on the storm click:
inside the rain, on the upwind side, nearer the edge than the heaviest
rain. That flag is true on 327 of 1,353 releases. 311 of those 327 also
hold all four; the 16 that do not fail the heading half-plane while
still sitting on the upwind edge. The two tests are almost the same
flank.

---

## The marginals are not the conjunction

`EVALUATION.md` reports each column on its own. Those rates are high on
two columns and about half on the other two:

| Column                   | Season |
| ------------------------ | -----: |
| Echo top past freezing   | 1,195/1,250 (95.6%) |
| Nearer the edge          | 1,082/1,317 (82.2%) |
| Inside 20 dBZ            | 784/1,353 (57.9%) |
| Upwind of the heaviest rain | 564/1,181 (47.8%) |

If the four were independent on the 1,135 complete answers, about 301
flares would hold all four. 325 did. The conjunction sits next to
independence, not next to the rarest column. Requiring all four at the
release point is a different claim from "they usually do each of these."

The column that binds the conjunction is upwind. 379 flares sat inside
20 dBZ, nearer the edge, with echo top past freezing, and were **not**
on the upwind half of the storm. Drop upwind and 728 of 1,353 (53.8%)
hold the other three.

The next largest group is the opposite geometry: 138 flares sat
**outside** 20 dBZ, still upwind, nearer the edge, with echo top past
freezing. They have a storm. They are on the quiet side of it.

36 of 1,353 had no 20 dBZ object within about 40 km at all.

---

## How Texas actually selects

Texas programs do not score a drifted lat/lon against four flags.
`INVESTIGATION.md` §2 is the loop, taken from the Comptroller's
description, TWMA operations papers, and the 2025 daily reports:

1. A morning briefing on the 12Z sounding (or a NAM column in the
   Panhandle): freezing level, −15 °C, cloud base, warm-cloud depth,
   coalescence index.
2. Watch on TITAN. Cells get numeric IDs. The log is written in those
   IDs.
3. Select a **cell**: convective, still growing, first half of its
   lifetime, cloud base 4,000–12,000 ft, depth past the freezing level,
   enough cloud-base inflow, not severe under the TDLR permit.
   Glaciogenic targeting looks for a reflectivity core at or above
   freezing.
4. Direct the aircraft onto the inflow. The pilot reports climb rate in
   ft/min, timed to the minute, next to the TITAN ID.
5. Seed at cloud base into that updraft, almost always silver iodide.

The unit of the decision is the cell. The unit of `EVALUATION.md` is the
flare: one minute on a pass, drifted to the nearest analysis. A pass
across a turret can sit just outside 20 dBZ, or on the downwind half of
the heading, and still be the inflow the meteorologist sent the plane
to.

They are not flying on vibes. TITAN has been mandatory on Texas Weather
Modification Association projects since 1999. The 2025 reports still
reboot it when the feed drops. The morning sounding is the same table
the band comparison already trusts. The published base window is a
permit fact, not a house style.

---

## What the four columns can certify, and what they cannot

**Echo top past freezing certifies the storm.** 1,195 of 1,250 releases
that had both heights sat in a storm whose 18 dBZ top was at or above
the modeled freezing level. South Texas is the softest at 62 of 74
(83.8%); everyone else is above 95%. That is the glaciogenic cue in
their own words, scored on the object they flew, and it holds.

**Nearer the edge certifies the pass is not the core.** When a release
sat inside 20 dBZ, the median distance to the edge was 1.2 km and to the
heaviest rain 8.1 km. 1,082 of 1,317 (82.2%) were nearer the edge.
Crews work the flank.

**Inside 20 dBZ does not certify the pass.** 784 of 1,353 sat in the
rain. 533 sat outside it with a storm still in range; the median
distance to that edge was 5.3 km, and 187 of those 533 were within 3 km
— one HRRR cell. South Texas is 24 of 83 inside, with a median 4.8 km
to the edge. Two things sit on top of each other there: a real inflow
pass on the quiet side, and a bearing-and-range position whose origin
the reports never name. Treating 20 dBZ as a gate at the release point
would call those a miss. The Comptroller description never said to seed
*in* the rain. It said to find a raining cell and work the flank.

**Upwind of the heaviest rain does not certify inflow.** 564 of 1,181
(47.8%) sat in the 90° half-plane opposite the storm's heading from the
previous mosaic. That heading is not the updraft. Pilots measure climb
rate with the aircraft. A cell can move east while the inflow is on the
south side. 564 of 1,181 is the rate that heading test produces at
the release point. It is also the column that turns 728 three-feature
flares into 325 four-feature flares.

**Growth and first half-lifetime are not in the table, and the mosaic
cannot score them yet.** Of the 325 that held all four, 228 sat in a
storm whose raining area had grown since the previous scan, 93 in one
that had shrunk, and 220 were already raining at the start of the
look-back (about 18 minutes). A median age of four minutes on that
sample is the floor of the look-back, not a lifetime percentile. TITAN
has the lifetime. The national mosaic, as ingested, does not.

**The seeding-opportunity join is not this proxy.** 30 of 1,311
releases sat in that contour all season. Four of the 325 that held all
four Texas columns sat in it. The join asks for modeled supercooled
liquid at or above 10 g/m², a GOES top at or colder than −5 °C, and no
rain at 20 dBZ. Texas selects the opposite rain test, does not gate on
modeled liquid, and seeds at cloud base under tops that are not −5 °C
at the cell — 6 of those 325 sat in the GOES −5 °C tops. 28 of 325 had
modeled liquid over the storm at 10 g/m².

---

## Verdict

The four columns are a fair **description of the storms they pick** and
a weak **gate at the release point**.

Echo top past freezing and nearer-the-edge are the parts that match how
operators talk and how the 2025 log looks. Inside 20 dBZ is the object,
not the pass. Storm-motion upwind is a stand-in for inflow that the
aircraft does not use.

A map that drew "a raining cell whose echo top is past freezing, and
the quiet side of that cell" would be describing 728 of 1,353 releases
on the three columns that survive without upwind, and 325 if it also
demanded the heading half-plane. Neither number is a reason to call
the crews unsystematic. Both numbers are what you get when you score a
cell-level decision at a flare.

What would make the proxy tighter is not a looser 20 dBZ, and not more
weight on modeled liquid:

1. **Lifetime of the object**, from a tracker or a longer radar
   history, so first-half-lifetime is a percentile rather than an
   18-minute floor.
2. **Inflow**, which the free feeds do not have. Climb rate is a
   pilot call. Storm-motion upwind is the wrong substitute to keep
   tightening.
3. **Cloud base in the 4,000–12,000 ft window, in AGL**, as a test on
   the cell. 987 of 1,353 releases sat in modeled cloud base; that is
   "a base exists," not the Comptroller window.
4. **A neighborhood on rain**, one HRRR cell, so a pass 1–3 km
   outside 20 dBZ is the flank rather than a no. South Texas's typical
   release already sits in that gap.

Until those are scored, the honest statement is the one `EVALUATION.md`
already makes column by column: they fly the flank of a storm whose
echo top is past freezing, about half the time inside the 20 dBZ
contour and about half the time on the upwind half of a heading that
is not inflow. They do not fly the four-way intersection. 325 of 1,353
is how often a minute on a pass landed in all four at once, not how
often the meteorologist picked a bad cell.
