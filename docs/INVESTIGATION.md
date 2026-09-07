# Investigation — what to build so this map is a tool Texas operators can fly with

The 2025 evaluation showed the candidate field and the five licensed Texas
programs select different clouds. This file is the plan that follows from
that, not a re-run of the August 2026 snapshot that found the layers unjoined.
The join exists. Cloud base exists. The band is in the right place. The miss
is the question the map asks.

Two jobs, in order:

1. **Replicate the decision loop Texas operators already run**, using the free
   national feeds this app already reads.
2. **Draw the things TITAN cannot**, so the map is worth opening next to the
   tool they already have.

Neither job is "put the opportunity contour on the flares." Flare locations are
where crews flew. They are not ground truth of seedability.

`WEATHERMAN.md` says what the app claims today. `MEASUREMENTS.md` says what a
new layer is allowed to claim. `EVALUATION.md` is the 2025 score against every
located release. This file argues what to change.

---

## 0. Terms

| Term | Definition |
| --- | --- |
| **Glaciogenic seeding** | Silver iodide (AgI) into supercooled liquid, so ice forms and the Wegener–Bergeron–Findeisen process can grow precipitation. |
| **Hygroscopic seeding** | Salt (NaCl) into the warm part of a cloud, so droplets grow by coalescence. Out of scope for the candidate field; present in the logs. |
| **Seeding band** | −5 °C to −18 °C. Warm edge is physics (AgI barely nucleates above it). Cold edge is a judgment about supply. |
| **Supercooled liquid water (SLW)** | Liquid colder than 0 °C. The only substance glaciogenic seeding acts on. Nothing free and national measures it in the vertical. |
| **TITAN** | Thunderstorm Identification, Tracking, Analysis, and Nowcasting (Dixon and Wiener, 1993). NCAR radar-object software. Mandatory on Texas Weather Modification Association projects since 1999. |
| **Cell** | A contiguous radar storm TITAN (or an analogue) has given an identity, a track, and a set of attributes. |
| **Turret / feeder** | A growing convective tower, usually on the flank of a cell that already has a raining core. The Texas target. |
| **Inflow** | Cloud-base updraft that carries flare material into the tower. Pilots report it as climb rate, in ft/min. |
| **First half-lifetime** | Operational rule: seed while the cell is still growing. A mature, quasi-steady storm is treated as too old. |
| **MRMS** | NOAA's 1 km / ~2 min national radar mosaic, already ingested here. |
| **HRRR** | NOAA's 3 km hourly convection-allowing model, already ingested here. |
| **GOES-19 ABI** | 2 km / 5 min geostationary cloud-top products, already ingested here. |
| **GLM** | Geostationary Lightning Mapper. On the same GOES bucket. Not ingested. |
| **TDLR** | Texas Department of Licensing and Regulation. Licenses the programs and excludes severe storms under permit. |

**The seven criteria (C1–C7)** from the system design remain the physics
yardstick. They are not the operator's checklist. Texas practice maps onto them
unevenly, which is the point of §2.

| | Criterion | Physical variable |
| --- | --- | --- |
| **C1** | A cloud is present *and growing* | presence; convective vigour; growth rate; lightning onset |
| **C2** | The cloud is deep enough | cloud-base height and cloud-top height → depth |
| **C3** | The supercooled temperature window exists in-cloud | temperature profile → isotherm heights |
| **C4** | That window holds **liquid**, not ice | phase as a function of height |
| **C5** | There is enough liquid to be worth it | liquid water path |
| **C6** | It isn't already raining itself out | precipitation aloft and at the surface |
| **C7** | It's reachable and safe to fly | cloud motion; winds; electrification; ceiling |

---

## 1. What the 2025 season established

Four programs that brief a balloon put the seeding band where we draw it:
median overlap 95.3–97.7%, edge biases within 70 m of zero. Finding 3 is not
"the layer is in the wrong sky."

At native sampling, inside the contour after storm-motion drift:

| Program | Cloud base | Cloud tops | Radar | Supercooled liquid | Seeding opportunity |
| --- | ---: | ---: | ---: | ---: | ---: |
| West Texas | 69.4% | 1.4% | 60.8% | 6.4% | 2.8% |
| South Texas | 75.9% | 4.2% | 28.9% | 2.6% | 2.9% |
| Trans-Pecos | 76.6% | 2.8% | 68.4% | 5.5% | 1.3% |
| Rolling Plains | 77.4% | 5.9% | 40.4% | 11.3% | 6.3% |
| Panhandle | 73.3% | 1.2% | 53.7% | 10.9% | 3.1% |

West Texas, 497 located flares, both bounding hours: liquid in both 17 (3.5%);
seedable ignoring rain, same 17; seedable including rain, **0**. Those 17 sit at
15–49 dBZ, median 35. The product rules out at 20 dBZ.

Two disagreements, different verdicts:

- **Rain.** The product is right that they are raining. They seed the flank of
  that storm on purpose. This is a product finding.
- **Liquid.** 355 of 492 West Texas flares had none at either hour. Nothing in
  the Texas record measures SLW in the band, so neither side is proven.

Located West Texas payloads are almost all silver iodide (442 AgI-only, 11
NaCl-only, 44 both). The miss is not salt.

`EVALUATION.md` already names the first product change: report rain instead of
disqualifying on it. That is necessary and not sufficient. A map that still
asks "is this 3 km column quiet SLW" will still miss the turret even after the
veto is lifted.

---

## 2. What Texas operators actually run

This is the state of the art in Texas, not an inference from the flares.

### 2.1 The loop on an operational day

A licensed meteorologist and one or two aircraft. The West Texas reports are
the worked example; the other four programs are the same shape.

1. **Morning briefing.** The 12Z Midland and Del Rio soundings: freezing level,
   −15 °C height, precipitable water, CAPE, LCL, CIN, CCL, lifted index, cloud
   base, cloud-base temperature, warm-cloud depth, 700 mb temperature, and an
   Index of Coalescence Activity. The Panhandle briefs a NAM column instead of
   a balloon.
2. **Watch.** TITAN on a project C-band (historically WSR-74C) and on NEXRAD.
   Cells get numeric IDs. The daily log is written in those IDs — `158/262 →
   158/297` — not in lat/lon of liquid.
3. **Select.** Convective, still growing, first half of the cell's lifetime,
   bases in the 4,000–12,000 ft window the state publishes, depth past the
   freezing level, enough cloud-base inflow to carry material, not severe
   (TDLR permit). Glaciogenic targeting looks for a reflectivity core at or
   above the freezing level; hygroscopic targeting looks at warm-cloud depth
   and the coalescence index.
4. **Direct.** The meteorologist talks the pilot onto the inflow. The aircraft
   reports climb rate in ft/min and pressure altitude, timed to the minute,
   next to a TITAN cell ID. That is how they know they are in the updraft.
5. **Seed.** Wing-mounted or ejectable flares, almost always AgI, sometimes
   NaCl on the same pass. Timing and targeting of *young* thunderstorms are
   the two factors the state's own description names.
6. **Evaluate.** TITAN matches seeded cells to unseeded controls on lifetime,
   area, volume, top, max reflectivity, precipitation flux, and precipitation
   mass. That archive is how Texas claims an effect. It is not how this app
   scores a day.

TWMA made TITAN mandatory across local projects in 1999 (Bates and
Ruiz-Columbie, 2002). It is still what the 2025 daily reports reboot when the
feed drops, and still what the annual evaluations are written in.

A 2004 TWMA / Oklahoma Water Resources Board / Weather Decision Technologies
system (HDSS) added the NEXRAD-native products that sit next to TITAN:
**reflectivity on constant-temperature surfaces**, time–height of reflectivity
inside a storm, and quantitative precipitation estimates. That is the closest
published "decision support" analogue to what this app is trying to be.

### 2.2 What they select on, in their words

The Texas Comptroller's published description, which `WEATHERMAN.md` already
cites: April–September, convective clouds, **cloud bases 4,000–12,000 ft**,
vertical depth past the freezing level, sufficient cloud-base inflow.

Operational papers and TWMA briefings add:

- Seed in the **early stages** — first half-lifetime. Mature quasi-steady
  storms are too old.
- Release AgI at **cloud base into the updraft**, or from cloud top at
  **−5 to −10 °C**.
- Glaciogenic cue: a reflectivity core **at or above the freezing level**.
- Hygroscopic cue: warm-cloud depth, cloud-base height, Index of Coalescence
  Activity.
- Severe weather is a **suspension**, not a target.

That is C1 (growing), C2 (base and depth), C3 (band exists in-cloud), C7
(inflow, not severe), with C6 inverted: rain in the core is how they *find*
the flank, not how they cross the cell off.

C4 and C5 — liquid in the band, and enough of it — are assumed from the
convective appearance and the sounding, not measured. That is why a map that
gates on HRRR SLW ≥ 10 g/m² and radar < 20 dBZ is answering a different
question, even when every number it draws is honest.

### 2.3 What they do not run

They do not integrate HRRR cloud water through −5 to −18 °C and fly to that
contour. HRRR is free. They have meteorologists. The 2025 overlap is not a
tools gap.

They also do not need this app to reimplement TITAN against their own C-band.
They already have that. A clone that draws the same cells worse is not a
product.

---

## 3. What Weatherman is today

A national candidate map of **static columns**. Per 3 km HRRR cell, at the
analysis hour:

- SLW in the band ≥ 10 g/m² (modeled)
- cloud base exists and sits below the band's cold edge (modeled)
- GOES top at or colder than −5 °C (observed geometry, modeled temperature)
- MRMS < 20 dBZ, or no coverage (measured)

Rejections partition in that order. Rain is last, which is why the
between-hours table's first two rows are identical and the third is zero.

Also built, and not used as a selection:

- Cloud-base height as its own map, 4,000–12,000 ft **reported in the summary
  and drawn nowhere**.
- GOES cloud-top phase as an outline, never a test.
- Mixed-layer CAPE, storm motion, vertically integrated liquid, echo top —
  **attributes on a clicked point**, nothing gates on them.
- Storm motion used in the evaluation to drift flares; not drawn as a nowcast
  of a cell.
- Replay of every layer at a past hour, which is how the 2025 season was
  scored.

Honest against `MEASUREMENTS.md`. Wrong object for a Texas sortie. The
operator asks "which turret, is it still growing, where is the inflow." The
map answers "which 3 km column has quiet modeled liquid."

C3 is solved and checked. C6 is measured and applied as a veto they do not
use. C2 is half-built (base is drawn, depth and the Texas window are not a
selection). C1 and C7 are missing. C4 and C5 remain simulation.

---

## 4. The pivot

**Keep the physics. Change the object.**

Silver iodide still only acts on supercooled liquid. Radar still cannot see
that liquid. Those sentences do not move. What moves is the thing on the map
an operator is asked to look at: from a quiet-SLW contour to a **convective
cell with a growing flank**, with rain as context, and with SLW as a second
opinion on that cell rather than the mask that hides it.

Two products, not one verdict:

| Product | Question | Today | After the pivot |
| --- | --- | --- | --- |
| **Target** | Which cell, which flank, is it still growing, can we reach the base? | Not asked | The map an operator flies |
| **Liquid check** | Does the model put SLW in the band over that cell? | The mask | A reading on the selected cell |

The evaluation already computes the liquid check with rain ignored.
That number stays. It stops being the thing that empties the candidate
layer.

What we will not do:

- Retarget the opportunity contour onto 2025 flare locations. That replays
  sorties. It does not check seedability.
- Embed or wrap TITAN/LROSE. Different stack, 3D volume scans we do not
  ingest, a tool they already run.
- Gate on a new threshold because it raises overlap with flares. A threshold
  still needs a citation (`MEASUREMENTS.md` §6).
- Promote hygroscopic seeding to a first-class field before warm-cloud depth
  is a produced layer. Salt is ~2% of located West Texas flares.
- Contour a quantity whose correlation length is shorter than the sample
  (`MEASUREMENTS.md` §3). Growth rate from one GOES scene is not a surface.
  Lightning is points.

---

## 5. Options

Ranked by how much each closes the Texas gap, whether it is honest under
`MEASUREMENTS.md`, whether the data is already in the building, and whether
the 2025 season can score it. Cost is in new sources and new objects, not in
lines of code.

### Option 1 — Stop vetoing rain

**No new data. Product change.**

The join keeps every other test. Rain becomes a layer and a readout, not a
reason a cell holding liquid is deleted. The candidate field with rain ignored
is the "cloudReady" row of the between-hours table: 17 of 492 West Texas
flares at both hours, still a small number, but no longer zero by construction.

Native 1 km radar can already tell a raining core from quiet ground next to
it. The 3 km join currently cannot use that, because a cell with 35 dBZ
somewhere in it fails. Lifting the veto is the first step; **drawing the
flank as its own geometry** is Option 6.

Test: recompute Finding 2 with rain ignored as the primary opportunity
number, and keep the raining number next to it.

This is the change `EVALUATION.md` already argues for. It is not the pivot
by itself.

### Option 2 — Storm objects from the MRMS mosaic

**The TITAN-shaped gap. Uses a source we already ingest.**

Identify contiguous ≥20 dBZ regions on the 1 km / 2 min mosaic, give them an
identity that persists across scans, and draw each as a polygon with a track
and a nowcast. Attributes a Texas log already prints: area, max reflectivity,
lifetime so far, motion.

This is a 2D analogue, not TITAN. TITAN is built on 3D volume scans and
reports volume, echo-top of the maximum, volume above 6 km, precipitation
flux and mass. The mosaic we ingest is a composite. Claiming those 3D
quantities from it would be invention.

What the analogue still gives, and what the column map cannot:

- A thing with a name, the way `158/262` is a thing.
- A lifetime, so "first half" is a number instead of a judgment with no
  display.
- A predicted position from the track (and from HRRR 0–6 km storm motion as
  a second vector, already computed in the evaluation).
- A core that can be distinguished from ground next to it.

Sampling: objects, not a field. The polygon is the set of mosaic pixels that
belonged to the cluster. Nothing is interpolated between cells.

Optional later, and only after `MEASUREMENTS.md` is updated: MRMS also
publishes national echo-top and VIL products. Those would be a measured
substitute for the HRRR `RETOP` / VIL attributes the point readout already
prints as model opinion. They are a new decode, not a new physical claim, if
the product is the thing it says it is.

Test: for each 2025 flare, which object was it in or next to, how old was
that object, what was its max dBZ, and how far was the flare from the 20 dBZ
edge toward quiet air. Radar-inside is already 60.8% in West Texas and 68.4%
in Trans-Pecos; this asks whether those releases sit on *young* cells, which
is the operational rule the column map cannot see.

### Option 3 — Flanks: quiet inflow next to a raining core

**Visualization they fly, and that TITAN does not draw as a mask.**

Once cells are objects, the target is not the 35 dBZ core. It is the
adjacent cloud with inflow. Draw a buffer of non-echo (or weak echo) on the
inflow side of each cell — storm-motion upwind, which the evaluation already
carries as a vector — and treat that as the working area.

Honest limits: we do not measure inflow. Pilots do, with the aircraft. The
map can say "this is the upwind quiet side of a live cell." It cannot say
"800 ft/min here." Labeling a climb rate from HRRR vertical velocity at 3 km
hourly would be a modeled hint, and it must be labeled as one.

This is the geometry that makes Option 1 operationally real. Lifting the veto
without flanks just draws the core they already see on TITAN.

Test: distance from each flare to the upwind quiet side versus to the
reflectivity maximum. If crews work flanks, the first distance is the one
that should collapse.

### Option 4 — Isotherm-relative reflectivity

**The HDSS analogue. The glaciogenic cue, as a picture.**

TWMA briefings: for glaciogenic seeding, look for a core of higher
reflectivity **at or above the freezing level**. HDSS built that as
reflectivity on constant-temperature surfaces.

We have the temperature profile (HRRR, checked against the balloons they
brief) and we have reflectivity (MRMS). A layer that says "echo at the
freezing level" / "echo at −5 °C" is those two, sampled onto the 3 km
column, **labeled as model height × measured reflectivity**. It is not a
volume scan. It is closer to the operational cue than composite dBZ, and it
is something TITAN-on-C-band does not automatically join to today's sounding.

The freezing level and −15 °C height are the two numbers Finding 1 already
trusts.

Test: on days crews seeded, is there echo at or above the freezing level
over the cell they worked? The reports already print cell max dBZ and echo
top; this asks the same question on our feeds.

### Option 5 — Growth, as a difference, not a surface

**C1. Data available, unused.**

The map still cannot tell whether a cloud is growing. `WEATHERMAN.md` already
says so. Two free signals, both points or object attributes, never contoured
into a field:

- **Successive GOES cloud-top scenes** (5 min, already ingested one at a
  time and discarded). Height or area increase on a tracked cell is a growth
  rate on that object.
- **GLM flashes** on the same bucket, 20-second granules. Lightning onset is
  vigour and a C7 no-go. Drawn as markers where the flashes were.

A turret that has just frozen and one that froze an hour ago still look the
same in a single phase scene. Differencing is what breaks that.

Test: of 2025 seeded cells, what fraction were still increasing in GOES-top
area or height at the flare minute, and what fraction already had GLM. The
operational claim is first half-lifetime; this is the first time that claim
is checkable on our side.

### Option 6 — The morning briefing as a map

**They already compute these numbers. We can grid them.**

CAPE, CIN, LCL, freezing level, −15 °C height, cloud base, and warm-cloud
depth (freezing level minus cloud base) are in every West Texas report and
in HRRR `wrfsfc` / the profile grid. Today they are a clicked-point readout
or a balloon table. As a map they are the 12Z decision, statewide, at 3 km,
an hour after the balloon.

Warm-cloud depth is the hygroscopic number we currently refuse to produce.
Producing it as **depth, labeled as such**, is not promoting salt to a
candidate field. It is giving the briefing back as geography. South Texas
Finding 3 already needs this sentence: a deep warm cloud can be enormous
and hold very little water in the band we measure.

The 4,000–12,000 ft base window is cited, reported, and not drawn, because
the figure is about Texas convective cloud and the grid is CONUS, and because
MSL and AGL disagree over high terrain (`diagnostics.ts`). Drawing it as a
**filter over the five permit boxes**, in AGL, is a different claim from
banding the national layer on it. That is the honest version of the Texas
gate.

Test: on flying days, does the modeled 12Z column at KMAF / KDRT match the
table they printed, the way Finding 1 already matches the two isotherms?
CAPE, LCL, and warm-cloud depth are the rows that are still unchecked.

### Option 7 — SLW as a second opinion on the selected cell

**The visualization TITAN cannot show. The thing this app uniquely has.**

Do not hide cells that fail 10 g/m². Do print, on the selected object: HRRR
liquid in the band, GOES top temperature, GOES top phase, and whether the
band sits between base and top. Amber-with-no-green becomes a reading ("the
model sees no liquid here") instead of an empty map.

This is also the honest use of C4/C5 without a ground station. The evaluation
cannot confirm the number. The operator can disagree with it in real time,
which is a more useful posture than a mask that erased 93.6% of West Texas
releases.

Test: the liquid-inside rate stays the diagnostic it is today (6.4% West
Texas, 2.6–11.3% across programs). It stops being a shipping criterion
for the targeting map. Days where the typical release *was* inside liquid
(one West Texas day of 34) are the days to put in front of an operator
first.

### Option 8 — Replay as after-action on cells and flares

**Unique to this repo. TITAN already has the radar half.**

The 2025 season is parsed: every located flare, payload, minute, and (for
West Texas and Trans-Pecos) coordinates. Replay already rebuilds every layer
at that hour. What it does not do is show **this flare on this cell, with
this climb-rate call, against this model column**.

That is the briefing tool a program could use the next morning, and the
publication figure for Finding 2 that is not a table. It is also how Option
2–5 get developed: look at a scored day, look at the objects, see whether
the flank geometry matches the radio log.

No new physics. The eval app is the prototype. The operator app should be
able to do the same thing without a second codebase.

### Option 9 — Reachability and safety on the cell

**C7, mostly no new data.**

Band base versus the 18,000 ft ceiling is already computed and not flagged.
Storm motion is already computed. GLM is Option 5. TDLR severe-weather
suspension is watches and warnings, which we do not ingest; until we do, the
honest C7 is: can the aircraft reach the base, where is the cell going, and
is there lightning.

A ceiling check that fires in July over Texas is correct output, not a bug.
`WEATHERMAN.md` already says a band above the ceiling is a real airmass.

### Option 10 — The ground station, unchanged

Nothing in this pivot measures SLW in the vertical. Radar still cannot.
Satellite still sees the top. CIP still has no public API. The station
(depolarisation lidar + microwave radiometer + ceilometer) is still the only
way C4 inside the cloud becomes a measurement, and still the only local
skill estimate for HRRR CLWMR.

The map's job, with or without the pivot, is to say where to tow it. The
pivot changes the thing we tow it toward: a growing cell, not a quiet-SLW
blob. A season of co-located station readings against HRRR at flare time is
the first way Finding 3's liquid miss becomes diagnosable rather than
named.

---

## 6. Recommended sequence

Do these in order. Each step is shippable without the next, and each is
scored against the 2025 comparison days that already exist.

1. **Option 1 + 7.** Rain is drawn, not a veto. SLW is a reading on a point
   (and later a cell), not the thing that empties the map. This is the
   product pivot with no new objects. Finding 2's tables get a rain-ignored
   primary number.
2. **Option 2.** MRMS storm objects with identity, track, lifetime, max dBZ,
   motion. This is the SOTA replication we can honestly do from feeds we
   have. The candidate map's default layer becomes cells, not opportunity.
3. **Option 3 + 4.** Flanks from storm-motion upwind, and reflectivity on the
   freezing / −5 °C surfaces. This is the targeting picture: where to put
   the aircraft, and whether the glaciogenic cue is present.
4. **Option 6.** Briefing fields as a map over the permit boxes, including
   warm-cloud depth as depth. Closes the morning loop they already run on
   two points.
5. **Option 5 + 9.** GOES differencing and GLM on the tracked cell;
   ceiling and lightning as safety. This is C1 and C7.
6. **Option 8.** Operator replay of cells + flares, so the eval app is not
   the only place a day can be looked at.
7. **Option 10** when there is a station. Not a substitute for 1–6.

What waits, and why:

- Hygroscopic candidate logic — warm-cloud depth must exist as a layer
  first, and salt is rare in the 2025 log.
- MRMS 18 dBZ echo-top is now a reading on the storm click, compared to
  modeled freezing. It is not a map fill. VIL and the 33-level cube
  (storm volume, height of the maximum) still wait. Score the 216
  flares for measured top past freezing before coloring anything.
- Aircraft telemetry live — they have it; we would need a feed, not a
  cleverer use of HRRR.
- A cold cutoff on cloud-top temperature — still no citation, and a −60 °C
  anvil over a growing feeder is the layered case the phase outline is for.

### The first increment — a second join, not a retuned mask

Step 1 of the sequence is a **second join**, not "stop vetoing rain" on the
existing opportunity field. The opportunity join stays. Rain still vetoes
it. Supercooled liquid still gates it. The Texas question is asked beside
it, of the same 3 km cell, and scored before anything is painted.

The tests, in order, each cited:

1. **Cloud base exists.** HRRR `HGT:cloud base`.
2. **Base in 4,000–12,000 ft AGL.** The Comptroller window, already in
   `BASE_WINDOW_FT`, applied above the terrain rather than as MSL. MSL
   would move the window with the ground; AGL is what transfers across
   South Texas and Trans-Pecos.
3. **Echo top at or above the freezing level**, in this cell or an
   8-connected 3 km neighbor. Freezing height is `isothermFieldFt(profile,
   0)`, the same function Finding 1 already trusts. Echo top is HRRR
   `RETOP` — modeled height, labeled as such, not a volume scan. The
   aircraft is not under the cold GOES top, so cloud-top temperature at
   this cell is not this test.
4. **Measured echo at 20 dBZ** in that same neighborhood. `RAIN_DBZ`, the
   lowest contour we already draw. South Texas's typical release sits
   1.4 km outside 20 dBZ, which is inside one HRRR cell. The neighborhood
   is the grid's own spacing, not a radius chosen to swallow the 23 km
   cloud-top miss.

Rain in this cell is not a reject. Supercooled liquid is not a test. GOES
top temperature and phase stay readings.

The neighborhood does not wrap. A cell on the domain edge has fewer
neighbors; it does not see the opposite side of the country.

`paint.mjs` scores each located flare against the radar storm at the
analysis it is charged to. A high flare-inside rate with target area
covering most of the box has not worked.

What this still cannot ask — remaining hypotheses if 2025 still misses,
not a looser window: growth and first half-lifetime, inflow in ft/min,
upwind flank versus core, TDLR severe-weather suspension.

---

## 7. How we will know it worked

The test is not "overlap with flares went up." Flares are a biased sample of
days someone already decided to fly. The tests are:

| Claim | Test against 2025 |
| --- | --- |
| We select the same *storms* | Share of flares that fall in or on the upwind flank of a live object |
| We select them at the same *stage* | Lifetime percentile of the object at the flare minute (first half vs last) |
| We are looking at the *flank*, not the core | Distance to upwind quiet side vs distance to max dBZ |
| The glaciogenic cue is present | Echo at or above the freezing level on that object |
| The briefing is the same briefing | Model 12Z column vs the printed sounding table, past the two isotherms |
| Growth is real | GOES-top area/height change sign at the flare minute |
| Liquid remains an open check | SLW-inside rate, still reported, no longer a ship gate |
| Rain is no longer a silent veto | Opportunity-with-rain-ignored is the headline; raining share is next to it |

A change that raises flare overlap by drawing every echo in Texas, or by
dropping the liquid reading, has not worked. It has hidden the disagreement
the evaluation found.

---

## 8. Coverage against C1–C7 after this sequence

| | Criterion | Today | After the sequence |
| --- | --- | --- | --- |
| **C1** | present and growing | Presence (GOES). Growing absent. | Growth as an attribute on a tracked cell (GOES difference, GLM). Still not a national surface. |
| **C2** | deep enough | Base drawn; depth at a click; Texas window reported. | Base window as a permit-box filter; depth and warm-cloud depth as maps. |
| **C3** | band exists | Complete, balloon-checked. | Unchanged. Used to place reflectivity on isotherms. |
| **C4** | window holds liquid | Simulated; GOES phase at the top only. | Still simulated. Shown on the cell instead of used as a mask. Station still required to measure it. |
| **C5** | enough liquid | Simulated, 10 g/m² gate. | Same field, not a gate. |
| **C6** | not already raining | Measured and applied as a veto they do not use. | Measured and drawn as core vs flank. Not a silent delete. |
| **C7** | reachable and safe | Storm motion computed, not shown; no lightning; ceiling unflagged. | Nowcast on the cell, GLM as points, ceiling against band base. Severe-weather watches still absent. |

The honest summary today: **C3 is solved, C6 is measured and misapplied, C2
is half-built, C4/C5 are simulated and over-gated, C1 and C7 are missing.**

The honest summary after the sequence: **the map selects the same kind of
object a Texas meteorologist selects, and then tells them what the model and
the satellite think is inside it.** That is a tool. It is still not a
verdict on supercooled liquid, and it must not pretend to be.

---

## References

**Texas operations and TITAN**

- Dixon, M. and Wiener, G. (1993). *TITAN: Thunderstorm Identification, Tracking, Analysis, and Nowcasting.* J. Atmos. Oceanic Technol. 10, 785. https://journals.ametsoc.org/view/journals/atot/10/6/1520-0426_1993_010_0785_ttitaa_2_0_co_2.xml
- Bates, R. and Ruiz-Columbie, A. (2002). *Weather Modification Scientific Management in Texas.* J. Wea. Mod. https://journalofweathermodification.scholasticahq.com/
- Woodley, W. L. and Rosenfeld, D. (2004). *The Development and Testing of a New Method to Evaluate the Operational Cloud-Seeding Programs in Texas.* J. Appl. Meteor. 43, 249. https://journals.ametsoc.org/view/journals/apme/43/2/1520-0450_2004_043_0249_tdatoa_2.0.co_2.xml
- Johnson, J. T. et al. (2004). *A hydrometeorological decision support system to support weather modification operations in Texas and Oklahoma.* 14th Conf. on Planned and Inadvertent Weather Modification, AMS. https://ams.confex.com/ams/pdfpapers/88272.pdf
- Texas Comptroller of Public Accounts (2022). *Seeding Snap.* https://comptroller.texas.gov/economy/economic-data/water/2022/seeding-snap.php
- Texas Department of Licensing and Regulation — Weather Modification. https://www.tdlr.texas.gov/weather/summary.htm
- Texas Department of Licensing and Regulation. *Weather Modification Knowledge Base.* https://www.tdlr.texas.gov/weather/weatherfaq.htm
- West Texas Weather Modification Association — Operations and TITAN evaluations. https://westtxwxmod.com/

**Seeding physics and AgI**

- Marcolli, C. et al. (2016). *Ice nucleation efficiency of AgI: review and new insights.* Atmos. Chem. Phys. 16, 8915. https://acp.copernicus.org/articles/16/8915/2016/acp-16-8915-2016.pdf
- *Quantified ice-nucleating ability of AgI-containing seeding particles in natural clouds.* Atmos. Chem. Phys. 25, 5387 (2025). https://acp.copernicus.org/articles/25/5387/2025/

**Seeding field experiments (orographic, different regime)**

- French, J. R. et al. (2018). *Precipitation formation from orographic cloud seeding.* PNAS. https://www.pnas.org/doi/abs/10.1073/pnas.1716995115
- Friedrich, K. et al. (2020). *Quantifying snowfall from orographic cloud seeding.* PNAS. https://www.pnas.org/doi/10.1073/pnas.1917204117
- Tessendorf, S. A. et al. (2019). *A Transformational Approach to Winter Orographic Weather Modification Research: The SNOWIE Project.* Bull. Amer. Meteor. Soc. 100(1).
- Rasmussen, R. M. et al. (2021). *Potential for Ground-Based Glaciogenic Cloud Seeding over Mountains in the Interior Western United States.* J. Appl. Meteor. Climatol. 60(9).

**Icing / operational fusion**

- Bernstein, B. C. et al. (2005). *Current Icing Potential: Algorithm Description and Comparison with Aircraft Observations.* J. Appl. Meteor. 44, 969.

**In-repo**

- `WEATHERMAN.md` — what the app claims
- `MEASUREMENTS.md` — physics and sampling limits on any new layer
- `EVALUATION.md` — 2025 score against every located release
- `/home/nathan/code/rainmaker/weatherman/docs/SENSING_STRATEGY.md` — C1–C7
- `/home/nathan/code/rainmaker/docs/DRONE_DESIGN.md` — R2 service ceiling
