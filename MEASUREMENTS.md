# Measurements — what a national seedability map can and cannot know

**Status: decision document, not a description of the code.** Some of the
"candidate layers" section is now built — the **Completed** column of §2 says
which, and each built entry carries a note on what shipping it actually meant.
`CLAUDE.md` describes what exists; this file is the menu we pick from next.
Findings marked **[verified]** were tested live against the real endpoint on
**2026-07-16**; the PIREP figures in §D, the MRMS, HRRR-profile and
seeding-band figures in §A, §B and §C, and the cloud-top figures in §G were
verified **2026-08-12**. §G's coverage figures come from a **24-case,
year-round sample over Texas** (two days a month, 18z) rather than a single
run — §G explains why that distinction changed the answer. The rest is
reasoning.

Product context and the C1–C7 criteria live in the system design at
`/home/nathan/code/rainmaker/weatherman` (`docs/SENSING_STRATEGY.md`). This
document is the _national-feed_ half of that strategy's §5: what the free
feeds can answer **without any local ground station**, which is the standing
constraint on everything below.

---

## 1. The question, reduced to one variable

Seeding does exactly one useful thing: it drops AgI into **supercooled liquid
water** so the Wegener–Bergeron–Findeisen process can convert it to
precipitation. So the map has to find:

> **cloud liquid water — not ice — at −5 to −18 °C, that isn't already
> raining itself out.**

The band was **−5 to −12 °C** until 2026-08-12, following
`SENSING_STRATEGY.md`. The warm edge is physics: silver iodide barely
nucleates ice above −5 °C. The cold edge is a judgement — AgI keeps working to
roughly −20 °C, and what thins out below −12 °C is the _supply_ of liquid
rather than the agent, because natural ice nuclei activate and take it first.
So −12 °C was a bet on where the liquid usually is, and it discarded real
supercooled water at −13 to −18 °C. **[verified] on a live PIREP pull the day
it changed:** of 21 positive icing reports, 9 fell in −5..−12 °C and **6 more
sat at −13 to −18 °C** — a 67% increase in confirmations, from reports that
were previously thrown away. Five colder than −18 °C are still excluded.
Widened on the principle that a tool for _finding_ candidates shows what is
there and lets the operator judge.

That is `SENSING_STRATEGY` **C3 ∧ C4** (the temperature band ∧ the phase),
gated by **C6** (not already precipitating). Everything below is scored on
how much of that sentence it answers.

The trap is that "cloud" and "seedable cloud" are almost unrelated. GOES
answers _"is there a cloud, what shape is it, and how cold is its top"_ (C1,
C2) — the top only. It says nothing about phase or temperature _inside_ the
cloud. **The gap between the map we have and the map we want is entirely C4**,
and it is why (B) exists and why (G) is filtered rather than decorative.

## 2. What actually sees supercooled liquid water

The honest hierarchy. Nothing free and national **measures** SLW:

| Source                             | Relationship to SLW              | Res / refresh                          | Available?                                        | Completed |
| ---------------------------------- | -------------------------------- | -------------------------------------- | ------------------------------------------------- | --------- |
| Microwave radiometer + depol lidar | **measures** it                  | point, continuous                      | ❌ needs the ground station (Tier B/C, +$90k–$1M) | No        |
| **HRRR `CLWMR`**                   | **simulates** it                 | 3 km, hourly                           | ✅ free, GRIB2                                    | Yes       |
| **CIP** (FAA icing product)        | **fuses** model+sat+radar+PIREP  | 13–20 km, 1000 ft, hourly              | ⚠️ **no public API** [verified]                   | No        |
| **Icing PIREPs**                   | **confirms** it, spot            | ~20 positive / 12 h / CONUS [verified] | ✅ free GeoJSON                                   | Yes       |
| MODIS cloud phase / water path     | retrieves it, **cloud-top only** | 1 km, 2×/day                           | ✅ free (GIBS tiles)                              | Yes       |
| GOES ABI cloud-top temperature (G) | **cannot see it** — top only, C2 | 2 km, 5 min                            | ✅ free, NetCDF4 on S3                            | Yes       |

**The conclusion that matters:** with no ground station we get _simulation +
sparse confirmation_, never measurement. A national map can therefore honestly
show **candidate volumes** — it cannot render a verdict. That is not a defect
in the plan; it is precisely the gap the station exists to fill, and the map's
job is to tell you where to tow it.

## 3. Candidate layers

### A. MRMS base reflectivity — C6 (already raining?)

NOAA serves this from **their own ArcGIS Server**, already in EPSG:3857, no key:

```
https://mapservices.weather.noaa.gov/eventdriven/rest/services/
  radar/radar_base_reflectivity/MapServer
```

**[verified]** `export` returns a live 900×500 PNG of real CONUS convection;
the service reports `wkid 102100 / latestWkid 3857` — the same projection as
our GOES layers and basemap. MRMS 1 km, ~2 min.

- **Effort:** near zero. A `MapImageLayer`, browser → NOAA, exactly the GIBS
  pattern. **No server code** — it returns imagery, not data, so the
  "third-party calls only on the server" rule doesn't bite (same reasoning as
  the GIBS carve-out in `CLAUDE.md`).
- **Caveat:** see §5 — radar is a _mask_, not a detector.
- **Verdict: highest value/effort ratio on this list.**

**Built** (`/radar/reflectivity`, on `/map/candidate`) — but **not as the image
layer described above**, and that is the whole story of this entry:

- **Contours from the GRIB2 mosaic, not NOAA's ready-made `MapImageLayer`.**
  The image was near-zero effort and it was still the wrong call: a rendered PNG
  cannot composite with the liquid-water contours beneath it, and reading cyan
  against amber — a candidate already raining itself out — is the only reason
  this layer is on the candidate map at all. So it reads
  `MRMS_MergedBaseReflectivityQC.latest.grib2.gz` (**[verified]** 907 KB,
  keyless, single message, ~2 min cadence) through the same eccodes → marching
  squares path HRRR uses. Cost: ~9 s to build, 5-minute TTL, ~65 KB of GeoJSON.
- **This is allowed where the PIREPs are not.** MRMS samples at 1 km; block
  averaging to 12 km removes structure rather than inventing it. §5's rule
  permits the surface, and the rule is the reason the two layers look different.
- **Averaged in reflectivity factor, not in dBZ.** dBZ is a logarithm — the mean
  of 20 and 50 dBZ is not 35 dBZ of weather. Points are converted to
  Z = 10^(dBZ/10), averaged, and converted back.
- **Two sentinels, and they are opposites.** **[verified] on a live mosaic:**
  `-99` (a radar looked and found nothing) covers 15.6M of the 24.5M points and
  `-999` (no radar sees this at all) covers 8.2M — **a third of the box**. No
  coverage is dropped from the denominator rather than averaged in as clear air,
  and the sidebar reports the coverage figure (67%) beside every count.
- **Levels 20/30/40/50 dBZ**, measured against a real mosaic: 1.41% of the box,
  0.36%, 0.074%, 0.008% — the same footprint the HRRR layers have, so the same
  faint stacked fills work.
- **Trap found in the build:** MRMS scans north-to-south and HRRR south-to-north,
  and the contourer reads ring orientation from signed area. A north-up grid
  inverts every ring, so exteriors are classified as holes and dropped — 2,395
  cells over 20 dBZ contoured to 23 stray polygons while the stats still
  reported a 57 dBZ peak. Rows are flipped in the radar service; `radar-service.test.ts`
  pins it.

### B. HRRR supercooled liquid water — C3 ∧ C4 (the real one)

`hrrr.tXXz.wrfprsfXX.grib2` carries **`CLWMR` on 40 pressure levels**, plus
`TMP`, `HGT`, `RWMR`, `SNMR` on the same 40 **[verified]** from the `.idx`.

```
CLWMR > threshold  ∧  TMP ∈ [−12, −5] °C   →  C3 ∧ C4
RWMR / SNMR at or below that level          →  C6
```

**`CLWMR` is liquid by definition** (Thompson microphysics separates cloud
water from ice/snow/graupel), so cloud water at subfreezing temperature _is_
supercooled liquid water. One file answers the crux.

Sizing, measured against the live NOMADS file **[verified]**:

|                                               |                                                                     |
| --------------------------------------------- | ------------------------------------------------------------------- |
| One `CLWMR` level, all 1,905,141 CONUS points | **47.6 KB** (mostly zeros; compresses superbly)                     |
| Packing                                       | **template 5.3** — complex + spatial differencing, **not JPEG2000** |
| 450–700 mb × {CLWMR,TMP,HGT,RWMR,SNMR}        | **14.2 MB = 3.6%** of the 390 MB file                               |
| Without `HGT`                                 | ~8 MB                                                               |

`.idx` files are plain text with byte offsets, so HTTP **range requests**
fetch only the records we want. Cache 15 min against an hourly model.

- **This is not a hack.** CIP v2.0 was explicitly updated to lean on "the HRRR
  with respect to particle phase and supercooled liquid water forecasts."
  Using HRRR SLW is what the operational icing product does.
- **At 3 km this is a legitimately renderable field** — see §5's correlation-
  length rule. Unlike the 3° grid, drawing it as a surface is honest.
- **Caveat:** it is the model's _opinion_, not an observation — and §5 records
  a case where it was wrong.
- **Effort:** the big one. Needs GRIB2 decoding → **decided, see §6.**

**Built** (`/forecast/liquid`, on `/map/candidate` at the analysis hour). What
shipping it meant:

- **Integrated, not sampled at a level.** The band moves — 425–525 mb over
  Texas in July, 700–950 mb in a winter airmass — so drawing CLWMR at any
  fixed level would be arbitrary. The service integrates `q_c · dp / g` over
  exactly the 25 mb levels whose `TMP` is inside the band at that point, and
  contours the resulting **path in g/m²**.
- **The band is found before it is read.** Every decoded record costs ~1 s, so
  reading all 25 levels of TMP+CLWMR (50 records, ~43 s) spends most of the
  build on levels that contribute nothing. A 7-record `TMP` scout ladder
  (400→1000 mb) bounds the band first; only the levels that can contain it are
  read at full spacing. ~25 s flat across seasons instead of worst-case always.
- **Contour levels are measured, not round.** 10 / 50 / 150 / 400 g/m² against
  a real analysis: ≥10 covers **1.73%** of CONUS, ≥50 0.90%, ≥400 0.07% — the
  same footprint precipitation has, so the same faint stacked fills work.
- **It exists at f00**, unlike PRATE (a flux needing a timestep the analysis
  has not taken). That is what lets the _observed_ map show it for "right now",
  and it is the one modelled layer on that map — the sidebar says so.
- **The sidebar reports the numbers an operator acts on** — coverage %,
  seedable km², peak path, and the pressure window the band occupied — not a
  domain mean, which for a field covering ~2% of the country is a number about
  the other 98%.

### C. Seeding-band sounding — C3 (target altitude)

Click the map → vertical profile at that point → the 0 / −5 / −12 °C isotherm
heights. Straight from `temperature_*hPa` + `geopotential_height_*hPa` via
Open-Meteo JSON, keyless.

**[verified]** working today; at 44.26 N, −73.96 W the −5..−12 °C band (the
then-current definition) sat at
600–550 mb = **14,035–16,250 ft**.

**10,000–18,000 ft is not a specification, and nothing may be gated on it.**
`SENSING_STRATEGY.md` gives that range as what −5..−12 °C works out to _in
Central Texas convection_ — a consequence of one region's temperature profile,
quoted for scale. The band's altitude is set by the column: surface
temperature, lapse rate, season, latitude and terrain elevation all move it,
and it ranges from the ground in a winter airmass to **above 22,000 ft** in a
summer one (both measured, below). The physical quantity is the temperature;
the altitude is derived per point, per hour, and always has been in the code.

- Produces the design docs' "0/−5/−12 °C isotherm heights" product directly,
  which is also **the drone's target ceiling** (DRONE_DESIGN R2).
- Follows the full reference pattern end-to-end (service → router → proxy →
  client → slice → provider → component) and reuses
  `interactions.coordinates`, which already exists.
- **A point readout, not a national surface** — honest about resolution, and
  sidesteps the interpolation question entirely.
- **Temperature is the best-forecast variable there is**: it matched a real
  aircraft observation within **1.4 °C** (§5).

**Built** (`/forecast/sounding`, on `/map/candidate`) — **from HRRR, not
Open-Meteo**, which is the one thing this entry got wrong:

- **The same model as the contours.** Open-Meteo would have been less work and
  it would have put two models on one screen: the amber contours saying the band
  is one place and the readout saying another, with no way for an operator to
  choose. HRRR already has `TMP` and `HGT` on the same pressure levels the
  liquid-water integral reads, so the readout is derived from the same numbers
  the map is drawn from.
- **A national profile grid, not a point query.** One build reads TMP+HGT at
  50 mb from 300 mb to HRRR's lowest level (32 records, **[verified]** ~32 s)
  and block-averages to the same 12 km grid the contours use. Every later click
  is answered from it in **~11 ms**. The panel therefore loads for the map
  centre on mount rather than waiting for a click.
- **50 mb, not wrfprs' native 25 mb.** 32 records is ~32 s and 64 would be
  ~64 s; temperature is near-linear across a 500 m layer, so interpolating
  within one costs tens of feet.
- **The read window is the one altitude-shaped assumption left, and it is set
  from measurements.** It first shipped as 400–1000 mb, which was wrong at both
  ends. **[verified] 12 Aug:** the warmest 12 km cell at 400 mb was **−13.4 °C**
  — 1.4 °C from the band's cold edge, so one hot airmass would have pushed the
  band's top through the ceiling. And 1000 mb is not the ground: in a winter
  airmass the band reaches the surface, and HRRR's own lowest level is 1013.2 mb.
  Now 300 mb → 1013.2 mb, which puts ~20 °C of margin above the band (**topC
  −32.4 °C** on the same column) and reaches the bottom of the model.
- **A missing isotherm is explained, not reported as absence.** Outside the read
  window `isothermFt` finds no crossing and returns null — which was rendered as
  "there is no altitude here to seed at" whether the column was _too cold
  throughout_ (a real answer) or simply _not read high enough_ (our limit). The
  sounding now carries the column's base and top temperature so the panel can
  tell those apart.
- **Terrain comes too.** HRRR extrapolates pressure levels _below ground_, so
  without `HGT:surface` a freezing level in Colorado reads as a real altitude
  when it is 2,000 ft inside a mountain. The panel says so when it happens.
- **The lowest crossing wins.** An inversion can cross 0 °C twice; the altitude
  that matters for flying into the band is the first one reached going up.
- **[verified] live**, and it is why the 10–18 kft figure above must stay
  descriptive: Kansas, 12 Aug 04Z — freezing level **16,433 ft**, band
  **18,685–22,066 ft**. Denver the same hour: ground 5,272 ft, band
  **19,157–22,668 ft**. Both far
  above the design docs' 10,000–18,000 ft.

### D. Icing PIREPs — C4 spot truth

```
https://aviationweather.gov/api/data/pirep?format=geojson&types=ice&age=12&bbox=25,-125,50,-66
```

**[verified]** keyless GeoJSON. Fields are `icgInt1` (intensity) / `icgType1`
(type) — **not** the `icing_*` names in the OpenAPI spec. `types=ice` **does
not filter server-side**; filter client-side on `icgInt1`.

Sparse: **22 of 400** reports in 12 h over CONUS carried icing, and most were
`NEG`. But each positive one is an aircraft _confirming supercooled liquid
water at a known altitude and temperature_. Today's:

```
SLK UA /OV LKP/TM 2109/FL140/TP PC12/SK TOP 140 BASE 060/TA M05/IC LGT RIME 140
```

A Pilatus at 14,000 ft, **−5 °C, light rime** (rime _is_ SLW freezing on
impact), in cloud 6,000–14,000 ft. C2 ∧ C3 ∧ C4 in one line, in July.
`icgType1` is real phase information: **RIME → small droplets; CLEAR → SLD**
(supercooled large drops).

- **Verdict:** not a map layer — a **validation overlay**. It is the only
  actual SLW observation available without a ground station, and it is what
  lets the dashboard say "the model claims a candidate here _and_ an aircraft
  confirmed it."

**Built** (`/pireps/icing`, on `/map/candidate`), as an overlay and not a
layer in the contour sense. What that meant in practice:

- **Points, never a surface.** ~20 positive reports over CONUS in 12 h,
  hundreds of km apart and only along airways: there is no sampling to
  interpolate. Contouring them would draw an icing map out of route structure.
  The colour banding rides a **marker ramp** (`PIREP_CLASSES`) instead of a
  fill — the aesthetic of the other layers without their claim.
- **Negative reports are drawn too**, in grey. `NEG` is an aircraft saying it
  flew through that point and found none — the only falsification of the model
  anywhere in this system, and the thing that keeps ~20 violet dots from
  reading as a national picture.
- **Ranked, not just plotted.** `icgInt1` is pilot vocabulary (`NEG`, `TRC`,
  `LGT-MOD`, `MOD`, `SEV`, and forms like `NEGclr`); the service ranks it 0–4,
  taking the worst class a range names.
- **The temperature is the filter that matters.** `TA` is carried through as
  `tempC` and each report is flagged `inBand` for the seeding band.
  **[verified] on a live pull: 21 positive, 15 in band** — the rest iced up too
  cold to seed (−20 °C and below).
  A report with no temperature is _not_ in band; "we cannot say" must not be
  promoted to "yes".
- The sidebar reports every count against its denominator ("20 of 400 PIREPs
  filed"), because the hits alone read as an icing map.

### E. Freezing level (G-AIRMET FZLVL) — C3, cheap — **retired, superseded by C**

`https://aviationweather.gov/api/data/gairmet?format=geojson` — **[verified]**
18 features right now, **10 of them `ZULU`/`FZLVL`** contours with a `level`
in hundreds of feet. Keyless, always-on, GeoJSON.

Gives the 0 °C surface nationally; the seeding band sits above it. Cheaper
than (C) but coarser — contours, not a profile.

**Do not build this.** Since (C) shipped, the freezing level is read straight
off HRRR's own profile, per 12 km cell, in feet — and (C) also gives the −5 and
−12 °C surfaces, which FZLVL does not. This would add a coarser answer to a
question already answered, from a second source that could disagree with the
contours on screen. Its only remaining advantage was cheapness, and (C) is now
built.

### F. AIGFS / HGEFS — planning horizon, not seedability

See §4. Good for "is it worth towing the trailer to west Texas Thursday?", out
to 16 days. **Cannot contribute to C4 at all.**

### G. Cloud-top temperature — C2 (does the band lie inside the cloud at all?)

**Built 2026-08-12 from the _observed_ source; one decision below is still
open.** Raised when the Band 13 raster came up for removal: it was the last
image on either map, and the replacement had to answer a question rather than
paint a picture.

**What shipped** (`/cloudtop/temperature`, on `/map/candidate`, replacing the
Band 13 raster entirely):

- **GOES-East `ABI-L2-ACHP2KMC`**, not HRRR's `PRES:cloud top`. The source
  question below was decided for the observed feed: the geometry is a real
  satellite retrieval, so the layer can contradict (B) rather than agree with it
  by construction. HRRR still supplies the temperature at that pressure, which
  is the split §5 argues for — the model is trusted for the profile and not for
  the cloud.
- **The mask is C2 only**: tops at −5 °C or colder, no cold cutoff. That is the
  honest default while the cold-edge question stays open, and it is the one the
  measurements below lean toward.
- **Disjoint bands, not nested contours** — see the note at the end of this
  entry, which is a finding from the build rather than from the survey.
- **One new npm dependency, `h5wasm`**, and it earned it: `jsfive` reads the
  same files but returned **no attributes at all**, which would have meant
  hardcoding the fill value, the scale factor and the projection constants that
  the file already carries. `netcdf4` and `hdf5` were last published in 2018.
  h5wasm is ESM-only against a CommonJS server, which cost a `tsconfig` change
  to `"module": "node16"` and a lazy dynamic import; `CLAUDE.md` records why.
- **The HRRR profile grid now reads to 100 mb, not 300 mb.** Cloud tops sit far
  higher than the seeding band does, and the old ceiling clamped **[verified]
  47.6% of cloudy cells** to a single temperature. The sounding panel still
  displays only 300 mb and below, so it is unchanged: build wide, display
  narrow.

`hrrr.tXXz.wrfsfcfXX.grib2` carries **`PRES:cloud top`** — one record,
**[verified] 587,534 bytes**, and it is _missing_ where there is no cloud
rather than carrying a sentinel. That is real nodata, which is the property the
raster never had: **[verified] 77.57%** of CONUS (1,477,751 of 1,905,141
points) has no value at all on the 12z analysis. Interpolating `TMP` at that
pressure against the profile ladder (C) already caches turns it into
cloud-top temperature for the price of one extra record.

**What it adds over (B), measured rather than argued.** The obvious objection
is that we already integrate `CLWMR` over the band, so a second temperature
layer is a restatement. It is not. **[verified] 12z f00 over CONUS**,
cross-tabulated against an SLW path integrated on the same ladder (50 mb
layers, coarser than the service's 25 mb — the structure is the finding, not
the magnitudes):

|                                    | % of CONUS |
| ---------------------------------- | ---------- |
| Cloud top in −5…−18 °C             | 1.70       |
| SLW ≥ 10 g/m²                      | 1.22       |
| **Both**                           | **0.69**   |
| SLW, but top outside the window    | 0.53       |
| Top in window, but no modelled SLW | 1.02       |

Only 56.4% of the ground where the model finds seedable liquid has a cloud top
in that window. The two layers disagree about half the time, so whatever else
is true, this is not (B) redrawn.

**Then that number was re-measured properly and it did not hold.** The figures
above are one summer afternoon over the whole country, and both halves of that
are wrong for this product: the operation is **Texas**, and it runs **year
round**. Redone over a Texas bounding box (**176,972 HRRR cells**, 9.3% of the
CONUS grid) across **24 cases — two days a month for a year, 18z, noon CST,
when sorties fly** — pooled over 4.2M cell-observations from the keyless HRRR
archive:

|                             | % of Texas |
| --------------------------- | ---------- |
| Cloudy                      | 16.3       |
| Cloud top warmer than −5 °C | 11.5       |
| SLW ≥ 10 g/m²               | 1.3        |

**The single CONUS case overstated the −18 °C window's reach: 56.4% there,
48.7% over a Texas year.** Texas is drier and its seeding opportunities are
episodic — **10 of the 24 cases carried essentially no SLW at all** (under 200
cells), and one case, 2025-11-20, carried 10.1% of the state on its own. Any
figure here drawn from a single day is an accident of that day.

**The warm edge is C2 and needs no new justification.** `SENSING_STRATEGY.md`
already states it: _"the −5 to −12 °C band must physically lie between base and
top. A shallow warm cloud never reaches it."_ A top warmer than −5 °C means the
band is **above** the cloud, so there is nothing in it to seed — and that is not
a rare edge case: **[verified] 11.5 of Texas' 16.3 cloudy percent, i.e. 71% of
all cloudy cells pooled over the year**, are exactly that. Masking them off is
the single biggest thing this layer does, and it is the criterion the project
already holds.

#### Open — the cold edge has no basis in the design document

Everything above justifies a mask of "top colder than −5 °C". It does **not**
justify an upper bound, and the −18 °C one proposed alongside it is borrowed
from the SLW band, where it means something different: −18 °C is where the
_supply of liquid worth converting_ thins out (§1). Applied to a cloud **top**
it would have to mean something else entirely — that a top colder than −18 °C
implies the cloud has glaciated enough aloft that seeding adds little.

**That claim is nowhere in `SENSING_STRATEGY.md`.** The nearest things to it are
**C1** (lightning marks a "mature, electrified, strongly-glaciated state" where
"the supercooled window is closing") and **C6** ("seeding adds the most where the
natural ice process is deficient") — both real, neither expressed as a cloud-top
temperature threshold. Under a strict reading of **C2** there is no cold cutoff
at all: a colder top just means the band is more fully enclosed by cloud, which
is _better_, not worse.

The measurement shows the choice is not academic — **a cold edge throws away
about half the target ground, year round.** **[verified]** pooled over the 24
Texas cases:

| Cold edge      | Mask, % of Texas | SLW ground covered |
| -------------- | ---------------- | ------------------ |
| −18 °C         | 1.4              | **48.7%**          |
| −25 °C         | 2.1              | 59.4%              |
| −30 °C         | 2.6              | 65.1%              |
| none (C2 only) | 4.8              | **92.7%**          |

**And the damage is wildly unstable, which is the finding that matters.** Across
the 14 cases with a usable SLW footprint (≥200 cells), the share of seedable
ground the −18 °C edge keeps ranges from **14.2% to 82.7%** — a six-fold swing
between days. −25 °C is no steadier (23.2% to 91.9%). On 2026-03-08 the −18 °C
edge kept 14.2% of the SLW ground while C2 alone kept 95.7%: a deep-cloud day
where nearly all the liquid sat under tops colder than the cutoff. On 2026-01-08
the same edge kept 82.0%.

A threshold whose consequence swings six-fold with the synoptic situation is not
a threshold this data can calibrate. It can only be justified — or not — from
outside.

**What must be settled before building:** whether the marginal benefit of
seeding really falls off below some cloud-top temperature, and if so what that
temperature is. This is a claim about natural ice-nucleus activation
out-competing AgI, and it needs a citation, not a plausible-sounding number
picked from a table of coverage percentages. The figures above can say what a
threshold _costs_ and how erratically it costs it; they cannot say whether it is
real. **Note which way they lean, though:** C2 alone is both the simplest rule
and the stable one, and every cold edge tested is expensive and inconsistent.
The burden of proof sits on adding the cutoff, not on leaving it out.

**Leads to check — none verified, none currently cited anywhere in this repo or
in `SENSING_STRATEGY.md`:** the cloud-top-temperature "seeding window" from the
1970s Colorado River Basin Pilot Project (Grant & Elliott is the name usually
attached to it); the NRC's _Critical Issues in Weather Modification Research_
(2003); the ASCE standard practice for precipitation-enhancement projects; WMO
statements on weather modification; and Super & Boe on AgI in orographic cloud.
**Do not cite any of these from this list** — it is a search plan, and each
needs reading before it can carry a threshold. If the literature does not
support a cold edge, the honest layer is C2 alone: mask at −5 °C and draw
everything colder.

#### Decided 2026-08-12 — observed, and what it changed

The source decides what the layer _is_, not just where the bytes come from.

- **HRRR `PRES:cloud top` (modelled).** Reuses byte-range subsetting, eccodes,
  block averaging and marching squares; one 587 KB record; the profile ladder is
  already cached. Nothing new to build and no new dependency. **But the same
  model supplies both the liquid and the verdict on whether that liquid has
  glaciated**, so this cannot falsify (B) — it is a second opinion from HRRR,
  not a check on it. §5 already records that HRRR "nails the thermodynamic
  profile and is much shakier on cloud", and this layer would inherit exactly
  that weakness while sitting beside the layer that shares it.
- **GOES-East `ABI-L2-ACHP2KMC` (observed) — the option this entry originally
  missed.** Not the Band 13 brightness temperature and not the full-disk
  temperature product, but **observed cloud-top _pressure_, CONUS, 2 km**:
  **[verified] 4.1 MB a scene, one scene every 5 minutes**, keyless on
  `noaa-goes19`. That is _the same variable_ `PRES:cloud top` gives us, so it is
  a drop-in — identical `TMP`-ladder interpolation, identical contouring — and
  it makes the cloud geometry an **observation that can falsify HRRR's cloud
  field**, which is the role MRMS and the PIREPs play and the reason those two
  layers earn their place. `SENSING_STRATEGY.md` §5 assigns cloud-top
  temperature to GOES explicitly.

  **[verified] by reading a real scene, not the documentation:** `PRES`, units
  hPa, 1500 × 2500, `_FillValue` 65535 over **50.0% of the grid** — true nodata
  again — scaling to a **91.9…1016.2 hPa** range, on the standard GOES-R ABI
  fixed grid (geostationary, `sweep_angle_axis: x`, origin −75°). It also
  **beats HRRR on freshness by an order of magnitude**, which matters on a map
  whose whole claim is "right now": **[verified]** a scene scanned 00:51 UTC was
  published by 00:55 and read at 00:58, against HRRR's hourly analysis posted
  ~50 minutes after the hour.

  Cost: **one new dependency and a reprojection.** The files are NetCDF4/HDF5.
  `h5wasm` (NIST, **[verified]** published 2026-06-11, ~150k downloads/month,
  **zero dependencies**, WASM so no native toolchain) reads them, and it is what
  produced the figures above rather than being taken on trust. The alternatives
  fail the bar: `netcdfjs` is healthy but NetCDF v3 classic only, and `netcdf4`
  and `hdf5` were both last published in **2018** with a few hundred downloads a
  month and need a native build. `jsfive` (same authors, pure JS) is the
  fallback. Beyond the reader there is the ABI scan-angle → geodetic transform
  and a resample onto the 12 km grid — arithmetic, but ours to own and test.

**Taken: the observed route.** Independence and freshness were judged worth a
dependency and a reprojection we maintain. A modelled layer is exact about a
cloud that may not exist; an observed one is approximate about a cloud that
does — and the candidate map's entire premise is "what is the sky doing right
now". It also pairs with §5's own finding that HRRR "nails the thermodynamic
profile and is much shakier on cloud": GOES supplies the cloud geometry, HRRR
the temperature profile, each doing what it is good at.

**What it cost, measured on the build rather than estimated:** one npm
dependency, ~150 lines of ABI geolocation with its own test suite, and a cold
build of ~38 s — almost all of it the HRRR profile grid, not the 4 MB scene.
Warm, it is ~0 ms for five minutes. The modelled fallback is still cheap to
reach if the feed fails: `PRES:cloud top` is the same variable on the same 12 km
grid, so only the service's decode step would change.

#### Caveat found in the data, either way

**HRRR's `PRES:cloud top` reports one deck, not the highest.** **[verified]** on
1,494 points the analysis puts in-band liquid _above_ the reported top — in
**all 1,494**, never below — with a median gap of 26 mb and a maximum of 489 mb.
Most of that is discretization, but the tail is genuine multi-layer cloud where
the diagnostic describes a low deck and the seedable liquid is in a higher one.
It is 0.35% of cloudy cells, small enough to build on and large enough to
belong in a comment rather than a surprise. It is also the likely explanation
for the cells that report a "top" warmer than −5 °C while still carrying in-band
liquid. Whether GOES' retrieved cloud-top pressure has the same failure — it
almost certainly does, since a passive radiometer sees the deck that is on top —
has **not** been tested and should be, before the observed route is trusted over
multi-layer cloud.

**On seasons and geography, read the Texas year-round numbers, not the CONUS
August ones.** This entry was first written from a single summer afternoon over
the whole country, and both choices flattered the result — the −18 °C window's
reach fell from 56.4% to 48.7% when it was re-measured over a Texas year. This
product runs year round; **[verified]** 10 of 24 Texas cases carried no
meaningful SLW at all, so any figure taken from one day is an accident of that
day's weather. The archive makes this cheap to re-check (§5 has the two traps
that make it not quite free), and a decision this file records should be
re-measured the same way rather than argued from the nearest run.

### Rejected, with reasons

| Candidate                          | Why not                                                                                                                                                                                                         |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **G-AIRMET icing**                 | Threshold-gated _hazard warning_, not a diagnosis. **[verified] zero ICE features in July** — it would be blank most of the season. FZLVL from the same feed is fine (E).                                       |
| **CIP / FIP**                      | The purpose-built product, and the best thing on this list — but **[verified] no public API**: the AWC OpenAPI spec has 20 endpoints, none is CIP/FIP. NOAAPORT or scraped imagery only. Worth an email to AWC. |
| **GOES cloud phase**               | **[verified] doesn't exist on GIBS.** 3,769 layers, 12 GOES (6 East, 6 West), none is a cloud product. The real GOES-R L2 `ACTP` is NetCDF from `noaa-goes19` on S3 — no tiles, needs regridding.               |
| **MODIS cloud phase / water path** | On GIBS and real (`MODIS_*_Cloud_Phase_Optical_Properties`, `MODIS_*_Cloud_Water_Path`), but **cloud-top only, 2×/day**. Too stale to task a drone. Possible future context layer.                              |
| **Open-Meteo `cloud_cover_*hPa`**  | It is a humidity field wearing a cloud label. See §5.                                                                                                                                                           |

**Free and unused:** GIBS carries **GOES-West** with the same 6 products we
already use from GOES-East. Better viewing geometry over the western US, and
it is the same `WebTileLayer` config we already have.

## 4. The NOAA AI models — verified output

`AIGFS`, `AIGEFS`, `HGEFS` went operational **2025-12-17** (SCN 25-89), all
three built on Google DeepMind's **GraphCast**. 0.25°, 4×/day (00/06/12/18Z),
16 days, 6-hourly. AIGEFS is 31 members; HGEFS is a 62-member hybrid grand
ensemble (31 AIGEFS + 31 GEFSv12) that beats both parents.

**Their complete output**, quoted from the service change notice:

| Scope                                                                                       | Fields                                               |
| ------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| **13 pressure levels** (50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000 mb) | `UGRD`, `VGRD`, `TMP`, `HGT`, `SPFH`, `VVEL`         |
| **Surface**                                                                                 | `UGRD` 10 m, `VGRD` 10 m, `TMP` 2 m, `PRMSL`, `APCP` |

**That is the entire list. No cloud water, no cloud ice, no cloud fraction —
not even relative humidity.** GraphCast predicts dynamics and thermodynamics,
not microphysics. A model with no condensate variable cannot tell you whether
a cloud is seedable, and **no postprocessing recovers it, because the
information was never in the model.**

What they _are_ good for:

- **C3** — `TMP` + `HGT` on 13 levels → isotherm heights → the drone's target
  altitude, out to 16 days.
- **C7** — winds on those levels → transport and flight envelope.
- **Planning** — HGEFS's 62-member spread → probability of a seedable synoptic
  setup next week. This is a real operations product; it is just not a
  seedability product.

**API:** officially **NOMADS only** (no FTP), GRIB2:
`aigfs.YYYYMMDD/CC/model/atmos/grib2/aigfs.tCCz.[pres,sfc].fHHH.grib2`.
But **Open-Meteo resells AIGFS as JSON** — **[verified]** `models=ncep_aigfs025`
returns 240 hours, keyless. ⚠️ The documented ID `ncep_aigfs` **400s**; the
working ID had to be found by probing. `gfs_graphcast025` also resolves.

## 5. Traps

These are the ways this map lies to you. Each was found by testing, not by
reading docs.

**Open-Meteo's `cloud_cover_*hPa` is a humidity diagnostic, not cloud.**
**[verified]** from an AIGFS pull over Central Texas, it is a strict monotone
function of RH:

```
RH 69% → cloud  0%    RH 81% → cloud 21%    RH 89% → cloud 39%
RH 79% → cloud 16%    RH 84% → cloud 26%
```

Open-Meteo's own docs confirm it: for HRRR cloud cover is "approximated based
on relative humidity"; for AIGFS it is derived from specific humidity via
Murphy & Koop (2005). **Shipping it as a cloud layer would be the same class
of error as interpolating the 3° grid** — a picture the data never measured.
This is exactly the `cloud_cover` field our current sidebar grid uses; it is
defensible as a _statistic_, never as a phase or condensate claim.

**Radar cannot see supercooled liquid water.** Backscatter goes as d⁶, so
10 µm cloud droplets are effectively invisible to NEXRAD; you need ~mm drops.
Radar shows precipitation that **already formed** — the C6 _negative_ signal
(the cloud already converted its liquid, so seeding has no headroom). **Radar
tells you which candidates to cross off, not where to go.**

**The model and the sky disagree, and it's the cloud field that's wrong.**
**[verified]** at the exact point/time of today's rime-ice PIREP, HRRR via
Open-Meteo matched the observed temperature within **1.4 °C** but reported
**clear air where the aircraft was in cloud with icing**. Models nail the
thermodynamic profile and are much shakier on cloud. That asymmetry is why
(C) is trustworthy, why (B) is a candidate-finder rather than a verdict, and
why (D) belongs on the map.

**The HRRR archive is not a drop-in for NOMADS, and both ways it differs fail
quietly.** **[verified] 2026-08-12** against `noaa-hrrr-bdp-pds` on S3, which is
keyless, goes back years, and is the only way to test this app's behaviour in a
season other than the one you are standing in:

- **S3 ignores multi-range requests.** Ask NOMADS for 16 byte ranges and it
  returns `206` and a `multipart/byteranges` body — the trick §B is built on,
  and the reason a frame costs ~930 KB of a 390 MB file. Ask S3 for the same
  thing and it returns **`200 OK` with the entire 398 MB object**. Not a 206,
  not a 416, not an error: the identical code path silently downloads the whole
  file and then spends a quarter of an hour in `grib_filter` decoding all 708
  records. Any archive fallback must issue **one request per range** and assert
  `206`, because the failure mode is a working answer that costs 400× too much.
- **The archive calls cloud mixing ratio `CLMR`; NOMADS calls it `CLWMR`.** Same
  parameter, different `.idx` naming, and `pick()` throws `CLWMR at 300 mb not
present in HRRR index` — which reads like a missing field rather than a
  renamed one. eccodes' `shortName` is `clwmr` on both, so only the index lookup
  needs to know.

**Correlation length decides whether a field may be drawn as a surface.**
The existing rule in `CLAUDE.md` ("do not render the grid as a continuous
field") is not "never draw surfaces" — it is _don't draw structure finer than
your sampling_. The test is the variable's correlation length versus the
sample spacing:

| Variable            | Correlation length  | 3° grid (~300 km) verdict                 |
| ------------------- | ------------------- | ----------------------------------------- |
| Cloud shape / cover | 1–50 km             | ❌ interpolation invents structure        |
| Isotherm height     | ~1000 km (synoptic) | ✅ genuinely smooth; contouring is honest |
| SLW / condensate    | 1–10 km             | ❌ at 3°; ✅ at HRRR's native 3 km        |

So the _same_ grid is legitimate for (C) and illegitimate for cloud shape, and
HRRR's 3 km field is legitimate for SLW while a sampled version of it is not.
**Ask "what is the correlation length" before drawing any new surface.**

## 6. Decisions

**Open 2026-08-12 — the cloud-top temperature layer (§G), on two counts.**
Agreed: the Band 13 raster goes once a replacement exists. Not agreed, and
deliberately not settled by the coverage measurements in §G:

1. **Whether the mask has a cold edge at all, and if so what justifies it.**
   The warm edge (−5 °C) follows from **C2** in `SENSING_STRATEGY.md` and needs
   nothing further. A cold edge is a _new_ criterion — that seeding's marginal
   benefit falls off below some cloud-top temperature — and no version of it
   appears in the design document. It needs literature, not a coverage table.
   §G lists the search plan and marks it unread. What the year-round Texas
   sample _can_ say is that every cold edge tested is expensive (−18 °C keeps
   48.7% of seedable ground against C2-alone's 92.7%) and unstable (14.2%–82.7%
   across days). That does not settle it, but it does put the burden of proof on
   adding the cutoff rather than on omitting it.
2. ~~Modelled or observed.~~ **Taken 2026-08-12 — observed**, GOES-East
   `ABI-L2-ACHP2KMC`, so the layer can falsify (B) rather than agree with it by
   construction. It is also ~10× fresher (5-minute scenes against an hourly
   analysis posted 50 minutes late), which matters on a map whose premise is
   "right now". Cost and fallback are in §G.

The cold edge is recorded rather than resolved because picking it from the
numbers alone would be inventing a criterion and then measuring it. The layer
ships with no cold cutoff in the meantime, which is the honest default: it
discards nothing, and adding a cutoff later is a one-line change to
`CLOUD_TOP.levels`.

**Taken 2026-08-12 — the seeding band is −5 to −18 °C, not −5 to −12 °C.**
Reasoning and the live PIREP evidence are in §1. What it touches: the SLW
integral reads more levels (build ~25 s → ~33 s, peak path 895 → 2,003 g/m² on
the same day), the sounding's `bandTopFt` is the −18 °C height, and a PIREP is
`inBand` up to −18 °C. The contour levels 10/50/150/400 g/m² were
**re-measured** rather than assumed to still hold: they cover 4.0% / 1.55% /
0.41% / 0.086% of CONUS under the wider band, which nests the same way the
levels were designed for, so they stand. Both edges live in `SEEDING` in
`forecast.ts`, mirrored by `BAND_WARMEST_C`/`BAND_COLDEST_C` in the app —
widening them the first time meant editing eight hardcoded strings, which is
why they are now in one place on each side.

**Taken — GRIB2 decoding: `libeccodes-tools` in the Docker image.** Shell out
to a proven binary rather than writing a decoder. Costs a system dependency in
`Dockerfiles/Dockerfile.local` and a server that depends on something outside
npm — a real exception to "minimize dependencies," accepted because it is
battle-tested and replaces ~200 lines of bit-twiddling we'd have to own. The
npm list stays at three.

> **Superseded 2026-07-16: wgrib2 → eccodes.** wgrib2 was chosen first, on the
> assumption it was a package. **It isn't** — `apt-cache policy wgrib2` returns
> no candidate and there is no Debian source package either; it would need a
> gcc/gfortran source build in the `node:latest` image. eccodes is ECMWF's
> equivalent, sits in Debian main, and installs in one line. It also removes
> work: `grib_get_data` returns lat/lon per point for HRRR's **Lambert
> Conformal** grid, so the service does no projection maths. The one loss is
> wgrib2's `-lola` regridding, replaced by block-averaging during the parse.
> (The pure-JS route stayed viable — packing is template 5.3, not JPEG2000 —
> but was not chosen.)

**Built — (B) HRRR cloud, partially.** `/map/forecast` ships HRRR **TCDC**
contoured to nested GeoJSON with an f00–f18 slider. That is the plumbing for
the SLW layer, not the SLW layer itself: swapping `TCDC` for `CLWMR` masked to
T ∈ [−12,−5] °C is now a service-level change, since the fetch/decode/contour
path is identical (`CLWMR` is in the _same_ `wrfprs` file).

**Open — which layers to build.** (A) is nearly free and answers the standing
precipitation question. (B) is the only real SLW field. (C) and (D) together
give target altitude + ground truth for a fraction of (B)'s effort.

**Standing constraint:** nothing here may depend on a local ground station.

---

### Sources

- [NWS SCN 25-89 — AIGFS/AIGEFS/HGEFS implementation](https://www.weather.gov/media/notification/pdf_2025/scn25-89_AIGFS_AIGEFS_and_HGEFS.pdf) (the authoritative variable list) · [NOAA news release](https://www.noaa.gov/news-release/noaa-deploys-new-generation-of-ai-driven-global-weather-models) · [NSF Unidata on availability](https://www.unidata.ucar.edu/news/ai-driven-global-model-output-availability)
- [NCEP office notes 521](https://doi.org/10.25923/xd3y-wy31) · [522](https://doi.org/10.25923/7kpr-5e68)
- [NOAA MRMS](https://www.nssl.noaa.gov/projects/mrms/) · [NOAA ArcGIS map services](https://mapservices.weather.noaa.gov/) · [NOMADS](https://nomads.ncep.noaa.gov/)
- [CIP/FIP (NCAR RAL)](https://ral.ucar.edu/solutions/products/icing-products-cipfip-operational) · [FAA In-Flight Icing](https://www.faa.gov/nextgen/programs/weather/awrp/ifi) · [AWC data API](https://aviationweather.gov/data/api/)
- [Open-Meteo GFS & HRRR API](https://open-meteo.com/en/docs/gfs-api) · [Upper-air via API](https://openmeteo.substack.com/p/upper-air-weather-forecasts-via-api)
- [HRRR (NOAA/GSL)](https://rapidrefresh.noaa.gov/hrrr/) · [NASA GIBS WMTS capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)
- System design: `/home/nathan/code/rainmaker/weatherman/docs/SENSING_STRATEGY.md` (C1–C7, the phase-fusion principle) · [Cloudnet](https://cloudnet.fmi.fi/)
