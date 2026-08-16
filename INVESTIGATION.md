# Investigation — how close is this app to pinpointing cloud-seeding zones?

An assessment of the current map against the physical criteria for seedability
and against the published literature on where seedable cloud actually lives.
Measured against a live snapshot on **2026-08-13, 05:00–05:20 UTC**, driving the
running server directly.

---

## 0. Terms

Defined here once, then used freely.

| Term                                         | Definition                                                                                                                                                                                                                               |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Cloud seeding (glaciogenic)**              | Introducing an ice-forming particle into a cloud that already holds liquid water colder than 0 °C, so that ice forms and grows into precipitation.                                                                                       |
| **AgI**                                      | Silver iodide. The seeding particle. Its crystal lattice resembles ice, so it acts as a template for freezing.                                                                                                                           |
| **Supercooled liquid water (SLW)**           | Liquid water droplets at a temperature below 0 °C. Liquid persists below freezing because a droplet needs a nucleus to freeze onto. This is the only substance seeding acts on.                                                          |
| **Wegener–Bergeron–Findeisen (WBF) process** | Once ice exists alongside supercooled droplets, the ice grows at the droplets' expense (ice has a lower saturation vapour pressure than liquid at the same temperature). This is the mechanism that turns seeded ice into precipitation. |
| **Glaciated**                                | A cloud whose water has already turned to ice. Seeding does nothing here — there is no liquid left to convert.                                                                                                                           |
| **Seeding band**                             | The temperature window where seeding works: cold enough for AgI to nucleate ice, warm enough that liquid still exists. This app uses **−5 °C to −18 °C**.                                                                                |
| **Isotherm**                                 | A surface of constant temperature. The "−5 °C isotherm height" is the altitude at which the air is −5 °C.                                                                                                                                |
| **Liquid water path (LWP)**                  | Liquid water in a vertical column, per unit ground area, in grams per square metre (g/m²). A column integral, not a concentration.                                                                                                       |
| **HRRR**                                     | High-Resolution Rapid Refresh — NOAA's 3 km weather model over the continental United States, rerun hourly. A _simulation_.                                                                                                              |
| **CLWMR**                                    | HRRR's cloud water mixing ratio: grams of cloud _liquid_ per kilogram of air, at each of ~40 pressure levels. Separate from the model's ice, snow and graupel variables.                                                                 |
| **GOES-East / GOES-19**                      | NOAA's geostationary weather satellite covering the eastern US, parked over the equator.                                                                                                                                                 |
| **ABI**                                      | Advanced Baseline Imager — the main camera on GOES. Scans the continental US every 5 minutes at ~2 km resolution.                                                                                                                        |
| **MRMS**                                     | Multi-Radar/Multi-Sensor — NOAA's national radar mosaic, stitched from the NEXRAD ground-radar network at 1 km, refreshed every ~2 minutes.                                                                                              |
| **NEXRAD**                                   | The US network of ~160 ground weather radars.                                                                                                                                                                                            |
| **dBZ**                                      | Decibels of radar reflectivity — a logarithmic measure of how strongly a volume of air scatters radar. ~20 dBZ is light rain; 50 dBZ is a downpour.                                                                                      |
| **Reflectivity ∝ d⁶**                        | Radar return scales as the _sixth power_ of droplet diameter, so large raindrops dominate utterly and small cloud droplets are effectively invisible.                                                                                    |
| **mb (millibar)**                            | Pressure unit used as a vertical coordinate. Sea level is ~1013 mb; 500 mb is ~18,000 ft. Lower number = higher altitude.                                                                                                                |
| **MSL**                                      | Mean sea level — altitudes measured from the sea surface, not from the ground below.                                                                                                                                                     |
| **GRIB2 / NetCDF4**                          | Binary file formats for gridded weather data (GRIB2 for models, NetCDF4 for satellite products).                                                                                                                                         |
| **GeoJSON**                                  | A text format for map shapes. Every layer this app draws is GeoJSON polygons generated by our own server.                                                                                                                                |
| **Contouring / marching squares**            | Turning a grid of numbers into outlines enclosing everywhere above a threshold. Marching squares is the standard algorithm.                                                                                                              |
| **Nodata**                                   | The distinction between "measured, and the answer is nothing" and "not measured". An image has no nodata; a polygon layer does — where there is nothing, no polygon is drawn.                                                            |
| **PIREP**                                    | Pilot report — a voluntary radioed observation from an aircraft, e.g. of icing.                                                                                                                                                          |
| **CIP**                                      | Current Icing Product — the FAA/NCAR operational product that fuses model, satellite and radar into an aircraft-icing hazard field. The nearest operational analogue to what this app does.                                              |
| **ACTP / ACHA / CCL / GLM**                  | GOES-19 products: Cloud Top Phase, Cloud Top Height, Cloud Cover Layers, Geostationary Lightning Mapper.                                                                                                                                 |
| **TDLR**                                     | Texas Department of Licensing and Regulation — licenses and regulates Texas weather-modification operations.                                                                                                                             |

**The seven criteria (C1–C7)** come from the system design's `SENSING_STRATEGY.md`
and are the yardstick used throughout:

|        | Criterion                                          | Physical variable                                      |
| ------ | -------------------------------------------------- | ------------------------------------------------------ |
| **C1** | A cloud is present _and growing_                   | cloud fraction; convective vigour; lightning onset     |
| **C2** | The cloud is deep enough                           | cloud-**base** height and cloud-**top** height → depth |
| **C3** | The supercooled temperature window exists in-cloud | temperature profile → isotherm heights                 |
| **C4** | That window holds **liquid**, not ice              | cloud phase as a function of height                    |
| **C5** | There is enough liquid to be worth it              | liquid water path                                      |
| **C6** | It isn't already raining itself out                | precipitation aloft and at the surface                 |
| **C7** | It's reachable and safe to fly                     | cloud motion; winds; electrification                   |

---

## 1. Where we are

### 1.1 What the app computes today

Three layers on the candidate map, one on the forecast map, plus a point profile.
All are GeoJSON polygons generated server-side; no raster is drawn on either map.

| Layer                                      | Source                                                                            | Kind of claim                                   | Criterion    |
| ------------------------------------------ | --------------------------------------------------------------------------------- | ----------------------------------------------- | ------------ |
| Cloud-top temperature                      | GOES-19 ABI cloud-top **pressure**, converted to temperature using HRRR's profile | **observed** geometry, **modelled** temperature | C2 (partial) |
| Supercooled liquid water                   | HRRR CLWMR integrated over exactly the levels inside −5…−18 °C                    | **modelled**                                    | C3 ∧ C4 ∧ C5 |
| Radar reflectivity                         | MRMS national mosaic                                                              | **measured**                                    | C6           |
| Cloud cover / precipitation (forecast map) | HRRR                                                                              | **modelled**                                    | C1 (partial) |
| Point sounding                             | HRRR temperature and height profile                                               | **modelled**                                    | C3           |

### 1.2 Live snapshot, verified by driving the server

HRRR run `2026-08-13T04:00Z`, analysis hour f00.

**Cloud tops** (GOES scene valid `05:06Z`, temperatures from the `04:00Z` HRRR run):

```
cloudPct        52.41   % of the 12 km grid with any cloud
seedableTopPct  38.59   % whose top is at or colder than -5 C
seedableKm2  6,587,136  km2
coldestTopC     -68.8   C
```

**Radar** (MRMS scene valid `05:10Z`):

```
radarCoveragePct 67.16  % of the box any radar can see at all
echoPct           2.76  % of covered ground with >=20 dBZ
echoKm2        417,551  km2
peakDbz             50
```

**Supercooled liquid water** (HRRR f00):

```
coveragePct      2.94   % of CONUS with >=10 g/m2 in the band
seedableKm2   502,272   km2
peak             1406   g/m2
bandBaseMb        650   the -5 C level, domain-wide
bandTopMb         375   the -18 C level, domain-wide
```

Cold build of the liquid field: **32 s**. A point sounding against the already-warm
profile grid: **0.11 s**.

### 1.3 Coverage against C1–C7

|        | Criterion                   | Status                     | What actually exists                                                                                                                                                                                                      |
| ------ | --------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C1** | cloud present _and growing_ | **Partial**                | Presence and shape, yes (GOES). **"Growing" is entirely absent** — no time-differencing of successive scenes, no turret-growth rate, no lightning.                                                                        |
| **C2** | cloud deep enough           | **Partial, one-sided**     | Cloud **top** is observed and the −5 °C filter is applied. **Cloud base is not read at all**, so _depth_ is never computed. The app can say "the top is cold enough"; it cannot say "the band lies between base and top". |
| **C3** | temperature window exists   | **Complete**               | The strongest part of the app. Isotherm heights are derived per point per hour from HRRR, never assumed; below-ground extrapolation is handled; the lowest crossing is taken when an inversion crosses twice.             |
| **C4** | window holds liquid         | **Simulated only**         | HRRR CLWMR is liquid by construction (Thompson microphysics separates liquid from ice). But it is a model field. Nothing observed in the app constrains phase.                                                            |
| **C5** | enough liquid               | **Simulated only**         | The SLW path in g/m² is a genuine C5 quantity, banded at 10 / 50 / 150 / 400 g/m². Same caveat as C4.                                                                                                                     |
| **C6** | not already raining out     | **Measured, but unjoined** | MRMS is the one real measurement on the map. It is drawn as a separate layer; nothing subtracts it from the candidate area.                                                                                               |
| **C7** | reachable and safe          | **Absent**                 | No winds, no cloud-motion vector, no lightning, no ceiling check.                                                                                                                                                         |

**The honest summary: C3 is solved, C6 is measured but not applied, C2 is half-built,
C4 and C5 are simulated, and C1 and C7 are missing.**

---

## 2. The central finding: the layers are never joined

There is no code anywhere in `server/src/lib` that intersects, scores, or otherwise
combines the layers. Three GeoJSON layers are drawn on top of one another and **the
operator performs the fusion by eye.** There is no seedability field, no candidate
polygon, and no verdict — consistent with the design's own position that a national
map can show candidate volumes but not render a verdict.

### 2.1 What happens if you do join them

I rasterised the three live layers onto a 0.25° grid over the CONUS box
(lat 25–49 N, lon 125–67 W), area-weighted by cos(latitude), and intersected them.

One correctness note that materially changes the answer: **the cloud-top layer uses
disjoint bands, not nested ones.** The polygon labelled −5 °C contains only tops
between −5 and −12 °C. "Top at or colder than −5 °C" is the union of all four bands.
Taking the −5 band alone yields 2.63% instead of 40.42% — a 15-fold error, and the
kind a consumer of this API will make. My union reproduces the server's own
`seedableTopPct` to within the grid difference (40.42% vs 38.59%), which validates
the rasterisation.

```
cloud top <= -5 C  (observed, C2)        40.42 %
SLW >= 10 g/m2     (modelled, C4/C5)      3.41 %
echo >= 20 dBZ     (measured, C6)         2.89 %

top AND liquid                            3.01 %
top AND liquid AND no echo                2.23 %   <- all three criteria pass
```

Agreement between the independent sources:

```
share of SLW area sitting under a seedable top   88.3 %
SLW where the satellite sees no such top         11.7 %
share of candidates the radar knocks out         25.9 %
```

**Texas box** (lat 25.5–36.6, lon −106.7…−93.4), same instant:

```
top AND liquid                            0.25 % of Texas
top AND liquid AND no echo                0.13 % of Texas
```

Three things follow.

1. **The join is cheap and it works.** 19 seconds in unoptimised pure Python on
   coarse polygons; on the server's own 12 km grid, before contouring, it is an
   array operation over cells it has already computed. Nothing about this is hard.
2. **The two independent sources broadly agree.** A model field and a satellite
   observation, built from entirely different physics, put supercooled liquid under
   an observed cold top 88.3% of the time. The 11.7% disagreement is the interesting
   population, and the app currently gives the operator no way to see it. Per
   `MEASUREMENTS.md` §4, one known cause is that HRRR's cloud-top diagnostic reports
   a single deck rather than the highest, so genuine multi-layer cloud can carry
   in-band liquid above a reported top.
3. **The radar criterion has real teeth.** It removes a quarter of the candidate
   area — a substantial C6 filter that is currently applied only by eye.

### 2.2 The candidate area is small, and Texas is episodic

2.23% of the CONUS box passes all three tests right now, and 0.13% of Texas. The
main liquid mass tonight is over the Dakotas and Nebraska (largest blob centred near
44.9 N, 99.5 W), not Texas. This matches the standing measurement guidance: sampled
across a Texas year, 10 of 24 cases carried no meaningful supercooled liquid at all,
and daily reach swings from 14% to 83%. **A single snapshot cannot be generalised**,
and the numbers above are one hour's weather, not a climatology.

---

## 3. Where the seeding band actually is — and a problem it exposes

Sounding seven Texas points against the live HRRR analysis:

| Point          | Surface (ft) | 0 °C (ft) | **−5 °C (ft)** | −18 °C (ft) |
| -------------- | ------------ | --------- | -------------- | ----------- |
| Amarillo       | 3,627        | 16,427    | **19,589**     | 26,133      |
| Lubbock        | 3,255        | 16,576    | **19,654**     | 26,207      |
| San Angelo     | 1,871        | 16,853    | **19,583**     | 25,979      |
| San Antonio    | 646          | 17,124    | **19,526**     | 26,044      |
| Corpus Christi | 31           | 17,147    | **19,531**     | 25,719      |
| Dallas         | 492          | 17,286    | **19,868**     | 26,116      |
| El Paso        | 4,011        | 15,759    | **18,707**     | 25,915      |

All altitudes MSL. The band base sits at **18,700–19,900 ft across the whole state**,
and the top near 26,000 ft.

Two consequences:

- **The design document's "10,000–18,000 ft" figure does not describe this airmass.**
  `MEASUREMENTS.md` §4 already forbids gating anything on that range and requires
  altitude to be derived per point per hour. The code does exactly that. This
  snapshot is the concrete demonstration: in an August Texas airmass the _entire_
  seeding band is above 18,000 ft.
- **The band is above the drone's specified ceiling.** `DRONE_DESIGN.md` R2 sets a
  service ceiling of ≥18,000 ft MSL, justified as reaching the supercooled zone. At
  every Texas point sampled, the −5 °C level is 700–1,900 ft _above_ that ceiling.
  The app computes the number that reveals this and **does not flag it**. A
  reachability check against a configured ceiling is a small, high-value addition,
  and it is the one piece of C7 that needs no new data source.

For contrast, at the centre of tonight's liquid over South Dakota (44.85 N, 99.53 W)
the band runs 17,245–24,898 ft — its base _below_ the ceiling. The reachability
answer is regional and seasonal, which is precisely why it must be computed rather
than assumed.

---

## 4. Cross-reference with the literature

### 4.1 The temperature band

The app's −5 °C warm edge is well supported. AgI was identified as an efficient ice
nucleus by Vonnegut in 1947, and modern review work finds micron-scale AgI particles
freezing at around −4 °C, with AgI-containing seeding particles expected to initiate
nucleation at temperatures as high as −5 °C. The DeMott (1995) parameterisation used
in seeding models treats deposition nucleation as active colder than about −4.9 °C.
**−5 °C as a hard warm edge is a defensible physical threshold.**

The cold edge is a judgement, as the code says. Published seedability work puts the
suitable AgI window at roughly **−8 to −23 °C**; the app's −18 °C sits inside that
and is generous relative to the −12 °C the system design uses. There is no
literature basis for a _cloud-top_ cold cutoff, and the app correctly declines to
impose one.

### 4.2 The closest published analogue

Rasmussen et al. (2021, _JAMC_) computed a **seedability** field for the interior
western US — the fraction of time conditions suit ground-based seeding — from model
output, using criteria on **temperature, presence of supercooled liquid water, and
Froude number** (a dimensionless ratio of flow speed to terrain-induced buoyancy
forces, governing whether air flows over a mountain or is blocked by it).

This is the same construction as §2.1 above: a gridded, model-derived, multi-criterion
suitability field. **The literature's version produces a single scored field; ours
produces three separate layers and stops.** The gap between this app and published
practice is that final step, not the inputs.

### 4.3 The operational icing analogue

CIP (Bernstein et al. 2005) fuses model, satellite, radar and PIREPs into an icing
hazard field, and CIP/FIP v2.0 is now based on HRRR specifically for its improved
particle-phase and supercooled-liquid-water forecasts. This is direct external
validation of leaning on HRRR CLWMR for phase. CIP also demonstrates the fusion
architecture — a single field, satellite and radar constraining the model — which is
the shape of the missing piece here. CIP is not a substitute source: it has no
public API.

### 4.4 Where Texas operations actually seed

This is the sharpest divergence between the app and Texas practice, and it is
structural rather than a matter of thresholds.

Texas operations, per the state's own published description: **April 1 – September 30**,
targeting **convective clouds with cloud bases between 4,000 and 12,000 ft** that have
vertical depth extending beyond the freezing level with sufficient cloud-base inflow.
Reported seeding temperature at cloud top in Texas operational programmes has normally
been between **−5 and −10 °C**. TDLR rules exclude severe storms.

Against that:

- **Cloud base is the selection variable in Texas practice, and the app never reads it.**
  "Bases between 4,000 and 12,000 ft" is an operational gate the app cannot evaluate.
  This is the C2 hole, and it is load-bearing rather than cosmetic.
- **Texas seeds growing convective turrets, largely from cloud base into the updraft.**
  The app's model is a static column: is there liquid in the band right now, at this
  point. Convective vigour and turret growth — C1's "_and growing_" — are the
  selection criteria in practice, and the app has no measure of either. A layer
  answering "is there liquid in the band here" and an operator asking "which turret
  do I seed" are not the same question.
- The **−5 to −10 °C cloud-top** figure describes clouds that are seedable _targets_
  in convective practice. The app's cloud-top layer, filtered at −5 °C and open-ended
  cold, admits deep cirrus-topped systems on equal footing with a young turret.
  The disjoint bands preserve the distinction visually; nothing acts on it.

The published seeding-effect literature — SNOWIE, French et al. (2018) and Friedrich
et al. (2020) — quantified seeding in **winter orographic** cloud, where supercooled
liquid is persistent and the flow is terrain-locked. That is a different regime from
Texas summer convection, and it is where the strongest causal evidence sits. Nothing
in this app is orographic-aware, and the Froude-number term from §4.2 has no analogue
here.

---

## 5. What is missing

Ranked by how much each closes the gap to pinpointing zones.

### 5.1 The join (no new data required)

Intersect the layers the app already has into one candidate field: cloud top at or
colder than −5 °C **and** SLW ≥ threshold **and** no radar echo. Measured above at
2.23% of CONUS. Everything needed is in the services already, on a shared 12 km grid,
before contouring. This is the single largest step available and it costs no new
dependency, no new source, and no new physics.

### 5.2 Cloud base → real C2 (data available, unused)

Without cloud base, depth is never computed and the Texas operational gate cannot be
evaluated. Two free routes, both verified live:

- **`ABI-L2-CCLC`** (Cloud Cover Layers, CONUS) — cloud fractions in flight-level
  layers including SFC–FL050 and FL050–FL100. Present in the bucket at the same
  5-minute cadence.
- **`ABI-L2-ACHAC`** (Cloud Top Height) — a direct height, complementing the pressure
  product already used.

### 5.3 Observed cloud phase → the first real C4 constraint (verified in detail)

`ABI-L2-ACTPC` — **Cloud Top Phase** — carries an explicit supercooled-liquid class.
I downloaded and decoded tonight's scene with the `h5wasm` already installed in the
server:

```
file    OR_ABI-L2-ACTPC-M6_G19_s20262250401179_...nc   (666,570 bytes)
Phase   1500 x 2500, uint8
        flag_values   0 1 2 3 4 5
        flag_meanings clear_sky liquid_water super_cooled_liquid_water
                      mixed_phase ice unknown

class histogram, 3,750,000 pixels
  0 clear_sky                 39.33 %
  1 liquid_water              13.25 %
  2 super_cooled_liquid_water  2.07 %
  3 mixed_phase                1.57 %
  4 ice                       41.96 %
  5 unknown                    0.57 %
255 fill                       1.26 %
```

This is an **observed** phase discrimination, keyless, on the bucket the app already
reads, at the 2 km resolution and 5-minute cadence it already handles, on the ABI
fixed grid `abi.ts` already reprojects — and the file is **six times smaller** than
the 4.1 MB cloud-top-pressure scene currently ingested. No new dependency.

Its limitation is the same one that constrains every satellite product here and must
not be glossed: **it is cloud-top phase only.** It says the top of the cloud is
supercooled liquid; it says nothing about phase at the −5…−18 °C band inside. It is
a genuine observed constraint on C4, not a solution to C4. Note also that the 2.07%
supercooled-liquid-topped figure and the model's 2.94% SLW coverage are _different
quantities_ — a top classification versus a column integral — and should not be
compared as if they measured the same thing.

### 5.4 C1's "growing" and C7's safety (data available, unused)

**`GLM-L2-LCFA`** — Geostationary Lightning Mapper — is live on the same bucket at
20-second granules. Lightning onset is named in C1 as a convective-vigour signal and
in C7 as a go/no-go safety signal. It is a **point/event source**, not a field: per
the standing sampling rule it must be drawn as discrete markers where the flashes
were, never contoured into a surface.

Turret growth would come from differencing successive cloud-top scenes — the app
currently holds exactly one scene at a time and discards the previous one.

### 5.5 Reachability (no new data required)

A ceiling check against the derived band base, per §3. The app already computes the
altitude; nothing compares it to an aircraft limit.

### 5.6 What remains genuinely unavailable

Per `MEASUREMENTS.md` §2, and unchanged by this investigation: **nothing free and
national measures supercooled liquid water in the vertical.** Radar cannot see it —
reflectivity scales as diameter to the sixth power, so 10 µm cloud droplets are
invisible next to millimetre raindrops. Satellite sees the top only. CIP fuses but
publishes no API. Icing PIREPs confirm spot occurrences at roughly 20 positive
reports per 12 hours nationally. **With no ground station, C4 inside the cloud is
simulation, never measurement.** That is a limit of the available feeds, not of the
implementation.

### 5.7 Minor defect noted in passing

A batch of comments in `server/src/lib/services/forecast.ts` still describe the band
as −5…−12 °C where the code reads `SEEDING.coldestC` = **−18** (lines 91, 180, 286,
315, 819, 831, 897). Line 315 is on a public API field — `bandTopFt` is documented as
"Cold edge of the seeding band, −12 °C" and returns the −18 °C height. The behaviour
is correct; the documentation is stale, and it is stale on the type that consumers read.

### 5.8 Two ways the map and the panel came to disagree about a cell

Both were found by clicking the candidate map near Denver on 2026-08-16 and reading
answers that contradicted the ground under the cursor. Both are measurements against
the live server, not inference from the code.

**The outline and the readout were describing different builds.** The candidate
layers fetch their GeoJSON once and were never refreshed; the point route is answered
from whatever build the server holds when the click lands, and the join caches for
2 minutes over sources that roll every 2 to 5. Two fetches of `/candidate/field/confirmed`
nine minutes apart shared 42 of 63 polygons — 21 gone, 27 new. So a third of the
outline turns over inside ten minutes while the drawn copy stands still, which is how
a click inside the outline came back "the top of this cloud has already frozen."

**The two ABI products were a sweep apart.** Polling the bucket at 15-second cadence
from 02:32Z to 02:47Z, the newest ACTP scan ran ahead of the newest ACHP scan on every
one of the four 5-minute cycles observed, for 45–75 seconds each — the phase file
lands first and the pressure file follows. That is roughly a 20% duty cycle, and the
join's 2-minute cache pins a mismatched pair in place once it forms.

Two further measurements sit behind numbers quoted elsewhere:

- Sampling 121 interior points of the confirmed outline, 8 resolved to a cell that was
  not confirmed — three reading `ice`, four not candidates at all — every one of them
  0.6–3.2 km inside the drawn edge. The contour puts its boundary at the midpoint
  between cell centres in grid space, while the click resolves the nearest centre in
  lat/lon with a `cos(lat)` scale; on a Lambert grid those two are not the same cell
  near an edge. Isolated single-cell diamonds are clean — ~110 points inside each of
  five of them all resolved to their own cell — so this is an edge effect on
  multi-cell polygons only.
- Probing 588 cells across CONUS, 67 carried no cloud-top pressure while ACTP saw
  cloud: 32 of 74 liquid-topped cells, 34 of 260 ice-topped, 1 of 26 supercooled. No
  cell had a temperature ACTP called clear. This is the "no cloud seen here" the panel
  printed over a cell it simultaneously described as having a liquid top.

---

## 6. What a physical ground station adds

The station is the only element that converts simulation into measurement, and it
does so for the two criteria the national feeds cannot reach.

- **C4 becomes measured rather than modelled.** A depolarisation lidar distinguishes
  spherical liquid droplets from irregular ice crystals _as a function of height_.
  Fused with a microwave radiometer's liquid water path and a temperature profile —
  the established Cloudnet methodology — this yields "supercooled liquid layer, base
  and top, in feet". That is the C3 ∧ C4 intersection the whole product is organised
  around, and no free national feed produces it.
- **The radiometer's precision is well matched to the map's bottom band.** Ground-based
  LWP retrieval carries roughly 10–30 g/m² RMS error depending on configuration and on
  whether a ceilometer and model constrain the retrieval. The app's lowest SLW contour
  is **10 g/m²**. The station is the first instrument in the system able to resolve
  that band at all, rather than adding decimal places to something already resolved.
- **C2 closes properly.** A ceilometer measures cloud base directly, which is exactly
  the variable Texas operational practice selects on and the one the satellite cannot
  supply. Base from the ceilometer plus top from GOES gives real depth.
- **C1 and C7 become answerable.** An all-sky camera gives turret growth rate; a
  lightning detector gives electrification; surface and profile winds give the
  steering vector and the intercept point.
- **The map's role becomes precise.** With a station, the national layers stop being
  a verdict-shaped object and become a _targeting_ product: they say where to tow the
  station and which volumes deserve a look, and the station renders the verdict on the
  volume it is under. The 11.7% model-satellite disagreement in §2.1 is exactly the
  population a station resolves.
- **It supplies ground truth for efficacy (criterion E).** Before/after rain rate,
  drop spectra and reflectivity over the target are required for TDLR and NOAA
  reporting, and no national feed attributes an effect to a sortie.

The station also constrains the map in the other direction: a season of co-located
lidar/radiometer measurements against HRRR CLWMR at the same point would give the
first local skill estimate for the model field this map is built on. At present the
SLW layer's accuracy over Texas is assumed, not measured.

---

## 7. Bottom line

**Solved:** C3. Isotherm heights are derived correctly, per point, per hour, with
below-ground and inversion handling. This is the part a seeding operation could use
today.

**Built but unjoined:** C2 (top only), C4/C5 (simulated), C6 (measured). All three
exist as layers; none are combined. The join is the largest available improvement and
requires no new data — measured here at 2.23% of CONUS and 0.13% of Texas passing all
three tests simultaneously.

**Missing with free data available:** cloud base (`ABI-L2-CCLC`, `ABI-L2-ACHAC`),
observed cloud-top phase (`ABI-L2-ACTPC` — verified, with an explicit supercooled-liquid
class), lightning (`GLM-L2-LCFA`), and a reachability check against the drone ceiling.

**Missing and unavailable nationally:** phase and liquid quantity _inside_ the cloud,
in the vertical. This is the ground station's job, and no free feed substitutes for it.

**Divergence from Texas practice:** the app models a static column; Texas operations
select growing convective turrets by cloud base and inflow. Closing C1 and C2 narrows
this; it does not eliminate it.

The app is a well-built **candidate-finder** whose components are individually sound
and honestly bounded. It is not yet a zone-pinpointing tool, and the distance between
the two is mostly a fusion step it already has the inputs for.

---

## References

**Seeding physics and AgI**

- Marcolli, C. et al. (2016). _Ice nucleation efficiency of AgI: review and new insights._ Atmos. Chem. Phys. 16, 8915. https://acp.copernicus.org/articles/16/8915/2016/acp-16-8915-2016.pdf
- _Quantified ice-nucleating ability of AgI-containing seeding particles in natural clouds._ Atmos. Chem. Phys. 25, 5387 (2025). https://acp.copernicus.org/articles/25/5387/2025/
- Xue, L. et al. (2013). _Implementation of a Silver Iodide Cloud-Seeding Parameterization in WRF, Part I._ J. Appl. Meteor. Climatol. 52(6). https://journals.ametsoc.org/view/journals/apme/52/6/jamc-d-12-0148.1.xml
- Chen, S. et al. (2024). _Critical Size of Silver Iodide Containing Glaciogenic Cloud Seeding Particles._ Geophys. Res. Lett. https://agupubs.onlinelibrary.wiley.com/doi/full/10.1029/2023GL106680
- _Estimating the concentration of silver iodide needed to detect unambiguous signatures of glaciogenic cloud seeding._ Atmos. Chem. Phys. 24, 13833 (2024). https://acp.copernicus.org/articles/24/13833/2024/

**Seeding field experiments and seedability climatology**

- French, J. R. et al. (2018). _Precipitation formation from orographic cloud seeding._ PNAS. https://www.pnas.org/doi/abs/10.1073/pnas.1716995115
- Friedrich, K. et al. (2020). _Quantifying snowfall from orographic cloud seeding._ PNAS. https://www.pnas.org/doi/10.1073/pnas.1917204117
- Tessendorf, S. A. et al. (2019). _A Transformational Approach to Winter Orographic Weather Modification Research: The SNOWIE Project._ Bull. Amer. Meteor. Soc. 100(1). https://journals.ametsoc.org/view/journals/bams/100/1/bams-d-17-0152.1.xml
- Rasmussen, R. M. et al. (2021). _Potential for Ground-Based Glaciogenic Cloud Seeding over Mountains in the Interior Western United States and Anticipated Changes in a Warmer Climate._ J. Appl. Meteor. Climatol. 60(9). https://journals.ametsoc.org/view/journals/apme/60/9/JAMC-D-20-0288.1.xml
- Pokharel, B. et al. (2014). _The impact of ground-based glaciogenic seeding on clouds and precipitation over mountains._ https://farm.atmos.illinois.edu/contents/pubs_pdf/2014-Pokharel_etal-Impact_of_ground-based_seeding_on_clouds_and_precip_over_mtns-A_multi-sensor_case_study_of_shallow_orographic_cumuli.pdf
- WMO. _Statement on Weather Modification._ https://wmo.int/content/wmo-statement-weather-modification
- National Research Council (2003). _Critical Issues in Weather Modification Research_, App. A: Glaciogenic and Hygroscopic Seeding. https://nap.nationalacademies.org/read/10829/chapter/9

**Texas operations**

- Texas Comptroller of Public Accounts (2022). _Seeding Snap._ https://comptroller.texas.gov/economy/economic-data/water/2022/seeding-snap.php
- Texas Department of Licensing and Regulation — Weather Modification. https://www.tdlr.texas.gov/weather/summary.htm
- Woodley, W. L. & Rosenfeld, D. (2004). _The Development and Testing of a New Method to Evaluate the Operational Cloud-Seeding Programs in Texas._ J. Appl. Meteor. 43(2). https://journals.ametsoc.org/view/journals/apme/43/2/1520-0450_2004_043_0249_tdatoa_2.0.co_2.xml
- _Evaluation of the Effectiveness of Cloud Seeding in Texas from 2002 through 2006._ 17th Conf. on Planned and Inadvertent Weather Modification. https://ams.confex.com/ams/17WModWMA/techprogram/paper_138761.htm

**Icing / operational fusion products**

- Bernstein, B. C. et al. (2005). _Current Icing Potential: Algorithm Description and Comparison with Aircraft Observations._ J. Appl. Meteor. 44(7), 969. https://ui.adsabs.harvard.edu/abs/2005JApMe..44..969B/abstract
- NCAR RAL. _Icing Products (CIP/FIP) — Operational._ https://ral.ucar.edu/solutions/products/icing-products-cipfip-operational
- Adriaansen, D. R. et al. (2022). _CIP and FIP Version 2.0._ https://ui.adsabs.harvard.edu/abs/2022AMS...10297100A/abstract

**Satellite and model data sources**

- NOAA GOES-19 open data on AWS S3 (keyless). https://noaa-goes19.s3.amazonaws.com/
- GOES-R Series. _Data Products: Cloud Phase (ACTP)._ https://www.goes-r.gov/products/baseline-cloud-phase.html
- GOES-R Series. _Data Products: Cloud Top Height / Cloud Layer._ https://www.goes-r.gov/products/baseline-cloud-top-height-cloud-layer.html
- GOES-R Series. _Data Product: Cloud Top Temperature._ https://www.goes-r.gov/products/baseline-cloud-top-temp.html
- NOAA NESDIS STAR. _GOES-R Cloud Top Properties._ https://www.star.nesdis.noaa.gov/goesr/product_cp_cloud.php
- NOAA NCEI. _ABI Level 2 Cloud Top Phase (ACTP)._ https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc%3AC01504
- NOAA/GSL. _High-Resolution Rapid Refresh (HRRR)._ https://rapidrefresh.noaa.gov/hrrr/
- NOAA NSSL. _Multi-Radar/Multi-Sensor (MRMS)._ https://www.nssl.noaa.gov/projects/mrms/

**Ground-based retrieval**

- Crewell, S. & Löhnert, U. (2003). _Accuracy of cloud liquid water path from ground-based microwave radiometry, 2: Sensor accuracy and synergy._ Radio Science 38. https://agupubs.onlinelibrary.wiley.com/doi/10.1029/2002RS002634
- Gaussiat, N., Hogan, R. J. & Illingworth, A. J. (2007). _Accurate Liquid Water Path Retrieval from Low-Cost Microwave Radiometers Using Additional Information from a Lidar Ceilometer and Operational Forecast Models._ J. Atmos. Oceanic Technol. 24(9), 1562. https://journals.ametsoc.org/jtech/article/24/9/1562/2942/
- Cloudnet — cloud remote-sensing retrieval methodology. https://cloudnet.fmi.fi/

**In-repo**

- `MEASUREMENTS.md` — standing physics and sampling constraints
- `/home/nathan/code/rainmaker/weatherman/docs/SENSING_STRATEGY.md` — C1–C7
- `/home/nathan/code/rainmaker/docs/DRONE_DESIGN.md` — R2 service ceiling
