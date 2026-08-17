# Evaluation — do we paint the ground the aircraft actually seeded

**The findings are directly below.** Everything after them is how they were
produced: the question in §1, the ground truth in §2, the worked cases and the
season sweeps in §3–§5, the harness and how to rerun it in §7, and the limits in
§8.

`WEATHERMAN.md` says what the app claims and `MEASUREMENTS.md` says what the
free feeds can answer. This document is allowed to argue, like `PLAN.md` and
`INVESTIGATION.md`.

---

## Results

### One layer is verified against an instrument; the layer that decides the answer is not

| Layer                                        | Independent check                   |   n | Offset    | Standing              |
| -------------------------------------------- | ----------------------------------- | --: | --------- | --------------------- |
| Seeding band — freezing level, −15 °C height | KMAF / KDRT radiosonde              |  64 | 20–30 min | **Verified**          |
| Profile temperature at 700 mb                | KMAF / KDRT radiosonde              |  63 | 20–30 min | **Verified**          |
| Reflectivity                                 | Reported cell dBZ                   | 289 | 1–2 min   | **Verified**          |
| Supercooled liquid in the band               | Nothing in the record measures it   |   0 | —         | **No counterpart**    |
| Cloud-top phase                              | Nothing in the record measures it   |   0 | —         | **No counterpart**    |
| Cloud base                                   | Pilot radio calls, twice all season |   2 | —         | Anecdote, not a check |
| Warm cloud depth                             | In their briefing, absent from ours |   — | —         | Not produced          |

**The band is right and the liquid inside it is unchecked.** Those two sentences
carry the whole evaluation. Band geometry decides _where_ the liquid integral is
taken; the integral itself rejects 78.5% of all cells and no radiosonde, radar or
satellite in the Texas record can confirm or refute it.

### The seeding band is where the radiosonde puts it

68 ascents attempted over the 2025 season, 64 scored. 12Z lands on an HRRR
analysis hour, so neither side is rounded to meet the other.

| Reading            |   n |    Bias | Median \|err\| |     Worst |
| ------------------ | --: | ------: | -------------: | --------: |
| Freezing level     |  64 |   −31 m |           45 m |     286 m |
| −15 °C height      |  64 |   −26 m |           57 m |     324 m |
| 700 mb temperature |  63 | −0.3 °C |         0.4 °C |    2.8 °C |
| Surface CAPE       |  64 |    +238 |            240 | 2953 J/kg |

Taken as a layer rather than as two edges, **the band we draw overlaps the band
the sonde measured by a median 95.7%** of their union, over a layer whose median
depth is 2,537 m. All 64 clear 80% and 56 clear 90%. Bias near zero on both
edges means the misses are scatter, not a standing offset, so there is nothing
to correct for.

This is agreement with the instrument the crews are briefed on. Every daily
report opens with that sounding table, and the rows the operator prints are the
seeding decision itself.

### The season, scored at its analysis hours

33 days, 497 releases. 20 September carries no answer — 11 timeouts.

| Verdict     |   n | Share |
| ----------- | --: | ----: |
| `noLiquid`  | 390 | 78.5% |
| `raining`   |  89 | 17.9% |
| `candidate` |   7 |  1.4% |
| error       |  11 |  2.2% |

In four fifths of all releases the model holds no supercooled liquid in the
seeding band over the cell at all, and the radar takes most of the rest.

### The rain veto excludes the geometry the operators actually seed

Where the model does hold liquid over a release, **the reflectivity is never
near the cutoff — it is well past it.** Across the releases carrying liquid at
both analyses a flare sits between, the measured reflectivity runs 20 to 47 dBZ
with a median of 32. `RAIN_DBZ` is 20. Not one of these cells is a marginal
call.

So the disqualifier is not catching cells that crept over a line. It is
describing, correctly, that these clouds are raining hard — and the operators
seed them anyway, deliberately, because they are working the growing turret on
the flank of a complex whose core is already precipitating. A 12 km cell cannot
separate the two: the block-averaged reflectivity is dominated by the core, 8 km
from the turret the aircraft is actually in.

**`RAIN_DBZ` therefore encodes a real question at a resolution that cannot
answer it.** The question — has this cloud already spent its liquid — is sound.
The reading it is asked of covers both the spent core and the unspent turret, so
a cell that is half of each answers as though it were all core. Nothing about
raising or lowering the threshold fixes that; the cells are at 32 dBZ, not 21.

This is a finding about the product, not about the operators.
Re-asking the observed half at each flare's true minute moves individual answers
freely — 7 candidates become `raining` and 5 go the other way, with no overlap
between the old and new candidate sets — while leaving the pooled shares roughly
where they were. **Every individual answer was wrong and the totals hid it.**

---

## 1. The question

> **At the minute a pilot released a flare, at the point they released it, was
> that 12 km cell painted as a candidate — and if not, which test rejected it?**

That is the whole test. It is a targeting question, and the app answers it
directly: `GET /candidate/point?lat&lon&at=` reads the join over the cell whose
footprint covers a point and returns the verdict, the modelled liquid, the
cloud base, the observed cloud top, the observed top phase and the measured
reflectivity.

**Outcomes are out of scope.** Nothing free and national measures supercooled
liquid water (`MEASUREMENTS.md` §2), and rainfall cannot be attributed to
seeding from a handful of cases — attribution needs a randomised or
target/control design over seasons. There is no rainfall claim anywhere in this
plan. §7 says what it would take to add one later.

### The primary hypothesis

**Most seeded points will come back rejected, charged to `raining`, and that
will be the finding.** §5 says how this landed — half right, and the half that
was wrong is the more interesting one.

The join crosses a cell off at 20 dBZ, because radar echo means the cloud has
already converted its liquid and seeding has no headroom. Texas does not work
that way. Operators seed the **growing turret on the flank of a complex that is
already raining hard** — on 19 April 2025 the seeded cells carried 63–72 dBZ
and echo tops of 16.5–17.5 km at the moment they were being seeded. A 12 km
cell cannot separate a new turret from the mature core 8 km away, and MRMS
averaged in Z over that block will be dominated by the core.

If that is what comes back, the conclusion is not that the operators are wrong.
It is that `RAIN_DBZ` encodes the question "has this cloud already spent its
liquid" and answers it at a resolution that cannot see the part of the storm
being worked. That is a real finding about the product and it is worth all four
cases on its own.

---

## 2. The ground truth is far better than a county and a day

WTWMA publishes a per-day report for every operational day of the 2025 season.
It is a minute-by-minute narrative, and it ends with a table that gives
**every flare release with a UTC minute and a position to four decimal places**:

```
Flight Information:  Time (Z) Plane Flare Location Type/Number County
1843 49P 31.0982 / -100.8598 2G Irion
1845 49P 31.1313 / -100.8382 2G Irion
1919 49P 31.1272 / -101.7577 3G + 1H Reagan
1941 49P 30.9884 / -102.0185 2G Crockett
```

That is a point, a time and a payload — exactly the three things
`/candidate/point` needs. One glaciogenic flare is 5.5 g AgI; one hygroscopic
flare is 500 g NaCl.

The narrative carries more that is directly comparable to fields the app
already reads:

- **Pilot-reported cloud base**, in flight: on 19 April, "bases 4000 ft
  (1225 m), temp 75 °F/24 °C" at 1838Z, then "bases are 6000 ft (1830 m) and
  temp is 59 °F/15 °C" at 1919Z. A measured cloud base against our modelled
  one, over a known point at a known minute.
- **The 12Z KMAF and KDRT soundings**, tabulated — freezing level, **−15 °C
  height**, LCL, CCL, cloud base, warm cloud depth, 700 mb temperature. The
  −15 °C height sits inside our seeding band, so this is a radiosonde check on
  the band's altitude. On 19 April: KMAF 5,986 m, KDRT 6,370 m. On 22 April:
  5,950 m and 6,300 m.
- **TITAN cell attributes** at intervals through the day, as
  `echo top (km), VIL (kg/m²), max dBZ` — the three quantities the app reads as
  `RETOP`, `VIL` and MRMS reflectivity.
- **Watches and warnings**, timed and by county.

So the test resolves to the individual flare, not to the county-day. That is a
different quality of evaluation from what the summary page alone would support.

**The reports are text PDFs**, so a small script can lift the release tables
without anyone transcribing them by hand.

---

## 3. The four cases

**These are worked examples, not the score.** They were picked to find out
whether the harness could answer the question at all, and they did that. The
numbers to quote are the season-wide ones in the results block at the top: four
days cannot separate a structural disagreement from an unlucky airmass, and
`MEASUREMENTS.md` §6 says to score this product over a Texas year. Read this
section for how a single day is examined, not for how the platform performs.

| #   | Date              | Releases | What it is                                  |
| --- | ----------------- | -------- | ------------------------------------------- |
| T1  | 19 Apr 2025       | 13       | Season opener. Severe, tornadic, and seeded |
| T2  | 11 Aug 2025       | 46       | The widest day — 7 counties, 1831Z to 0005Z |
| T3  | 22 Apr 2025       | **0**    | Flew, looked, declined — and said why       |
| L1  | 19/20/31 Jan 2017 | n/a      | SNOWIE. Measured supercooled liquid         |

### T1 — 19 April 2025, Irion / Reagan / Crockett

Thirteen releases between 1843Z and 1949Z, 27 glaciogenic and 2 hygroscopic
flares into 3 clouds, from N8549P.

This is the case that tests the primary hypothesis head-on. At 2020Z the report
records the seeded cells as **16.5–17.5 km tops, 93–287 kg/m² VIL, 63–72 dBZ**,
and notes the other echoes in Sterling County are "underneath the large anvil
from the Reagan Co storm." Severe thunderstorm warnings were out for
north-central Crockett from 1851Z; a tornado warning covered SE Sterling / NW
Tom Green / N-central Irion from 2100Z; a flash flood warning followed.

Two things to read from it. First, the verdict at each of the thirteen points.
Second, the anvil note — the report is describing, from the ground, exactly the
viewing-geometry failure `MEASUREMENTS.md` §4 attributes to the cloud-top phase
product. Our confirmation outline should be drawing ice over Sterling County
while turrets grow underneath it.

### T2 — 11 August 2025, seven counties

Forty-six releases across two sorties from N....41P, 1831Z through 0005Z the
next day, over Sterling, Glasscock, Irion, Tom Green, Schleicher, Crockett and
Terrell. 84 glaciogenic and 7 hygroscopic flares into 23 clouds.

The widest day of the season, and the one with enough releases to say something
about the shape of the answer rather than about three clouds. It also spans
seven hours, so it tests the join across a whole diurnal cycle of HRRR analyses
rather than at one instant.

### T3 — 22 April 2025, the null

**They launched, flew 1 h 27 m, investigated, and seeded nothing.** The report
gives the reason in the operator's own words:

> "At 2311Z, decided to send plane back to SJT, anything developing is embedded
> within and underneath the large anvil, plus lots of lightning."

This is a far stronger null than a day nobody flew. A no-fly day confounds
opportunity with aircraft availability and crew duty; this one records a trained
observer looking at the target area and declining it, with the reason attached.

**The test is asymmetric and that is fine.** If the map is empty over the target
through that window, it agrees. If the map is full, the rejection accounting has
to explain what the operator was looking at and turning down — and "embedded
under an anvil with lightning" is not one of our five tests, so a candidate
field that lights up on 22 April is not necessarily wrong. It is measuring
something the operator's decision does not.

Note the contrast the two April days set up: on the 19th they seeded cells at
63–72 dBZ; on the 22nd they declined cells at 66–70 dBZ. Reflectivity is not
what separated those two days, and our join has nothing else to separate them
with.

**Alternates**, if more Texas ground is wanted: 26 May 2025 (37 releases, Tom
Green / Irion / Glasscock) and 11 June 2025 (32 releases, five counties).

### L1 — SNOWIE, January 2017

Glaciogenic seeding of orographic cloud over the Payette basin, Idaho, with AgI
released from aircraft flying ~50 km tracks perpendicular to the mean wind.
Friedrich et al. (2020) isolated the seeding signal in radar and gauge data:

| Date        | Seeding | Passes | Water generated            | Natural precip   |
| ----------- | ------- | ------ | -------------------------- | ---------------- |
| 19 Jan 2017 | 20 min  | 6      | 123,220 m³ (100 acre-feet) | light, ~1.3 mm/h |
| 20 Jan 2017 | 86 min  | 8      | 241,260 m³ (196 acre-feet) | almost none      |
| 31 Jan 2017 | 24 min  | 2      | 339,540 m³ (275 acre-feet) | light, <1 mm/h   |

**Lead with 20 January**: almost no natural precipitation, and the longest
seeding period of the three.

This is included for one reason. SNOWIE is the only campaign that **measured**
supercooled liquid water in cloud that was then seeded, and supercooled liquid
in the band is the app's central variable and the one thing it can never check
against an observation anywhere else. A candidate-finder that goes blank over
the one basin where the liquid was measured has a problem worth knowing about,
even though the regime is winter orographic rather than summer convective.

**Only the HRRR half runs** (§6). The seeding windows are 1619–1812Z on
19 January, **0000–0200Z on 20 January** and 2117–2151Z on 31 January — note
that the 20 January case is seeded in the first two hours of that UTC day, not
in its afternoon, which is the trap the first sweep fell into. The basin sits
at roughly 44.0–44.8 °N, 116.4–115.4 °W and should be pinned against the
paper's Figure 1 before any area is computed.

---

## 4. What each case measures

### Per release (T1, T2)

For every row of the flight table, call `/candidate/point?lat&lon&at=` and
record:

- **`verdict`** — `candidate`, `noLiquid`, or which of the five tests rejected
  it. This is the headline, and the distribution across releases is the result.
- **`slwGM2`** — how much in-band liquid the model put there. A rejected cell
  that still carries liquid is a different story from one that carries none.
- **`cloudBaseFt`** against the pilot's reported base, where the narrative gives
  one at a matching time and place.
- **`cloudTopC`** and **`topPhase`** — and on T1, whether the phase over
  Sterling County reads ice while turrets are growing under the anvil.
- **`dbz` and `radarCovered`** against the TITAN max dBZ in the narrative at the
  nearest quoted time.

**Round the release time to the nearest hour and use that cycle.** `at` names
the HRRR cycle, and the join runs at the analysis hour only; the satellite and
radar resolve to the nearest scan and refuse anything more than 30 minutes away.
A release at 1843Z is 17 minutes from the 19z analysis and 43 from the 18z, so
it belongs to 19z. Record the gap on every row — it is the largest source of
slop in the whole test.

### Per case, over the target area

Run the join at each hour of the window, clip the field to the county polygons,
and report:

- **`candidateKm2` inside the counties worked that day**, hour by hour.
- **Candidate coverage % inside those counties against coverage % over the rest
  of the target area.** A ratio near 1 means the field is not discriminating —
  it covers the target because it covers everything.
- **The rejection partition, clipped to the same ground.** These partition by
  construction, so an empty map is always explainable. On T3 this is the entire
  result.
- **`medianBaseFt` and `windowPct`** against the state's published
  4,000–12,000 ft operational window.
- **`medianBandBaseFt`** against the 12Z **−15 °C height** from the KMAF and
  KDRT soundings printed in that day's own report. This is the one figure in
  the whole evaluation checked against a radiosonde.
- **`phase.confirmedKm2` against `phase.glaciatedKm2`.** The only observation of
  phase in the system. It cannot rule anything out and must not be scored as if
  it could.

### For L1

The join cannot run, so the metrics are the HRRR half only:

- **In-band liquid water path over the basin at each seeding hour**, from
  `/forecast/liquid` clipped to the basin box, against the paper's seeding
  times. Binary first — is there any — then quantitative.
- **The band's altitude** over the basin from `/forecast/sounding`, against the
  flight altitudes in the paper. If HRRR puts −5…−18 °C where the aircraft were
  not, the field is right about the liquid and wrong about where to fly.
- **Cloud base** from `/forecast/cloudbase`, which in orographic cloud should
  sit near or below ridge height.
- Report the absent inputs as absent. A SNOWIE row with three blank columns is
  the honest output.

---

## 5. What came back

Run on 16 August 2026 against the archive. Reproduce with `eval/points.mjs`,
`eval/field.mjs` and `eval/snowie.mjs`; raw output is in `eval/out/`.

### Not one seeded point was painted a candidate

Fifty-nine releases across the two Texas days, and the map called none of them.
**That is the result, and the two days fail it in opposite ways.**

| Case      | Releases | candidate | `raining` | `noLiquid` |
| --------- | -------- | --------- | --------- | ---------- |
| T1 19 Apr | 13       | **0**     | 7 (54%)   | 6 (46%)    |
| T2 11 Aug | 46       | **0**     | 9 (20%)   | 37 (80%)   |

**The `raining` rejections are the strong finding, and the rejection order is
what makes them precise.** Tests run in a fixed order and a cell is charged to
the first one it fails, so a verdict of `raining` means the cell passed every
other test. Those sixteen cells had in-band liquid, a cloud base below the
band's cold edge, and an observed cloud top cold enough to reach the band.
The radar crossed them off and nothing else did:

- **T1:** 206–693 g/m² of in-band liquid, at 45–49 dBZ, under tops of −18 to
  −27 °C.
- **T2:** 14–406 g/m², at 30–44 dBZ, under tops of −55 to −61 °C.

Sixteen of fifty-nine releases — 27% — were a single threshold away from being
called candidates. `RAIN_DBZ` is 20.

**The `noLiquid` rejections are two different stories.** On T1 all six carried
an observed cloud top of **+4 to +9 °C** — warmer than the band's warm edge, so
the band was above the cloud entirely, and the satellite classified those tops
`liquid`. Those are the four Irion releases at 1843–1850Z and two in Reagan:
young turrets seeded before they had grown into the band at all. On T2 not one
release had a warm top — they ran −5 to −61 °C — and the satellite classified
**every one of the 46 as `ice`**. Sixteen of the 46 had no modelled cloud base
at all.

So T1 is half "already raining" and half "not yet a cloud", and T2 is one
enormous glaciated anvil.

### The map found the counties while missing the cells

Sampled over all 13 counties in the release list, deduplicated to the 12 km
cells the join answers from — 413 cells per hour. `worked` is the candidate
share over the counties that day's aircraft flew in; `elsewhere` is the rest of
the target area the same hour.

| T1 19 Apr | candidate | worked    | elsewhere | peak liquid |
| --------- | --------- | --------- | --------- | ----------- |
| 18Z       | 0.24%     | 0%        | 0.31%     | 23 g/m²     |
| **19Z**   | 0.97%     | **2.13%** | 0.63%     | 1,239 g/m²  |
| **20Z**   | 1.94%     | **2.13%** | 1.88%     | 1,041 g/m²  |
| 21Z       | 1.94%     | 3.19%     | 1.57%     | 1,595 g/m²  |

Seeding ran 1843–1949Z, so 19Z and 20Z are the hours that matter. At 19Z the
counties they worked carried **3.4× the candidate coverage of the rest of the
target area**; by 20Z that had flattened to 1.1×.

**On T1 the map was pointing at the right part of west Texas during the right
hour while getting every individual release cell wrong.** Those are different
claims and only the coarser one survives.

**T2 does not repeat it.** Seeding ran 1831Z–0005Z across two sorties:

| T2 11 Aug | candidate | worked | elsewhere | peak liquid |
| --------- | --------- | ------ | --------- | ----------- |
| 18Z       | 0.48%     | **0%** | 0.97%     | 748 g/m²    |
| 19Z       | 1.69%     | **0%** | 3.4%      | 122 g/m²    |
| 20Z       | 0.73%     | 0.97%  | 0.49%     | 508 g/m²    |
| 21Z       | 0.24%     | 0.48%  | 0%        | 156 g/m²    |
| 22Z       | 0.24%     | 0.48%  | 0%        | 1,633 g/m²  |
| 23Z       | 0.97%     | 1.93%  | 0%        | 489 g/m²    |

For the first two hours of the first sortie the discrimination is **inverted**:
the counties the aircraft was working had no candidate ground at all while the
rest of the target area had 0.97% and 3.4%. The map was pointing away from the
operation. From 20Z on it flips and every candidate cell in the target area is
inside a worked county — but by then the coverage is under 1%, so it is
agreement over a handful of cells.

**So the county-scale result is one good day and one bad one.** It is worth
having and it is not a finding yet.

### The null does not separate

T3 flew for 1 h 27 m and seeded nothing, and the map was not empty over the
ground it declined:

| T3 22 Apr | candidate | peak liquid |
| --------- | --------- | ----------- |
| 21Z       | 0.73%     | 922 g/m²    |
| 22Z       | 2.91%     | 1,667 g/m²  |
| 23Z       | 2.18%     | 1,392 g/m²  |
| 00Z       | 4.36%     | 1,269 g/m²  |

Compare hour for hour against T1 and the discrimination is weak in both
directions. At 21Z the seeded day shows more (1.94% against 0.73%), but T3
climbs to 4.36% by 00Z — **more candidate coverage than any hour of the day
they actually seeded** — and its peak modelled liquid, 1,667 g/m², is the
highest figure anywhere in these cases.

The operator's reason is not one of our five tests: _"anything developing is
embedded within and underneath the large anvil, plus lots of lightning."_ The
map has nothing that says "under an anvil" and nothing that says "lightning".
It cannot reach that decision, and on this evidence it does not approximate it
either.

### SNOWIE: not yet answered — the first sweep missed the seeding window

L1 runs on HRRR alone — no cloud top, no phase, no radar in January 2017 — and
the routes work back that far. **The first sweep asked the wrong hours.**

The seeding times are in the paper and they are not where the case dates put
them:

| Case        | Seeding, UTC                                      |
| ----------- | ------------------------------------------------- |
| 19 Jan 2017 | 1619Z to ~1812Z                                   |
| 20 Jan 2017 | **0000Z to 0200Z** — the night of the 19th onward |
| 31 Jan 2017 | ~2117Z to 2151Z                                   |

The sweep covered 2017-01-20 21Z through 2017-01-21 03Z, which is a full day
after the 20 January case ended. What it measured is real — in-band liquid over
the basin rising to 29.4% of samples, almost all of it in the lowest 10 g/m²
contour — but it is about hours nobody seeded, so it says nothing about SNOWIE
and is not reported as if it did.

Two things from that sweep do stand, because neither depends on the hour:

- **The vertical structure is right.** The band ran 7,174–14,082 ft over terrain
  at 5,802 ft — above the ridges and reachable, which is the geometry that makes
  winter orographic seeding work at all.
- **The archive has holes.** `wrfsfc` is missing for two of the cycles asked for
  while `wrfprs` is present. The scripts record that hour as unbuildable and
  carry on.

Re-running against 0000–0200Z on 20 January, and the other two cases, is the
outstanding item. It is cheap — three hours of cycles per case.

### The band is where the sonde puts it

Every daily report opens with a sounding table — Midland and Del Rio, nine
indices each — and its 12Z ascent lands on an HRRR analysis hour, so neither
side has to be rounded to meet the other. 68 pairs attempted over the season,
64 scored, 3 lost to timeouts.

| reading            |   n |    bias | median \|err\| |     worst |
| ------------------ | --: | ------: | -------------: | --------: |
| freezing level     |  64 |   −31 m |           45 m |     286 m |
| −15 °C height      |  64 |   −26 m |           57 m |     324 m |
| 700 mb temperature |  63 | −0.3 °C |         0.4 °C |    2.8 °C |
| surface CAPE       |  64 |    +238 |            240 | 2953 J/kg |

Taken as a layer rather than as two edges, the band we draw overlaps the band
the sonde measured by a **median 95.7%** of their union, over a layer whose
median depth is 2,537 m. All 64 clear 80% and 56 clear 90%. Bias near zero on
both edges means the misses are scatter rather than a standing offset, so there
is nothing to correct for.

The rows the operator chose to print are the seeding decision itself — the
freezing level and the −15 °C height bound the glaciogenic window, and the warm
cloud depth is what a hygroscopic flare works. This is therefore agreement with
the instrument the crews are briefed on, not with an outside yardstick we went
looking for.

Two things it does not cover. Cloud base is a different quantity on each side —
the report's is a lifted-parcel level, ours is the base of whatever deck is
overhead — so it is printed rather than scored; the pilot radio calls carry a
cloud base twice in the whole season, both on 19 April, which is an anecdote and
not a check. And warm cloud depth is in their table and absent from ours, so the
hygroscopic half of the operation has no counterpart in the app at all.

### The release point sits ten thousand feet below the band

The 12Z KMAF sounding on 19 April puts −15 °C at 5,986 m — 19,639 ft — with the
freezing level at 12,011 ft, so the seeding band sat roughly 14,000–21,000 ft
MSL. **The flares went in at 4,100–6,000 ft.**

That is not a discrepancy, it is the design of the operation: Texas seeds
cloud-base inflow and lets the updraft carry the silver iodide up. It does mean
the release point and the physics are ten thousand feet apart, and the map
answers about the cell, not about where the air in it is going.

### The whole season, and the answer it first gave

Every seeded day of 2025 scored at its nearest analysis hour: 33 days, 497
releases. One day, 20 September, is 11 timeouts and carries no answer.

| verdict     |   n | share |
| ----------- | --: | ----: |
| `noLiquid`  | 390 | 78.5% |
| `raining`   |  89 | 17.9% |
| `candidate` |   7 |  1.4% |
| error       |  11 |  2.2% |

Four cases could not separate a structural disagreement from an unlucky
airmass. A season can, and it says the disagreement is structural: in four
fifths of all releases the model holds no supercooled liquid in the seeding
band over the cell at all, and the radar takes most of the rest.

### The observed half was being read from the wrong minute

**`at` bound all five inputs to one timestamp, and they do not run at the same
rate.** HRRR analyses once an hour. ABI scans every 5 minutes and the radar
mosaic arrives every 2. Truncating a request at 1843Z sent the model to the 18z
analysis — the further of the two — so the sweep rounded every release to the
top of the hour to reach 19z, and pulled the satellite and the radar up there
with it. Every observed reading in the table above was taken up to half an hour
from the flare it was scored against.

The join now rounds the model half and leaves the observed half on the
timestamp it was given. Re-asking the 96 verdicts that rested on an observation
— the radar vetoes and the candidates; cells charged to `noLiquid` never reach
an observation — moves the radar to within **0–2 minutes** of the release,
median 1, and gives this:

| was         | is now      |   n |
| ----------- | ----------- | --: |
| `raining`   | `raining`   |  81 |
| `candidate` | `raining`   |   7 |
| `raining`   | `candidate` |   5 |

**The count barely moved and not one candidate survived.** All 7 were artefacts
of the wrong minute: the six on 10 June read −14 dBZ — no echo at all — at the
top of the hour and 29–33 dBZ when the flares actually left. Five others,
rejected at the hour on 45–48 dBZ, read −2 to 20 dBZ at the release and are
candidates. Two of them carry **802 g/m²** of in-band liquid, the top contour
band; the seven they replace sat at 14 and 339.

So the season's pooled figures were roughly right and every individual answer
underneath them was wrong. That is the shape of a result that looks stable and
is noise, and it is the reason the flights are now drawn on a map rather than
only counted.

**The radar veto itself survives.** 81 of 93 stand at the true minute, so the
17.9% is a real disagreement with the operators and not an artefact.

**What this does not settle.** Observed cloud tops moved a median of 6 °C and up
to 41 °C between the hour and the minute. The 114 releases whose tops read
warmer than −5 °C were mostly charged to `noLiquid` and so were never re-asked,
and that count is built from exactly the reading that proved this volatile. It
should not be quoted until all 497 are re-scored at their own timestamps.

### What the four cases say together

**The primary hypothesis was half right.** The rain veto does reject seeded
cells wholesale — 27% of releases were rejected by it alone, carrying
substantial modelled liquid. But it is not the only thing standing between the
map and the operation, and on T2 it is not even the main one.

Three distinct gaps, in order of how much ground they cover:

1. **The map answers about now; the operator is betting on later.** Six T1
   releases went into cloud whose top was still warmer than −5 °C. There was
   nothing to seed _yet_, and the aircraft was there because there was about to
   be. Nothing in the app expresses growth, and `WEATHERMAN.md` already says so.
2. **The anvil defeats the observed inputs.** All 46 T2 releases sat under tops
   classified `ice`. Cloud-top temperature and cloud-top phase were both
   describing an anvil rather than the turrets underneath — the exact failure
   `MEASUREMENTS.md` §4 predicts, now measured against 46 known seeding points.
3. **The rain veto is a resolution problem before it is a threshold problem.**
   A growing turret on the flank of a raining complex shares a 12 km cell with
   the core. Lowering `RAIN_DBZ` would not fix that and raising it would not
   either; the cell cannot hold both answers.

**None of this calibrates a threshold**, and three days cannot. What it does is
tell us the disagreement is structural rather than a tuning error, which is a
more useful thing to have learned from four cases than a number.

---

## 6. What the archive can reach

Checked against the live buckets on 16 August 2026.

| Source                                | Archive begins | Consequence                       |
| ------------------------------------- | -------------- | --------------------------------- |
| HRRR (`noaa-hrrr-bdp-pds`)            | **2014-07-30** | The model half reaches everything |
| GOES-16 `ABI-L2-ACTPC` (phase)        | 2017           | Phase reaches back further than…  |
| GOES-16 `ABI-L2-ACHP2KMC` (cloud top) | **2023-03-23** | …the cloud top. This binds.       |
| GOES-19 `ABI-L2-ACHP2KMC` / `ACTPC`   | 2025-01-01     | The bucket the code reads         |
| MRMS `MergedBaseReflectivityQC_00.50` | **2020-10-14** | No radar veto before this         |

**All three Texas cases are inside the shipped replay window**, which floors at
2025-04-07 (`ReplayCalendar.tsx:16`). Verified: HRRR, both GOES products and
MRMS all have data on 19 April, 22 April and 11 August 2025.

**January 2017 has HRRR and nothing else.** No cloud-top pressure, no cloud-top
phase, no radar. The HRRR half is genuinely intact that far back — the
2017-01-19 12z `wrfprs` carries `CLMR` on all 40 levels and `TMP` on the same 39
pressure levels the 2025 files do, and the `wrfsfc` file carries `HGT:cloud
base`, `PRES:cloud top`, `RETOP`, `VIL`, `CAPE` and `USTM`/`VSTM`. The archive's
`CLMR` naming is already keyed by origin in `bytes.ts`.

**It is not the same model.** January 2017 is HRRRv2 against HRRRv4 in 2025,
with different microphysics. A weak SLW field over the Payette basin is at least
as likely to be HRRRv2 as it is to be the app.

---

## 7. What the harness is, and what is still missing

Nothing in the app changed to run any of this. `/candidate/point` already
answers the central question, and `eval/README.md` says how to drive it.

### What exists

`eval/` holds plain node scripts, outside both packages and both test suites,
talking to a running server over HTTP with no new dependency anywhere.

- **`releases.mjs`** pulls each day's PDF, inflates the content streams and
  reads the flight table into `{ at, lat, lon, glaciogenic, hygroscopic,
county }`, plus the sounding indices and the narrative's timed cell
  attributes. **499 releases over the 2025 season, zero parse failures.** Each
  report states its flare count three times and the script checks all three
  against each other, so a dropped row cannot pass as a quiet day.
- **`counties.mjs`** fetches the 13 county boundaries from Census TIGERweb,
  keyless, one request each.
- **`points.mjs`**, **`field.mjs`**, **`snowie.mjs`** are the three cases.
- **`season.mjs`** runs the whole 2025 season at its analysis hours, one build
  per cycle shared across every flare in it. **`veto.mjs`** re-asks the verdicts
  that rested on an observation at the minute each flare left, which is one
  build apiece.
- **`reconcile.mjs`** scores the profile against the KMAF and KDRT ascents at
  12Z, the one comparison here that does not have to argue about a clock.
  `--score` recomputes its whole summary from the last run's output without
  fetching, so every figure it publishes is checkable without repeating the
  sweep.
- **`bracket.mjs`** asks the join at both analyses a release sits between and
  reports what the pair agree on. A condition present at 18Z and again at 19Z
  was present across the whole gap, so the answer stops depending on which hour
  an 1843Z flare is charged to. 994 questions over 125 builds, because releases
  are grouped by hour and each hour is constructed once.
- **`server.mjs`** and **`app/`** are the map: the flight record and the scores
  on 3100, and a Vite page on 5174 that points its layers at the Weatherman
  server and lays the flares over them. The page installs nothing —
  `eval/app/node_modules` is a symlink to `/app`'s and `@` resolves to
  `/app/src`, so it draws with the app's own renderers rather than copies of
  them. A tool for finding disagreements must not introduce one between itself
  and the thing it inspects.

The output lives in `eval/out/`; `eval/data/` is the committed input.

**Counting was not enough.** The season's pooled verdicts were stable while
every individual answer under them was wrong, and no table shows that. The map
does: it draws the layers at the release minute with the flare on top and the
crew's own radio call beside it.

**The reports are not always self-consistent.** Six county flare counts in the
season disagree with their own report's table, and on 13 August the stated day
total is one flare short of both other figures in the same document. The table
is the record — it is the half with a minute and a position on every row — and
the disagreements are printed rather than reconciled away.

### What L1 needs, which is nothing

`/forecast/liquid`, `/forecast/cloudbase` and `/forecast/sounding` all take
`at`, resolve to the archive with no lower bound (`forecast.ts:316`) and answer
from HRRR alone. SNOWIE runs through those three routes today. `/candidate/*`
will not work, and should not be made to — `field.ts:251` gathers all five
inputs in one `Promise.all`, and a join missing the cloud-top test is a
different product.

### What the results now argue for

**A second pass that does not disqualify on rain.** The join crosses a cell off
at 20 dBZ and the cells the operators work sit at a median of 32, so the veto is
removing the whole population rather than trimming its edge. `bracket.mjs`
already scores this as a separate test — seedable cloud with every other layer
agreeing, before reflectivity is consulted — because the rejection order puts
rain last and a cell charged to `raining` has passed everything before it. That
makes the second pass exact rather than an estimate: it is already computed, and
the two numbers can be quoted side by side.

What it cannot be is a quiet loosening of the threshold. A cell at 32 dBZ is
raining and saying otherwise would be false; the honest form is **two answers,
one that asks whether the cloud is worth seeding and one that asks whether it
has already spent its liquid**, with the second reported rather than used to
suppress the first. That also matches what the operator does — they see the echo
and fly it anyway.

**Re-run SNOWIE against the right hours.** The seeding windows are now pinned
(§3) and the first sweep missed all three. Three hours of cycles per case, and
it decides whether L1 says anything at all.

**More Texas days, and they are already parsed.** Thirty-four seeded days and
one more `_NS` day are sitting in `releases-2025.json` unqueried. Two days is
not enough to tell a structural gap from two unlucky airmasses, and the
county-scale discrimination came out positive on one and inverted on the other
— which is exactly the split that more days would settle.

**Then the GOES bucket.** `scene.ts:22` hardcodes `noaa-goes19`. Making it a
function of the date — `noaa-goes16` before 2025-04-07 — drops the calendar
floor to 2023-03-23 and opens the 2023 and 2024 seasons, which have the same
published reports.

### Still not now: rainfall

`CONUS/MultiSensor_QPE_01H_Pass2_00.00/` sits in the `noaa-mrms-pds` bucket the
radar service already reads, in the same gzipped GRIB2 form, from 2020-10-14,
gauge-corrected. A service and a route are straightforward. **The hard part is
not the data**, it is that no honest claim comes out of it without a
target/control design, so build it when there is a design to feed it.

`scene.ts:22` hardcodes `noaa-goes19`. Making the bucket a function of the date
— `noaa-goes16` before 2025-04-07 — would drop the calendar floor to 2023-03-23
and open the 2023 and 2024 Texas seasons, which have the same published reports.

For rainfall, `CONUS/MultiSensor_QPE_01H_Pass2_00.00/` sits in the
`noaa-mrms-pds` bucket the radar service already reads, in the same gzipped
GRIB2 form, from 2020-10-14, gauge-corrected. A service and a route are
straightforward. **The hard part is not the data**, it is that no honest claim
comes out of it without a target/control design, so build it when there is a
design to feed it.

---

## 8. Confounds to write on the results, not discover afterwards

- **The 12 km cell is the resolution limit of the whole test.** A release point
  and the mature core it was flown beside land in the same cell. Every
  disagreement charged to `raining` has to be read with that in mind.
- **The permit excludes severe storms; the candidate field does not** — and on
  19 April the operators seeded inside a severe watch, under warnings, anyway.
  Neither the permit nor our field is describing what actually happened.
- **Hygroscopic flares are out of scope.** The platform models the glaciogenic
  process only. Releases marked `H` are warm-cloud work and should not be
  expected to line up; the tables distinguish them, so exclude them and say so.
- **The seeding altitude is not the seeding band.** Flares are fired into
  cloud-base inflow at ~4,000–6,000 ft and 15–24 °C; the band is where the AgI
  ends up after the updraft carries it, thousands of feet higher. A release
  point is where the aircraft was, not where the physics happens.
- **Cloud-top phase describes the highest deck**, so under an anvil it is about
  cirrus, not about the turret (`MEASUREMENTS.md` §4). T1 and T3 both sit under
  anvils by the operator's own account.
- **This measures the atmosphere, not what a forecaster could have had.** A
  release is scored against the analysis whose valid time is nearest it, which
  is the best reading of that moment. It is not always a reading anyone could
  have used: HRRR posts ~50 minutes after the hour, so nobody held the 19z
  analysis at 1843Z. The gap is a limit on operating from this platform, not on
  measuring against it, and the two must not be quoted as one number.
- **An observed reading is only as good as the minute it came from.** Cloud tops
  move a median of 6 °C between the top of the hour and the release, and up to
  41 °C. Any figure drawn from the satellite or the radar has to name the
  timestamp it was asked at.
- **The sounding comparison has a small offset, not none.** A sonde is released
  about 45 minutes before its nominal hour and reaches the seeding band minutes
  into the ascent, so the separation from the 12Z analysis is 20–30 minutes. It
  is survivable where the flare comparison's 17 minutes is not, because a
  thermal profile at 4–7 km moves tens of metres in an hour while a growing
  turret swings 40 dBZ in the same span. Quote it as a close comparison, never
  as a simultaneous one.
- **The sounding indices are a human reading of the ascent.** They are lifted
  from the operator's own report rather than from raw sonde data, and they carry
  that reading's mistakes — one Del Rio row states a freezing level below sea
  level. Impossible values are dropped when scored, which means the check is
  against the operator's understanding of the atmosphere, which is also what the
  aircraft were launched on.
- **Two sites and one hour do not cover the operation.** Midland and Del Rio
  bracket the target counties without being inside most of them, and 12Z is
  morning while seeding flies in the afternoon. The band comparison validates
  vertical structure, not skill at the hour and place a flare is released.
- **HRRRv2 is not HRRRv4** (§6).
- **Three days is three days.** `MEASUREMENTS.md` §6 says to score this product
  over a Texas year, and that a single day can carry most of a year's footprint.
  These are worked examples that say whether the platform points in the right
  direction. They are not a score, and nothing in them calibrates a threshold —
  including `RAIN_DBZ`, however the primary hypothesis lands.

---

## Sources

- [WTWMA 2025 operations, with the per-day reports](https://westtxwxmod.com/?page_id=23)
- Friedrich et al. (2020), _Quantifying snowfall from orographic cloud seeding_,
  PNAS 117(10) 5190–5195 — [PMC7071876](https://pmc.ncbi.nlm.nih.gov/articles/PMC7071876/)
- [SNOWIE project, NCAR RAL](https://ral.ucar.edu/projects/seeded-and-natural-orographic-wintertime-storms-the-idaho-experiment-snowie)
- [TDLR — rain enhancement operations in Texas](https://www.tdlr.texas.gov/weather/summary.htm)
- [Census TIGERweb State_County service](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer)
- Buckets: `noaa-hrrr-bdp-pds`, `noaa-goes16`, `noaa-goes19`, `noaa-mrms-pds`
