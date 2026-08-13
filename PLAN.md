# Plan — from candidate-finder to a Texas rainy-season product

Companion to `INVESTIGATION.md`, which established where the app stands. This is
the route to something an operator could use in a Texas season, and to a test
corpus of real historical cases that proves it.

Scope is **Texas, rainy season**. Everything below is measured against the free
archives rather than assumed; each phase names what it changes and how it is
tested.

---

## 0. Definition of done

The product is real when all five hold:

1. The app can be run **at any past hour**, not just "now".
2. It emits **one candidate field** — not three layers an operator intersects by eye.
3. That field is computed from **C2 depth, C3 band altitude, C4/C5 liquid, and C6
   radar**, with C1 and C7 as attributes.
4. It is scored against a **corpus of real Texas seeding days**, with false-alarm
   days included.
5. Its thresholds are calibrated over a **Texas year**, not a run.

---

## 1. Correction: band height is seasonal, and is not a defect

`INVESTIGATION.md` flagged that the −5 °C level sat at 18,700–19,900 ft across
Texas, above the drone's ≥18,000 ft design ceiling. **That was August. It is a
seasonal artifact, not a finding, and the app should not flag it.**

Measured from the HRRR archive (`noaa-hrrr-bdp-pds`), analysis hour, 18z, over the
Texas box (lat 25.5–36.6, lon −106.7…−93.4; **176,972 HRRR cells**). Isotherm
heights interpolated per cell from `TMP`/`HGT` at 350–900 mb, lowest crossing:

| Date (18z) |  −5 °C median |    p10 |    p90 | −18 °C median | Season               |
| ---------- | ------------: | -----: | -----: | ------------: | -------------------- |
| 2025-03-15 | **10,122 ft** |  8,267 | 16,395 |        16,819 | before season        |
| 2025-04-15 | **16,117 ft** | 14,479 | 17,243 |        21,417 | rainy — season opens |
| 2025-05-15 | **17,268 ft** | 15,260 | 18,238 |        22,976 | rainy — peak         |
| 2025-06-15 | **18,215 ft** | 17,601 | 19,266 |        24,606 | rainy — peak         |
| 2025-08-13 | **19,065 ft** | 18,359 | 19,553 |        25,796 | peak summer (dry)    |
| 2025-09-15 | **18,344 ft** | 17,304 | 19,098 |        24,442 | rainy — secondary    |
| 2025-10-15 | **18,959 ft** | 18,339 | 19,612 |        25,217 | late                 |

Seven single days at one hour — **an illustration of the seasonal cycle, not a
climatology.** Building the real one is Phase 5.

**What this establishes:**

- In April–May the band base sits at **16,100–17,300 ft**, close to and often below
  the 18,000 ft design figure, with p10 down to 14,500 ft. The design number
  describes the rainy season, and the app already reproduces it. The August result
  was the app correctly reporting a hot airmass.
- March is lowest and most spread (p10 8,267 → p90 16,395), i.e. a synoptically
  active cold airmass — but it is **outside the April 1 – September 30 permitted
  season**, so the most reachable band of the year is not one Texas may seed.
- The seasonal swing of the band base is ~9,000 ft. **Nothing may be gated on an
  altitude constant**, consistent with `MEASUREMENTS.md` §4.

**Rule this sets for the build:** reachability is a **configurable parameter and a
reported attribute**, never an alert. The app reports the band altitude and, if a
ceiling is configured, whether the band's base is below it. A band above the
ceiling in July is correct output, not a warning condition.

**Working definition of the rainy season** used throughout: **April–June and
September–October**, with **July–August** retained as the dry control. This is the
bimodal Texas rainfall pattern intersected with the TDLR permitted season.

---

## 2. Reconciliation — what the app shows vs. what Texas actually seeds

| Texas operational practice                              | What the app has today                | Gap                                                  |
| ------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------- |
| Targets **convective clouds with base 4,000–12,000 ft** | Cloud base, banded on that window     | closed — Phase 1                                     |
| Requires **vertical depth past the freezing level**     | Depth and the C2 test, at one point   | partly closed — the map's answer waits on the join   |
| Seeds **growing turrets with cloud-base inflow**        | CAPE at a point; no tendency          | **C1** — vigour is reported, growth still is not     |
| Cloud-top seeding temp normally **−5 to −10 °C**        | −5 °C filter, open-ended cold         | admits cirrus-topped systems alongside young turrets |
| Season **April 1 – September 30**                       | No season awareness                   | benign, but corpus and calibration must respect it   |
| **Excludes severe storms** (TDLR)                       | Storm motion and lightning at a point | **C7** — reported, and nothing screens on them       |
| Judged by a **field meteorologist on the day**          | Four layers, fused by eye             | **the join** — no single candidate field             |

**The reconciliation, in one line:** the app answers _"is there modelled liquid in
the band over this point"_; Texas practice asks _"which growing turret, with a base
I can fly up through, should this aircraft seed in the next 30 minutes"_.

The good news, established below: **most of the missing variables are already in a
file the app downloads on every build.**

---

## 3. Phases

### Phase 0 — Historical replay ("time travel") — **built**

**Nothing else in this plan is testable without it**, which is why it went first.

All three services take an optional `at`, absent meaning live:
`GET /forecast/liquid?hour=0&at=2025-05-15T18:00Z`, and likewise for
`/cloudtop/temperature`, `/radar/reflectivity`, `/forecast/sounding` and the
stats routes. A `/map/replay` page drives them from a calendar. The contract and
the traps are documented in `WEATHERMAN.md` under "Historical replay"; what follows
here is the evidence the archives support it.

**Archive sources, all verified reachable and keyless:**

| Source    | Archive                                                               | Verified                                                        |
| --------- | --------------------------------------------------------------------- | --------------------------------------------------------------- |
| HRRR      | `noaa-hrrr-bdp-pds` → `hrrr.YYYYMMDD/conus/hrrr.tHHz.wrfprsf00.grib2` | idx 200; 12 MB of ranged records pulled in 10 s                 |
| GOES-East | `noaa-goes19` → `<PRODUCT>/YYYY/DDD/HH/`                              | scenes present for 2025-05-15                                   |
| MRMS      | `noaa-mrms-pds` → `CONUS/MergedBaseReflectivityQC_00.50/YYYYMMDD/`    | **same product the app already uses**, dated path; back to 2020 |

**Verified traps — all three fail quietly:**

- **S3 ignores multi-range requests.** NOMADS answers 16 ranges with `206` and a
  multipart body; S3 returns **`200` with the entire ~398 MB object**. Issue one
  request per range and **assert `206`**. My sampler does this and it is why a case
  costs 12 MB rather than 398 MB.
- **The archive names cloud mixing ratio `CLMR`; NOMADS names it `CLWMR`.**
  Confirmed in the 2025-05-15 index. Only the index lookup needs to know —
  eccodes' `shortName` is `clwmr` on both.
- **GOES-19 became GOES-East in April 2025.** There is no GOES-19 data for
  2025-05-15's predecessors — I confirmed `noaa-goes16` has nothing that day and
  `noaa-goes19` has scenes. **Corpus cases before ~2025-04-07 must read
  `noaa-goes16`.** Simplest resolution: restrict the corpus to the 2025 and 2026
  seasons and keep one satellite.

**Tests:** `server/src/tests/replay.test.ts` covers `at` parsing, cycle
truncation, the publication-lag guard, MRMS key-time parsing, and the 206
assertion (a mocked `200` must throw rather than decode).
`app/src/tests/ReplayCalendar.test.tsx` and the replay cases in `Map.test.tsx`
cover the picker and the layer wiring.

---

### Phase 1 — Harvest `wrfsfc`, which we already download — **built**

The single best effort-to-value step. The app fetches `wrfsfcf00`/`f01+` for `TCDC`
and `PRATE` already. That same file carries, verified in the 2025-05-15 index:

| Record                                       | Criterion | Note                                           |
| -------------------------------------------- | --------- | ---------------------------------------------- |
| `HGT:cloud base`                             | **C2**    | 2.38 MB record; the missing selection variable |
| `HGT:cloud top`, `PRES:cloud top`            | C2        | sparse — see below                             |
| `CAPE:surface`, `CAPE:180-0 mb above ground` | **C1**    | convective vigour proxy                        |
| `USTM`/`VSTM:0-6000 m`                       | **C7**    | storm motion vector — the steering product     |
| `LTNG:entire atmosphere`                     | C1, C7    | electrification                                |
| `VIL:entire atmosphere`                      | C5        | independent cross-check on the SLW integral    |
| `RETOP:cloud top`                            | C1        | radar echo top                                 |

**Measured on 2025-05-15 18z f00**, at the 12 km block averages the app
contours on, with a cell counted as having a base only when most of its 3 km
points do:

```
Texas box (11,071 cells)
  cloud base present            39.3 %   (60.7 % clear -> real nodata)
  of those, base MSL:  p10  3,185   median 16,226   p90 23,263 ft
                       <4k 18.3 %   4-12k 11.7 %    >=12k 69.9 %
  the 4-12k window as a share of all Texas cells:   4.6 %

CONUS
  cloud base present            55.9 %      median 3,719 ft MSL
  cloud top  present            27.7 %   (of raw 3 km points)
```

The Texas median sits high because `HGT:cloud base` is the base of the **lowest
deck of any kind**, and on that afternoon most cloudy Texas cells were cirrus
over clear low levels. Read the window share, not the median: the operational
target is 12% of cloudy Texas ground, not the typical case.

Three conclusions:

1. **The field is bimodal**, so the layer is **disjoint bands**, not nested
   contours — and its ramp lights the middle band, because cloud base is a
   window with a wrong side at each end rather than a magnitude.
2. **HRRR's cloud base is dense and its cloud top is sparse** — twice the ground
   on the same hour. So take **base from HRRR and top from GOES**, mirroring the
   existing cloud-top layer's two-source split and matching `MEASUREMENTS.md`
   §4's note that `PRES:cloud top` reports one deck rather than the highest.
   Depth is therefore **not drawn**; it is answered at the clicked point, where
   HRRR's own top is either present or honestly reported absent.
3. **C2 is computable today**, and it is the first criterion in the design the
   app has ever been able to check.

**Verified trap — the f00 constant-field signature.** `LTNG` at f00 is a **188-byte
record decoding to zero at all 1,905,141 points** — exactly the signature the repo
already documents for `PRATE`. Lightning is a flux needing a timestep, so it is
**f01+ only**, and a `firstHour` covers it. Every other record here is full-size at
f00, so the layer works at the analysis hour the candidate map draws.

**Second verified trap — the nodata sentinel.** 9999 is unsafe for a height field
in metres: `HGT:cloud top` carries real values to 15,698 m in the same file, so
9999 m ≈ 32,800 ft is an ordinary cloud top and real values get read as missing.
The symptom is cloud tops below cloud bases rather than an error. Use a sentinel
outside the physical range.

**Third trap, found while building it.** `RETOP` carries no bitmap and writes its
own −999 where there is no echo, so the sentinel above never sees those points;
and it decodes with `shortName` `unknown` while cloud base and cloud top are both
`gh` at level 0. Messages are matched on `parameterCategory:parameterNumber:
typeOfLevel` instead. All three are now in `MEASUREMENTS.md` §5.

**What shipped.** `DIAGNOSTICS` in `forecast.ts` reads all nine records in one
ranged fetch and one cached build; `cloudBase()`/`cloudBaseStats()` serve the
banded layer and its summary, and `sounding()` reads the same grid at the clicked
cell for `diagnostics` — cloud base MSL and AGL, depth, the C2 verdict, both CAPE
parcels, storm motion, lightning, VIL and echo top. The layer is on the candidate
map at the analysis hour, off by default, with `CloudBase` and `Convective`
panels. A cold build is ~12 s and every later request that hour is cached.

**Not in this phase:** the replay map still carries three layers. A fourth source
lengthens its all-answered gate, and its panel is being kept clear for the Phase 2
candidate field.

---

### Phase 2 — The join: one candidate field

The core deliverable. `INVESTIGATION.md` measured the intersection of the three
existing layers at 2.23% of CONUS and 0.13% of Texas; nothing in the codebase
computes it.

**New service** `server/src/lib/services/candidate.ts`, exporting `Seedability`,
joining on the shared 12 km grid **before contouring** — every input is already on
that grid, so the join is an array pass, not a geometric operation.

Per cell, from Phases 0–1:

```
C2  cloud base <= band base <= cloud top        (HRRR base, GOES top)
C3  band base/top altitude                       (already built)
C4  SLW path in band >= threshold                (already built)
C5  same integral, as magnitude
C6  NOT (reflectivity >= threshold)              (already built)
C1  CAPE, cloud-top cooling tendency             (attribute)
C7  storm motion, lightning, band base vs ceiling (attributes)
```

**Output shape — a decision to make deliberately.** `CLAUDE.md` gives two polygon
shapes and the choice turns on coverage, which must be checked before picking:

- If candidate area stays rare and "more" means "more" → **nested contours**
  (`features()`), stacked ramp.
- If a graded score spreads evenly across the grid → **disjoint bands**
  (`bandFeatures()`), unstacked ramp, as cloud-top temperature uses.

Given 0.13–2.4% of Texas passing, nested is the likely fit, but **measure the
per-level coverage over the corpus before committing**, per the existing guidance.

**Hard constraints, unchanged:** no raster; GeoJSON from our own server; the join
must not invent structure — every input is already at 12 km or block-averaged down
to it, and nothing is interpolated up.

**Attributes, not gates.** C1 and C7 ride as feature properties so the sidebar can
report them without the map pre-filtering on numbers we cannot yet justify. Per
`MEASUREMENTS.md` §6 and the standing rule, **a threshold needs a citation, not a
coverage table** — so ship the fields and defer the cutoffs to Phase 5.

---

### Phase 3 — Observed cloud-top phase as a cross-check on the model

`ABI-L2-ACTPC`, verified in `INVESTIGATION.md` §5.3: an explicit
`super_cooled_liquid_water` class, 2 km, 5-minute cadence, 666 KB per scene (6×
smaller than the cloud-top-pressure scene already ingested), same bucket, same
`abi.ts` reprojection, decodes with the installed `h5wasm`. **No new dependency.**

It is **cloud-top phase only** and is therefore an _observed constraint on_ C4, not
a solution to it. Its job is to flag disagreement: cells where HRRR says in-band
liquid and the satellite says the top is glaciated. `INVESTIGATION.md` measured
model/satellite agreement at 88.3%; this makes the 11.7% visible instead of
invisible.

Ship it as an attribute on the candidate field first — a confidence flag — rather
than as a fourth toggle.

---

### Phase 4 — Validation corpus of real Texas cases

**The point of the whole plan: replay days Texas actually seeded and confirm the
app flags them.**

**Ground truth sources** (both need manual acquisition — `westtxwxmod.com` is behind
Cloudflare and returns 403 to scripted fetches, and the TDLR summary is a PDF; do
not automate scraping them):

- **West Texas Weather Modification Association operations log** — dated, per-county
  seeding days with flare type and aircraft. The richest source: 2025 season logged
  from April, e.g. operations in Tom Green, Irion and Glasscock counties.
- **TDLR weather-modification records** — licensed projects, target areas, permitted
  periods, and the July 2025 suspension window.

**Corpus design:**

| Class                          | Selection                                                                                    | Expected result                                                              |
| ------------------------------ | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Positive**                   | ~15 logged seeding days, spread across April–June and September, sampled at the seeding hour | candidate field non-empty inside the target counties                         |
| **Negative — clear**           | ~10 days with no cloud over the district                                                     | field empty                                                                  |
| **Negative — wrong season**    | ~5 mid-July/August days at peak heat                                                         | band high; little or no in-band liquid                                       |
| **Negative — already raining** | ~5 days with widespread MRMS echo over the district                                          | C6 suppresses most candidate area                                            |
| **Suspension window**          | the July 2025 TDLR suspension days                                                           | records what the app would have shown; **not** scored as a seedability label |

**Scoring honesty — the label is weak, and the corpus must not pretend otherwise.**
A logged seeding day says _an operator judged some cloud seedable somewhere in the
district within some window_. It does **not** say a given 12 km cell at a given hour
was seedable. So:

- Score at **district-day** resolution, not cell-hour.
- Report **hit rate** (positives with non-empty candidate area in the district that
  day) and **false-alarm rate** (negatives that flag), and report them separately
  rather than folding into one accuracy figure.
- **A negative day that flags is not automatically wrong** — operators fly a finite
  number of sorties and do not seed every seedable cloud. Treat false alarms as a
  ceiling on precision, not proof of error.
- Never tune thresholds to maximise agreement with a weak label; that manufactures
  a number the data cannot support.

**Mechanics:** cases live as fixtures of `{date, hour, counties, class, source}` —
dates and expectations only. Archive bytes are **not** committed; the repo's testing
convention is explicit that GRIB fixtures do not belong in git. The corpus runner is
a script, not part of `yarn test`: it hits the network and takes minutes per case.
Unit tests keep mocking `fetch` as they do now.

---

### Phase 5 — Rainy-season climatology and threshold calibration

Replaces every single-run figure quoted anywhere in the repo.

- Sample the HRRR archive across a **full Texas year** at the hour sorties fly,
  weighted toward April–June and September, with July–August as the dry control.
  Per the standing rule, Texas opportunity is episodic — a large share of sampled
  days carry essentially no supercooled liquid, and one day can carry most of a
  year's footprint.
- Produce: candidate-area distribution by month; per-level coverage for the Phase 2
  ramp decision; band-base distribution by month (the proper version of §1's table);
  how often C2 depth is satisfiable at all.
- **Calibrate only what the data can settle.** Coverage figures say what a threshold
  _costs_, never whether it is physically real. The −5 °C warm edge stays fixed
  (physics); the SLW levels and any C1/C7 cutoffs are chosen for legibility and
  documented as judgements with their cost, not dressed as physical constants.

Cost estimate from the sampler built for §1: ~12 MB and ~10 s to pull one case's
profile records, ~35 s to decode over Texas. A 24-case year is well under an hour.

---

## 4. Concrete test cases

**Seasonal regression** — pins the correction in §1, and is cheap enough for CI if
the archive is reachable:

```
2025-04-15 18z  Texas median -5 C band base   16,117 ft  +/- tolerance
2025-05-15 18z                                17,268 ft
2025-06-15 18z                                18,215 ft
2025-08-13 18z                                19,065 ft   (dry control, high band)
```

Asserts the app reproduces the seasonal cycle and lands near the 18,000 ft design
figure in the rainy season. **A high band in the August case is a pass, not a
failure.**

**Unit tests** (mocked, in `yarn test`):

- `candidate-service.test.ts` — hand-built grids: a cell passing every criterion; a
  cell failing only C2; a cell suppressed only by C6; a cell with cloud base present
  and top missing. Assert geometry, not ring counts.
- Replay resolution: `at` picks the right archive key; a `200` on a multi-range
  request throws.
- Sentinel handling: a cloud top at 9,999 m decodes as a **value**, not as missing.
  (`cloudbase-service.test.ts`.)
- `LTNG` at f00 is skipped, as `PRATE` is. (`recordsAt`, same file.)

**Corpus run** (network, scripted, not in `yarn test`): the Phase 4 table, reported
as hit rate and false-alarm rate at district-day resolution.

---

## 5. Ordering and dependencies

```
Phase 0 (replay) ──┬── Phase 1 (wrfsfc: C2, C1, C7)   [built]
                   │        │
                   │        v
                   ├── Phase 2 (the join)  ── Phase 3 (ACTP cross-check)
                   │        │
                   v        v
                  Phase 4 (corpus) ── Phase 5 (climatology + calibration)
```

Phase 0 gates everything. Phases 1 and 2 are independently shippable and each
improves the live app on its own. Phase 4 is the first point at which any claim
about real-world seedability can be made.

---

## 6. Explicitly out of scope

- **Any raster on either map.** Unchanged.
- **A seedability verdict.** With no ground station, C4 inside the cloud is
  simulation. The product is a targeting tool; the station renders verdicts.
- **Interpolating any coarse field to 12 km.** The sampling rule stands.
- **Paid or keyed sources.** Everything above is keyless.
- **New dependencies.** Nothing in this plan needs one — `h5wasm` covers ACTP,
  eccodes covers the new GRIB records, and the byte-range machinery exists.
- **Scraping the WTWMA or TDLR sites.** Both block automation; acquire by hand.
- **Cloud-top cold cutoff.** Still needs a citation, still absent from the design.

---

## 7. Open questions needing a decision

1. **Corpus window.** Restricting to the 2025 and 2026 seasons keeps one satellite
   (GOES-19) and avoids the GOES-16 transition. Widening earlier means supporting
   both buckets. Recommend restricting.
2. **Which district.** The WTWMA log is the most detailed public source; scoping the
   first corpus to its counties gives the cleanest labels. Other permitted Texas
   districts can follow.
3. **Configured ceiling.** §1 makes reachability a parameter — what value, and is it
   a per-airframe setting in the UI or a server constant? The design's R2 ≥18,000 ft
   is the natural default.
4. **Candidate ramp shape.** Nested vs disjoint, decided on measured coverage in
   Phase 5 — but Phase 2 ships before that, so it needs a provisional choice.
   Recommend nested, revisited once the climatology lands.

---

## 8. What is still not solvable from national feeds

Unchanged by this plan and worth restating, because no phase above closes it:
**nothing free and national measures supercooled liquid water in the vertical.**
Radar cannot see it, satellite sees the top only, CIP publishes no API. Phases 1–3
sharpen _where to look_ and add observed constraints at cloud top and cloud base;
the phase and quantity of liquid _inside_ the −5…−18 °C band remains HRRR's
simulation until a ground station measures it.
