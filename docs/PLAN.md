# Plan — Texas overlay, in this repo

Implement `INNOVATION.md` on the `texas` branch. Each increment is
shippable without the next, scored against the 2025 painted days that
already exist, and written in this stack: one service, one router, a
proxy prefix, mirrored types, a client function, a slice, a provider
where one is needed, a component in the route folder, tests for the
file that changed.

Honor `AGENTS.md`. Take liberty with the product. Do not wrap TITAN. Do not add LROSE.
Do not retarget the opportunity contour onto flares.

---

## 1. The map opens on storms

The candidate map and the replay map start on radar, with cores, heading,
and the upwind flank on. The seeding-opportunity join starts off.
Supercooled liquid, cloud tops, and cloud base stay off until asked.

Panel order follows the object: radar first, then the inputs, then the
join last. A click leads with the storm (`StormHere`), then the column.

Copy names the job: which storm, which flank, can we reach the base.
`CandidateLegend` is the seeding opportunity and says so.

**Already in the building.** Storm objects, cores, heading ticks, the
click readout, `target` on `CandidatePoint`. This increment is defaults,
order, and words.

**Tests.** Slice defaults. `Map.test.tsx` / `MapReplay.test.tsx` opening
visibility. `CandidateLayers.test.tsx` / `ReplayLayers.test.tsx` switch
state. `ClickedPoint.test.tsx` that the storm section is present once a
point is picked. Legend and About tests that walk the same names.

## 2. Draw the flank

`GET /radar/objects/flanks` already returns the raining cells on the
upwind edge of each mosaic storm. Empty when the storm has no heading:
we do not guess inflow.

Wire it as a GeoJSON layer, live and replay, driven with cores and
heading so one switch shows the object. Hollow fill, a color that is
not the cyan rain, not the white arrow, not the yellow lightning. The
legend says this is the upwind raining edge, not the updraft.

**Tests.** Router already serves the route; add the same shape of
assertion the cores and motion tests use. Layer url, renderer, and
visibility in `layers.test.ts` and `Map.test.tsx`. Legend summary pins
"upwind" and "heading, not inflow."

## 3. The click is a Texas reading

`CloudHere` stops treating rain as a veto. It reports, in order:

1. The Texas tests already on `CandidatePoint.target` — base under
   12,000 ft above the ground, echo top at or above freezing in the
   neighborhood, rain in that neighborhood.
2. Supercooled liquid, base, top, reflectivity, and observed phase as
   readings. Rain is "the radar sees rain here," not "raining itself
   out."

`StormHere` stays the object: inside, flank, heading, age, growth,
echo top past freezing, liquid over the storm.

**Tests.** `CloudHere.test.tsx` for each `TargetVerdict`, and that a
raining cell is not captioned as ruled out of a sortie. Existing
phase and coverage distinctions stay.

## 4. Cloud base against the seeding criterion

The 12,000 ft AGL bound is drawn as its own fill, nationally, not as a
Texas-only mask. MSL would move the bound with the ground; AGL is what
transfers from the Gulf coast to high terrain, and the reason the bound
exists — the depth of dry air rain falls through under the base — is a
height above the ground.

It is an upper bound only. The state's published 4,000–12,000 ft figure
describes where Texas bases usually sit and is not a test.

The existing height ramp stays a switch. Nothing new gates the storm
off the map.

**Tests.** AGL versus the named `SEEDABLE_BASE_FT` constant, not
literals. A column under the bound outside Texas still draws, and a base
below 4,000 ft above the ground draws.

## 5. Echo at freezing, as a picture

TWMA briefings: for glaciogenic seeding, look for a core of higher
reflectivity at or above the freezing level. Sample MRMS onto the 3 km
column and draw echo at the freezing level, labeled as measured
reflectivity at a modeled height. Finding 1 already trusts that height
against the balloons.

Not a volume scan. Not a second rain fill on every storm. A picture of
the cue they already use.

**Tests.** On 2025 seeded storms, is there echo at or above freezing
over the object they worked? The click already reports 18 dBZ top
versus freezing; this increment asks the same question as geometry.

## 6. Briefing fields over the permit boxes

CAPE, CIN, LCL, freezing level, −15 °C, cloud base, warm-cloud depth
(freezing minus base) are in every West Texas report and in HRRR. Today
they are a clicked-point readout or a balloon table. As a map they are
the 12Z decision, statewide, at 3 km.

Warm-cloud depth is produced as **depth**, labeled as such. That is
not hygroscopic targeting.

The forecast route's nested cloud-cover polygons are not this loop.
They can stay; they are not the morning briefing.

**Tests.** On flying days, the modeled 12Z column at Midland and Del
Rio against the table they printed, past the two isotherms Finding 1
already matches.

## 7. Growth and safety on the cell

Successive GOES tops (already ingested one at a time and discarded) as
a colder/warmer reading on the tracked storm — the click already has
the five-minute delta. GLM stays points. Ceiling against the band base
is already computed and not flagged; flag it.

First half-lifetime stays a TITAN number until a tracker with more than
about 18 minutes of mosaic history exists. Do not draw an 18-minute
floor as a percentile.

## 8. Replay of this storm, these flares

The eval app is the prototype. The operator replay should show the
flare on the mosaic storm, with the column and the liquid check, at
that hour. No new physics.

**Tests.** A painted day already in `eval/out/` renders on `/map/replay`
with the same storm reading `paint.mjs` stored.

## 9. Evaluate against the season

Score every located 2025 flare against Weatherman's own layers at that
minute, re-score the 12Z balloons against the modeled seeding band, and
store JSON the eval app reads as regional maps and tables.

The operator map (increments 1–6) is the product this run scores. Paint
on the us-east-1 box, in parallel, one day per process. `eval/README.md`
is the job. The eval app stays as it is until `out/` is complete; then
it grows a Texas-fills table and a `target` switch on the regional map.

**Tests.** `verify.mjs` exit 0. `score-season.mjs` prints original
layers, Texas fills, storm features, and band overlap. Every located
flare has `near.target`, `near.baseWindow`, `near.echoFreeze`, and
`storm`.

---

## Standing refusals

- Embed or wrap LROSE/TITAN. A program track export is a source, not
  a host process.
- Gate on a threshold because it raises flare overlap.
- Claim volume, precipitation mass, or lifetime percentile from the
  mosaic.
- Label heading as inflow.
- Promote salt to a candidate field before warm-cloud depth exists as a
  layer.
- Contour lightning or a one-scene growth rate.
- Split a second repository for Texas. Two questions, one codebase.

---

## Order

Do 1, 2, and 3 together: they are one product pivot on code that
already exists. Then 4, then 5, then 6. 7 and 8 can land whenever the
click and the flank are already the map. **9 is the next work:** the
operator map is far enough along to score. Paint the season, then the
eval app.

After 1–3, run the app tests those files touch, then the full suite in
both packages before calling the pivot done. Drive `/map/candidate` and
`/map/replay` in the browser: radar and flank on, the Texas fly fill
on, a click reads FLY and the column.

---

## Session handoff — cloud-base and measured-cloud work

Picks up mid-thread. What is decided, what is done, what is next.

### Done and in the working tree (server + app tests green: 432 / 460)

- **Seeding opportunity no longer rejects a cell for a missing modeled
  cloud base.** In `candidate/target.ts`, the two height tests run only
  when HRRR has a base; where it has none the cell rests on the two
  measured radar tests. The LCL fallback that was here briefly is gone —
  it never rejected anything and printed a base ~5,000 ft low.
- **Base test is an upper bound only: `SEEDABLE_BASE_FT = 12000` ft AGL.**
  The 4,000 ft floor is deleted (cited: WCTREP operations manual). The
  MSL/AGL sidebar bug is fixed (`seedableBasePct`).
- **Painted-area table** in `score-season.mjs` (`polygonsAreaKm2`,
  `boxAreaKm2` in `eval/lib/geo.mjs`) so coverage cost is scored beside
  overlap. `INVESTIGATION.md` Finding 9 records the diagnosis.
- Docs reconciled (WEATHERMAN, INNOVATION, PLAN, PROXY, EVALUATION,
  INVESTIGATION). `eval/out/` is still painted under the OLD rules —
  reprint before quoting any figure.

### Decided this session (not yet built)

- **Service ceiling → 18,000 ft, period.** Operator's call. Over most
  Texas terrain 18,000 ft AGL sits above the 18,000 ft MSL airframe
  ceiling, so the airframe ceiling becomes the only height limit that
  fires. Set it and drop the separate AGL cutoff.
- **CCL is the base proxy where HRRR has no cloud base**, not the LCL.
  Offline vs the operators' own printed cloud base (104–127 balloon
  mornings, all three numbers off the same balloon):
  - CCL: +961 ft bias, 1,385 ft typical miss, 61% within 2,000 ft.
  - LCL: −2,566 ft bias, 2,749 ft typical miss, 35% within 2,000 ft.
  - CCL is closer than LCL on 68% of mornings, and never exceeded
    18,000 ft AGL in the whole sample (max 14,639 ft). So under an
    18,000 ft ceiling the base is barely a gate — its job is "supply a
    plausible workable base," and the radar+GOES gate does the existence
    work.
  - CCL is not in HRRR (checked the record list). Compute it from TMP on
    pressure levels (already downloaded) + a surface moisture field
    (`SPFH:2 m`, in `wrfsfc`). CCL exists over clear ground too, so it is
    only ever a height — the measured gate decides whether a cloud is
    there.
- **Measured cloud existence = GOES ABI cloud top**, read UNFILTERED
  (today it is filtered to <= -5 C for display). It confirms cloud +
  top nationally. Over the 2025-05-26 Irion storms it measures -21 to
  -36 C tops with 32,000-39,000 ft radar echo tops — a real glaciating
  cloud. GOES is top-only; no free feed measures the base (the C4 gap).
- **Top-anchored parcel base** (infer base by finding the parcel whose
  moist adiabat tops out at the GOES-observed cloud top, read its LCL) is
  the "clever" option. Physically sound, entrainment-biased high, works
  best on the young warm-topped feeders we care about. NOT validated —
  needs HRRR profiles at KMAF/KDRT + GOES top, which the reports do not
  carry. Given CCL is already good under an 18,000 ft ceiling, treat
  top-anchoring as optional; only build it if CCL proves too scattered
  in practice.

### Irion, settled

The ten 2025-05-26 Irion flares (1934-1947Z) are NOT recovered by any
base work: they sit 3.5-13 km outside 20 dBZ, so they fail the measured
radar gate, not the base test. They were charged to `noCloudBase` only
because that was the first test in order. Do not tune the base to chase
them.

### Next work, in order

1. Set `CEILING_FT = 18000` as the sole height limit; remove the AGL
   cutoff from the target join. (Already 18000; the change is making it
   the only gate and dropping `SEEDABLE_BASE_FT` from `verdict`.)
2. Add the "X% of flares within Y km of the nearest fill" table to
   `score-season.mjs` + EVALUATION.md. Distances are already in the
   painted files (`near.<layer>.km`); no repaint needed. Season figure
   for the seeding opportunity today: 59.5% inside, 73.7% within 3 km,
   87.9% within 10 km.
3. Compute CCL server-side (TMP levels + `SPFH:2 m`), expose it on the
   column readout labelled as CCL — never as "cloud base" — and use it
   as the base height in `target.ts` where HRRR has no diagnosed base.
4. Read GOES ABI cloud top unfiltered as a measured cloud-presence gate;
   re-score the season and check the painted-area cost.
5. Optional: prototype top-anchored parcel base, validate against the
   balloon mornings, keep only if it beats CCL.

Repaint `eval/out/` and reprint EVALUATION.md after 3-4.
