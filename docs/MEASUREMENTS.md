# Measurements — what a national seedability map can and cannot know

The standing constraints on any layer this app draws: the physics and the
sampling limits that decide whether a proposed layer is honest at all.
`WEATHERMAN.md` describes what exists and what each layer claims; **read this before adding
a data source**, because most of what follows rules things out.

Product context and the C1–C7 criteria live in the system design at
`/home/nathan/code/rainmaker/weatherman` (`docs/SENSING_STRATEGY.md`). This
document is the _national-feed_ half of that strategy's §5: what the free feeds
can answer **without any local ground station**, which is the standing
constraint on everything below.

---

## 1. The one variable

Seeding does exactly one useful thing: it drops AgI into **supercooled liquid
water** so the Wegener–Bergeron–Findeisen process can convert it to
precipitation. So the map has to find:

> **cloud liquid water — not ice — at −5 to −18 °C, that isn't already raining
> itself out.**

That is `SENSING_STRATEGY` **C3 ∧ C4** (the temperature band ∧ the phase), gated
by **C6** (not already precipitating).

**The band's two edges are different kinds of number.** −5 °C is physics: silver
iodide barely nucleates ice above it. −18 °C is a judgment about where the
_supply_ of liquid thins out, because natural ice nuclei activate and take it
first; AgI itself keeps working to roughly −20 °C. Treat the warm edge as fixed
and the cold edge as a choice that a tool for _finding_ candidates should make
generously.

Both edges live in `SEEDING` in `server/src/lib/services/hrrr/slw.ts`, mirrored
by `BAND_WARMEST_C`/`BAND_COLDEST_C` in the app. Keep them there: every caption,
legend bracket and readout reads the band from one of those two places.

**"Cloud" and "seedable cloud" are almost unrelated.** GOES answers _"is there a
cloud, what shape is it, and how cold is its top"_ (C1, C2) — the top only. It
says nothing about phase or temperature _inside_ the cloud. **The gap between
the map we have and the map we want is entirely C4.**

## 2. Nothing free and national measures supercooled liquid water

| Source                             | Relationship to SLW              | Res / refresh             |
| ---------------------------------- | -------------------------------- | ------------------------- |
| Microwave radiometer + depol lidar | **measures** it                  | point, needs the station  |
| **HRRR `CLWMR`**                   | **simulates** it                 | 3 km, hourly              |
| CIP (FAA icing product)            | **fuses** model+sat+radar        | 13–20 km — no public API  |
| Icing PIREPs                       | **confirms** it, spot            | ~20 positive / 12 h CONUS |
| MODIS cloud phase / water path     | retrieves it, **cloud-top only** | 1 km, 2×/day              |
| GOES ABI cloud-top temperature     | **cannot see it** — top only, C2 | 2 km, 5 min               |
| GOES ABI cloud-top phase           | **observes** phase, top only     | 2 km, 5 min               |

**The conclusion that matters:** with no ground station we get _simulation_,
never measurement. A national map can therefore honestly show **candidate
volumes** — it cannot render a verdict. That is not a defect in the plan; it is
precisely the gap the station exists to fill, and the map's job is to tell you
where to tow it.

## 3. Correlation length decides whether a field may be drawn as a surface

The rule is not "never draw surfaces" — it is **don't draw structure finer than
your sampling**. The test is the variable's correlation length against the
sample spacing:

| Variable            | Correlation length  | On a 3° grid (~300 km)                    |
| ------------------- | ------------------- | ----------------------------------------- |
| Cloud shape / cover | 1–50 km             | ❌ interpolation invents structure        |
| SLW / condensate    | 1–10 km             | ❌ at 3°; ✅ at HRRR's native 3 km        |
| Isotherm height     | ~1000 km (synoptic) | ✅ genuinely smooth; contouring is honest |

So the _same_ grid is legitimate for isotherm height and illegitimate for cloud
shape. Averaging a finer field onto a coarser cell **removes** structure and
is fine; interpolating a coarser field onto a finer grid **invents** it and
is not. Layers here are traced at native sampling. The candidate map then
averages each 4×4 of those cells — 12 km on HRRR, 8 km on GOES, 4 km
on MRMS — and contours that coarser field; remaining corners are
rounded. Evaluation maps skip the average and keep the native stairs.
The map does not refetch while the view sits inside the window it
already asked for. Clicks still read the native grid.

The one field this average is wrong for is the seeding opportunity,
because it is a gate and not a surface: a 4×4 mean of 0 and 1 is a vote,
not a smoothing, and the fill it draws can refuse under a click inside
it. It is traced on the native cells while a native cell covers at least
a screen pixel, and averaged only past that point, where the rings it
would gain are finer than a pixel. The join samples GOES and MRMS onto
HRRR's 3 km cells rather than averaging everything to a shared 12 km
grid.

**Ask "what is the correlation length" before drawing any new surface.** A
source too sparse or irregular to pass this test may still be drawn — as
points, and only points, with no interpolation between them. GOES-East GLM
flashes are that case: 8 km pixels, 20-second granules, clustered on
storms. They are markers where a flash was, counted on a storm, never a
lightning surface.

**MRMS 18 dBZ echo-top is the height of precipitating drops, not of the
cloud.** It is taken from the same 3D reflectivity cube the mosaic is
built from: walk each column from the top down and report the highest
altitude where reflectivity still meets 18 dBZ. The field is 1 km / 2
minutes, same grid as the mosaic. Storm-scale heights have a long enough
correlation length to draw as a surface; this product does not, because
the raining cells already have a fill and a second color on the same
blobs would not show a different object. The number lives on the storm
click: feet MSL, compared to the modeled freezing level in that column.
Sentinels are the same kind as reflectivity, different values: −1 is no
18 dBZ, −3 is no radar. Units in the GRIB are kilometers. GOES still
owns the cloud top. Radar still cannot see 10 µm droplets, so a tall
18 dBZ top is not supercooled liquid and a missing one is not a quiet
candidate.

## 4. What each source can and cannot answer

**HRRR `CLWMR` is liquid by definition.** Thompson microphysics separates cloud
water from ice, snow and graupel, so cloud water at subfreezing temperature _is_
supercooled liquid water. One file answers the crux, and leaning on it is what
the operational icing product does — CIP v2.0 was updated to use "the HRRR with
respect to particle phase and supercooled liquid water forecasts."

**The band moves, so it must be found before it is read.** It sits at 425–525 mb
over Texas in July and 700–950 mb in a winter airmass, so drawing CLWMR at any
fixed level is arbitrary. Integrate over exactly the levels whose `TMP` is
inside the band at that point.

**Altitude is derived, never assumed.** `SENSING_STRATEGY.md` quotes
10,000–18,000 ft for the band, but that is what −5..−18 °C works out to _in
Central Texas convection_ — one region's temperature profile, quoted for scale.
**Nothing may be gated on that range.** Surface temperature, lapse rate, season,
latitude and terrain all move it, from the ground in a winter airmass to above
22,000 ft in a summer one. The physical quantity is the temperature; the
altitude is derived per point, per hour.

**A missing isotherm is not the same as no answer.** A column read too narrowly
and a column genuinely too cold throughout both return null. Carry the column's
base and top temperature so the two can be told apart, and read wide enough that
the band cannot escape through the ceiling. Cloud tops sit far higher than the
seeding band, so a grid built for tops must read higher than one built for the
band. Build wide, display narrow.

**HRRR extrapolates pressure levels below ground.** Without `HGT:surface` a
freezing level in Colorado reads as a real altitude when it is 2,000 ft inside a
mountain. An inversion can also cross an isotherm twice; the altitude that
matters for flying into the band is the lowest crossing.

**`PRES:cloud top` reports one deck, not the highest.** Where the analysis puts
in-band liquid above the reported top, the diagnostic is describing a low deck
under genuine multi-layer cloud. It is a small fraction of cloudy cells, but it
is the likely explanation for any cell reporting a top warmer than −5 °C while
still carrying in-band liquid. A passive radiometer almost certainly shares the
failure, since it sees whichever deck is on top.

**Observed cloud-top phase settles what temperature only makes likely.** A
colder top is likelier to have glaciated on its own, but between about −5 and
−38 °C both a supercooled top and a frozen one are physically ordinary, and the
whole seeding band sits inside that range. Cloud-top temperature therefore ranks
cloud; it cannot separate a turret that has already frozen from one that has
not. The satellite's phase classification can, and it is the only observation of
phase this product has. **It is a check on the model, never a substitute for
it** — it sees the top, and the seeding band is inside the cloud.

**The phase classification describes the highest deck, and so shares
`PRES:cloud top`'s failure exactly.** Cirrus over a growing cumulus is
classified as ice, and the cumulus underneath is invisible to it. That failure
is not evenly spread: it concentrates in the multi-layer scenes where model and
satellite are most likely to disagree in the first place, so a disagreement
under layered cloud is at least as likely to be viewing geometry as model error.
**Report the phase; never let it rule a cell out.**

**A class cannot be averaged onto a coarser grid.** The mean of ice and
supercooled is not a phase. Fold a classified field by counting instead — a cell
takes the commonest class among its cloudy pixels — and break ties toward the
colder class, so a coin toss costs a candidate its confirmation rather than
manufacturing one.

**The two ABI cloud-top products disagree about where there is cloud at all.**
Cloud-top pressure and cloud-top phase are separate retrievals over the same
pixels, and the pressure one is the more reserved: it returns a fill value
wherever the height algorithm fails to converge, and those failures concentrate
over low warm liquid cloud. Roughly two in five cells whose top the phase
product calls liquid carry no cloud-top pressure at all, against about one in
eight of the cells it calls ice and one in twenty-five of the cells it calls
supercooled. It runs one way — a cell with a cloud-top temperature is not
called clear by the phase product.

So **"the satellite sees no cloud here" is a statement about the pressure
retrieval, not about the sky.** A cell can be rejected for it while the phase
scan is describing the top of that same cloud, and both readings belong on the
panel labeled as what they are.

**Read the two products from one sweep.** ABI scans CONUS every 5 minutes and
publishes each product as its own file; the phase file lands about a minute
ahead of the pressure file, so taking each product's newest file pairs a cloud
top from one sweep with a phase from the next for about a minute in five. Five
minutes is enough for a cell's cloud to drift into its neighbor at ordinary
storm speeds and enough for a turret to glaciate, which is the change the phase
observation exists to catch. Resolve the newest sweep both products have
published and read both from it — a scan up to five minutes old beats two scans
reported as one moment.

**HRRR diagnoses a cloud base over roughly twice the ground it diagnoses a
cloud top.** Both are bitmapped fields in `wrfsfc`, and the base is the denser
of the two by a wide margin. So depth — the other half of C2 — cannot be a
national layer built from HRRR alone: it would vanish over most of the cloud the
base layer draws. Read the base from the model and the top from the satellite,
which is the same split the cloud-top layer already makes for the same reason.

**A cloud top warmer than −5 °C means the band is above the cloud entirely**, so
there is nothing inside it to seed. That is C2, it is already in the design
document, and masking those cells off is the single most useful thing a
cloud-top layer does.

**The cloud-top mask has no cold edge, and the ramp fades anyway.** These are
two different statements and the reason they can both hold is that C2 and C4
pull in opposite directions as the top gets colder.

- **C2 says colder is better.** A colder top means the band is more fully
  enclosed by cloud. On a strict reading there is no cold cutoff at all.
- **C4 says colder is worse.** Natural ice-nucleating particles are scarce at
  warm subzero temperatures — `APPLIED_PHYSICS.md` §1 puts relatively few active
  warmer than about −15 °C, with homogeneous freezing near −38 °C. So a colder
  top is likelier to have glaciated on its own, and C4's "AgI does nothing in a
  cloud that has already frozen" is exactly the resource being lost. The
  Wegener–Bergeron–Findeisen process seeding exists to trigger is the same one
  that has already run there.

Neither wins, so **neither gates**: the opacity ramp carries the tension and the
mask keeps only the warm edge. **A physical cutoff needs a citation, not a table
of coverage percentages**, and nothing here supports one — the fall-off is
gradual and the −15 °C figure is where natural nucleation becomes common, not
where seeding stops paying. Adding a cutoff is a one-line change to
`CLOUD_TOP.levels` if the literature ever supports it; the burden of proof sits
on adding it, not on leaving it out.

**The ramp is about the wrong variable, so it can only ever shade.** Cloud-top
temperature is the coldest part of the cloud, not a summary of its phase — a
vigorous cell with a −60 °C anvil can still carry supercooled liquid in the
band, and that is the cloud Texas seeds. A faint top band over bright liquid
contours is that case, not a contradiction.

**Neither layer observes phase, and §2 is why.** The supercooled-liquid contours
are HRRR's CLWMR — the model's opinion about the right variable. The cloud-top
ramp is an inference about phase from a different variable, read at one height.
Prefer the layer that is at least about the liquid, and hold it as a modeled
claim rather than a measurement: nothing free and national measures supercooled
liquid water, which is the whole reason this product fuses sources instead of
reading one.

## 5. Traps

**Radar cannot see supercooled liquid water.** Backscatter goes as d⁶, so 10 µm
cloud droplets are effectively invisible to NEXRAD — you need ~mm drops. Radar
shows precipitation that **already formed**, which is the C6 _negative_ signal:
the cloud has already converted its liquid, so seeding has no headroom. **Radar
tells you which candidates to cross off, not where to go.** Quiet air over a
cloud is no evidence about what is inside it.

**eccodes' default nodata sentinel is 9999, which is a real value in half the
fields worth reading.** It is safe for a mixing ratio and unsafe for anything in
meters: 9999 m is an ordinary cloud top, and HRRR carries real ones half again
as high. Decoding a bitmapped height field at the default reads genuine deep
convection as missing, and the symptom is cloud tops below cloud bases rather
than an error. **Name a sentinel outside the field's own physical range** —
`set missingValue` in a grib_filter rule, `-m` for `grib_get_data`.

**A bitmap is not the only way a field says "nothing here".** `RETOP` carries no
bitmap and writes −999 at the 97% of points where the model diagnoses no echo,
so the sentinel above never sees them. Check whether a new field's nodata is a
bitmap or a magic number before averaging anything.

**Not every field has a `shortName`, and some share one.** NCEP's `RETOP` decodes
as `unknown`, and cloud base and cloud top are both `gh` at level 0. Match
messages on the GRIB2 parameter identity — `parameterCategory`,
`parameterNumber`, `typeOfLevel` — which is unique where the display name is
absent or ambiguous.

**Reflectivity averages in Z, not in dBZ.** dBZ is a logarithm; the mean of 20
and 50 dBZ is not 35 dBZ of weather. Convert to Z = 10^(dBZ/10), average, and
convert back.

**MRMS distinguishes "looked and found nothing" from "no radar sees this."** The
two sentinels are opposites and about a third of the mosaic box has no coverage
at all. Drop uncovered ground from the denominator rather than averaging it in
as clear air, and report the coverage figure beside every count.

**Grids disagree about which way is up.** MRMS scans north-to-south and HRRR
south-to-north, and a contourer that reads ring orientation from signed area
will classify every exterior as a hole on a north-up grid and drop it. The
failure is quiet: stray polygons on the map while the statistics still look
right.

**The model and the sky disagree, and it is the cloud field that is wrong.**
HRRR matches observed temperature closely and reports clear air where aircraft
have been in cloud with icing. **Models nail the thermodynamic profile and are
much shakier on cloud.** That asymmetry is why the sounding is trustworthy, why
the liquid-water layer is a candidate-finder rather than a verdict, and why the
cloud-top layer takes its geometry from the satellite and only its temperature
from the model.

**Open-Meteo's `cloud_cover_*hPa` is a humidity diagnostic, not cloud.** It is a
strict monotone function of relative humidity, and Open-Meteo's own docs say so
— for HRRR it is "approximated based on relative humidity". Shipping it as a
cloud layer would be the same class of error as interpolating a 3° grid: a
picture the data never measured. Defensible as a _statistic_, never as a phase
or condensate claim.

**The NOAA AI models carry no condensate variable.** AIGFS, AIGEFS and HGEFS are
GraphCast-based and forecast dynamics and thermodynamics only — `UGRD`, `VGRD`,
`TMP`, `HGT`, `SPFH`, `VVEL` on 13 pressure levels, plus a handful of surface
fields. No cloud water, no cloud ice, no cloud fraction, not even relative
humidity. **A model with no condensate variable cannot tell you whether a cloud
is seedable, and no postprocessing recovers it, because the information was
never in the model.** They are good for isotherm heights (C3), winds (C7) and
16-day planning — a real operations product, just not a seedability one.

**The HRRR archive is not a drop-in for NOMADS, and both differences fail
quietly.** `noaa-hrrr-bdp-pds` on S3 is keyless and goes back years, which makes
it the only way to test this app in a season other than the one you are standing
in. Two things bite:

- **S3 ignores multi-range requests.** NOMADS answers 16 byte ranges with a
  `206` and a `multipart/byteranges` body, which is the trick a ~930 KB frame of
  a 390 MB file depends on. S3 returns **`200 OK` with the entire object** — not
  a 416, not an error. The identical code path silently downloads 398 MB and
  then decodes all 708 records. Any archive fallback must issue **one request
  per range and assert `206`**, because the failure mode is a correct answer
  that costs 400× too much.
- **The archive calls cloud mixing ratio `CLMR`; NOMADS calls it `CLWMR`.** Same
  parameter, different `.idx` naming, and the lookup throws as though the field
  were missing rather than renamed. eccodes' `shortName` is `clwmr` on both, so
  only the index lookup needs to know.

## 6. Measuring anything about this product

**Score over a Texas year, not over one run.** The operation is Texas and it
runs year round, so a single CONUS afternoon flatters or distorts every figure.
Sample the HRRR archive across the calendar — a day or two a month at the hour
sorties fly — and pool the cells. Texas seeding opportunity is episodic enough
that a large share of sampled days carry essentially no supercooled liquid at
all, and a single day can carry most of a year's footprint on its own. Any
number drawn from one run is an accident of that run's weather.

**Thresholds are not calibrated from coverage tables.** A cutoff whose
consequence swings several-fold with the synoptic situation is not one this data
can settle; coverage figures can say what a threshold _costs_, never whether it
is real.

---

### Sources

- [NOAA MRMS](https://www.nssl.noaa.gov/projects/mrms/) · [NOMADS](https://nomads.ncep.noaa.gov/) · [HRRR (NOAA/GSL)](https://rapidrefresh.noaa.gov/hrrr/)
- [CIP/FIP (NCAR RAL)](https://ral.ucar.edu/solutions/products/icing-products-cipfip-operational) · [FAA In-Flight Icing](https://www.faa.gov/nextgen/programs/weather/awrp/ifi) · [AWC data API](https://aviationweather.gov/data/api/)
- [NWS SCN 25-89 — AIGFS/AIGEFS/HGEFS implementation](https://www.weather.gov/media/notification/pdf_2025/scn25-89_AIGFS_AIGEFS_and_HGEFS.pdf) (the authoritative variable list)
- [Open-Meteo GFS & HRRR API](https://open-meteo.com/en/docs/gfs-api) · [NASA GIBS WMTS capabilities](https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/1.0.0/WMTSCapabilities.xml)
- [GOES-R Cloud Phase (ACTP)](https://www.goes-r.gov/products/baseline-cloud-phase.html) · [NOAA NCEI ABI L2 Cloud Top Phase](https://www.ncei.noaa.gov/access/metadata/landing-page/bin/iso?id=gov.noaa.ncdc%3AC01504)
- System design: `/home/nathan/code/rainmaker/weatherman/docs/SENSING_STRATEGY.md` (C1–C7, the phase-fusion principle) · [Cloudnet](https://cloudnet.fmi.fi/)
- Applied physics: `/home/nathan/code/rainmaker/docs/APPLIED_PHYSICS.md` §1–2 (ice-nucleating particles and their scarcity at warm subzero temperatures, the Wegener–Bergeron–Findeisen process, AgI active as warm as about −4 to −6 °C)
