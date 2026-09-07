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

1. The Texas tests already on `CandidatePoint.target` — base in the
   4,000–12,000 ft AGL window, echo top at or above freezing in the
   neighborhood, rain in that neighborhood.
2. Supercooled liquid, base, top, reflectivity, and observed phase as
   readings. Rain is "the radar sees rain here," not "raining itself
   out."

`StormHere` stays the object: inside, flank, heading, age, growth,
echo top past freezing, liquid over the storm.

**Tests.** `CloudHere.test.tsx` for each `TargetVerdict`, and that a
raining cell is not captioned as ruled out of a sortie. Existing
phase and coverage distinctions stay.

## 4. Cloud base as the Comptroller window

The 4,000–12,000 ft AGL window is drawn as its own fill, nationally, not
as a Texas-only mask. MSL would move the window with the ground; AGL is
what transfers from the Gulf coast to high terrain.

The existing height ramp stays a switch. Nothing new gates the storm
off the map.

**Tests.** AGL versus the named `BASE_WINDOW_FT` constants, not
literals. A column in the window outside Texas still draws.

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
