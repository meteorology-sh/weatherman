# Measurements — what a national seedability map can and cannot know

**Status: decision document, not a description of the code.** Nothing in the
"candidate layers" section is built. `CLAUDE.md` describes what actually
exists (GOES imagery + the Open-Meteo cloud-cover grid); this file is the
menu we pick from next. Findings marked **[verified]** were tested live
against the real endpoint on **2026-07-16** — the rest is reasoning.

Product context and the C1–C7 criteria live in the system design at
`/home/nathan/code/rainmaker/weatherman` (`docs/SENSING_STRATEGY.md`). This
document is the *national-feed* half of that strategy's §5: what the free
feeds can answer **without any local ground station**, which is the standing
constraint on everything below.

---

## 1. The question, reduced to one variable

Seeding does exactly one useful thing: it drops AgI into **supercooled liquid
water** so the Wegener–Bergeron–Findeisen process can convert it to
precipitation. So the map has to find:

> **cloud liquid water — not ice — at −5 to −12 °C, that isn't already
> raining itself out.**

That is `SENSING_STRATEGY` **C3 ∧ C4** (the temperature band ∧ the phase),
gated by **C6** (not already precipitating). Everything below is scored on
how much of that sentence it answers.

The trap is that "cloud" and "seedable cloud" are almost unrelated. Our
current GOES imagery answers *"is there a cloud and what shape is it"* (C1,
C2). It says nothing about phase or temperature *inside* the cloud. **The
gap between the map we have and the map we want is entirely C4.**

## 2. What actually sees supercooled liquid water

The honest hierarchy. Nothing free and national **measures** SLW:

| Source | Relationship to SLW | Res / refresh | Available? |
|--------|--------------------|----------------|------------|
| Microwave radiometer + depol lidar | **measures** it | point, continuous | ❌ needs the ground station (Tier B/C, +$90k–$1M) |
| **HRRR `CLWMR`** | **simulates** it | 3 km, hourly | ✅ free, GRIB2 |
| **CIP** (FAA icing product) | **fuses** model+sat+radar+PIREP | 13–20 km, 1000 ft, hourly | ⚠️ **no public API** [verified] |
| **Icing PIREPs** | **confirms** it, spot | ~4 positive / 12 h / CONUS [verified] | ✅ free GeoJSON |
| MODIS cloud phase / water path | retrieves it, **cloud-top only** | 1 km, 2×/day | ✅ free (GIBS tiles) |
| GOES ABI (what we ship today) | **cannot see it** | 2 km, 10 min | ✅ free |

**The conclusion that matters:** with no ground station we get *simulation +
sparse confirmation*, never measurement. A national map can therefore honestly
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
- **Caveat:** see §5 — radar is a *mask*, not a detector.
- **Verdict: highest value/effort ratio on this list.**

### B. HRRR supercooled liquid water — C3 ∧ C4 (the real one)

`hrrr.tXXz.wrfprsfXX.grib2` carries **`CLWMR` on 40 pressure levels**, plus
`TMP`, `HGT`, `RWMR`, `SNMR` on the same 40 **[verified]** from the `.idx`.

```
CLWMR > threshold  ∧  TMP ∈ [−12, −5] °C   →  C3 ∧ C4
RWMR / SNMR at or below that level          →  C6
```

**`CLWMR` is liquid by definition** (Thompson microphysics separates cloud
water from ice/snow/graupel), so cloud water at subfreezing temperature *is*
supercooled liquid water. One file answers the crux.

Sizing, measured against the live NOMADS file **[verified]**:

| | |
|---|---|
| One `CLWMR` level, all 1,905,141 CONUS points | **47.6 KB** (mostly zeros; compresses superbly) |
| Packing | **template 5.3** — complex + spatial differencing, **not JPEG2000** |
| 450–700 mb × {CLWMR,TMP,HGT,RWMR,SNMR} | **14.2 MB = 3.6%** of the 390 MB file |
| Without `HGT` | ~8 MB |

`.idx` files are plain text with byte offsets, so HTTP **range requests**
fetch only the records we want. Cache 15 min against an hourly model.

- **This is not a hack.** CIP v2.0 was explicitly updated to lean on "the HRRR
  with respect to particle phase and supercooled liquid water forecasts."
  Using HRRR SLW is what the operational icing product does.
- **At 3 km this is a legitimately renderable field** — see §5's correlation-
  length rule. Unlike the 3° grid, drawing it as a surface is honest.
- **Caveat:** it is the model's *opinion*, not an observation — and §5 records
  a case where it was wrong.
- **Effort:** the big one. Needs GRIB2 decoding → **decided, see §6.**

### C. Seeding-band sounding — C3 (target altitude)

Click the map → vertical profile at that point → the 0 / −5 / −12 °C isotherm
heights. Straight from `temperature_*hPa` + `geopotential_height_*hPa` via
Open-Meteo JSON, keyless.

**[verified]** working today; at 44.26 N, −73.96 W the −5..−12 °C band sat at
600–550 mb = **14,035–16,250 ft**. Note the seasonal shift: over Central Texas
in July the band is **higher** than the design docs' 10,000–18,000 ft figure
(600 mb was still ~0 °C at 14,500 ft), so the band is not a fixed altitude and
must be computed per-day, per-target.

- Produces the design docs' "0/−5/−12 °C isotherm heights" product directly,
  which is also **the drone's target ceiling** (DRONE_DESIGN R2).
- Follows the full reference pattern end-to-end (service → router → proxy →
  client → slice → provider → component) and reuses
  `interactions.coordinates`, which already exists.
- **A point readout, not a national surface** — honest about resolution, and
  sidesteps the interpolation question entirely.
- **Temperature is the best-forecast variable there is**: it matched a real
  aircraft observation within **1.4 °C** (§5).

### D. Icing PIREPs — C4 spot truth

```
https://aviationweather.gov/api/data/pirep?format=geojson&types=ice&age=12&bbox=25,-125,50,-66
```

**[verified]** keyless GeoJSON. Fields are `icgInt1` (intensity) / `icgType1`
(type) — **not** the `icing_*` names in the OpenAPI spec. `types=ice` **does
not filter server-side**; filter client-side on `icgInt1`.

Sparse: **22 of 400** reports in 12 h over CONUS carried icing, and most were
`NEG`. But each positive one is an aircraft *confirming supercooled liquid
water at a known altitude and temperature*. Today's:

```
SLK UA /OV LKP/TM 2109/FL140/TP PC12/SK TOP 140 BASE 060/TA M05/IC LGT RIME 140
```

A Pilatus at 14,000 ft, **−5 °C, light rime** (rime *is* SLW freezing on
impact), in cloud 6,000–14,000 ft. C2 ∧ C3 ∧ C4 in one line, in July.
`icgType1` is real phase information: **RIME → small droplets; CLEAR → SLD**
(supercooled large drops).

- **Verdict:** not a map layer — a **validation overlay**. It is the only
  actual SLW observation available without a ground station, and it is what
  lets the dashboard say "the model claims a candidate here *and* an aircraft
  confirmed it."

### E. Freezing level (G-AIRMET FZLVL) — C3, cheap

`https://aviationweather.gov/api/data/gairmet?format=geojson` — **[verified]**
18 features right now, **10 of them `ZULU`/`FZLVL`** contours with a `level`
in hundreds of feet. Keyless, always-on, GeoJSON.

Gives the 0 °C surface nationally; the seeding band sits above it. Cheaper
than (C) but coarser — contours, not a profile.

### F. AIGFS / HGEFS — planning horizon, not seedability

See §4. Good for "is it worth towing the trailer to west Texas Thursday?", out
to 16 days. **Cannot contribute to C4 at all.**

### Rejected, with reasons

| Candidate | Why not |
|-----------|---------|
| **G-AIRMET icing** | Threshold-gated *hazard warning*, not a diagnosis. **[verified] zero ICE features in July** — it would be blank most of the season. FZLVL from the same feed is fine (E). |
| **CIP / FIP** | The purpose-built product, and the best thing on this list — but **[verified] no public API**: the AWC OpenAPI spec has 20 endpoints, none is CIP/FIP. NOAAPORT or scraped imagery only. Worth an email to AWC. |
| **GOES cloud phase** | **[verified] doesn't exist on GIBS.** 3,769 layers, 12 GOES (6 East, 6 West), none is a cloud product. The real GOES-R L2 `ACTP` is NetCDF from `noaa-goes19` on S3 — no tiles, needs regridding. |
| **MODIS cloud phase / water path** | On GIBS and real (`MODIS_*_Cloud_Phase_Optical_Properties`, `MODIS_*_Cloud_Water_Path`), but **cloud-top only, 2×/day**. Too stale to task a drone. Possible future context layer. |
| **Open-Meteo `cloud_cover_*hPa`** | It is a humidity field wearing a cloud label. See §5. |

**Free and unused:** GIBS carries **GOES-West** with the same 6 products we
already use from GOES-East. Better viewing geometry over the western US, and
it is the same `WebTileLayer` config we already have.

## 4. The NOAA AI models — verified output

`AIGFS`, `AIGEFS`, `HGEFS` went operational **2025-12-17** (SCN 25-89), all
three built on Google DeepMind's **GraphCast**. 0.25°, 4×/day (00/06/12/18Z),
16 days, 6-hourly. AIGEFS is 31 members; HGEFS is a 62-member hybrid grand
ensemble (31 AIGEFS + 31 GEFSv12) that beats both parents.

**Their complete output**, quoted from the service change notice:

| Scope | Fields |
|-------|--------|
| **13 pressure levels** (50, 100, 150, 200, 250, 300, 400, 500, 600, 700, 850, 925, 1000 mb) | `UGRD`, `VGRD`, `TMP`, `HGT`, `SPFH`, `VVEL` |
| **Surface** | `UGRD` 10 m, `VGRD` 10 m, `TMP` 2 m, `PRMSL`, `APCP` |

**That is the entire list. No cloud water, no cloud ice, no cloud fraction —
not even relative humidity.** GraphCast predicts dynamics and thermodynamics,
not microphysics. A model with no condensate variable cannot tell you whether
a cloud is seedable, and **no postprocessing recovers it, because the
information was never in the model.**

What they *are* good for:

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
defensible as a *statistic*, never as a phase or condensate claim.

**Radar cannot see supercooled liquid water.** Backscatter goes as d⁶, so
10 µm cloud droplets are effectively invisible to NEXRAD; you need ~mm drops.
Radar shows precipitation that **already formed** — the C6 *negative* signal
(the cloud already converted its liquid, so seeding has no headroom). **Radar
tells you which candidates to cross off, not where to go.**

**The model and the sky disagree, and it's the cloud field that's wrong.**
**[verified]** at the exact point/time of today's rime-ice PIREP, HRRR via
Open-Meteo matched the observed temperature within **1.4 °C** but reported
**clear air where the aircraft was in cloud with icing**. Models nail the
thermodynamic profile and are much shakier on cloud. That asymmetry is why
(C) is trustworthy, why (B) is a candidate-finder rather than a verdict, and
why (D) belongs on the map.

**Correlation length decides whether a field may be drawn as a surface.**
The existing rule in `CLAUDE.md` ("do not render the grid as a continuous
field") is not "never draw surfaces" — it is *don't draw structure finer than
your sampling*. The test is the variable's correlation length versus the
sample spacing:

| Variable | Correlation length | 3° grid (~300 km) verdict |
|----------|--------------------|---------------------------|
| Cloud shape / cover | 1–50 km | ❌ interpolation invents structure |
| Isotherm height | ~1000 km (synoptic) | ✅ genuinely smooth; contouring is honest |
| SLW / condensate | 1–10 km | ❌ at 3°; ✅ at HRRR's native 3 km |

So the *same* grid is legitimate for (C) and illegitimate for cloud shape, and
HRRR's 3 km field is legitimate for SLW while a sampled version of it is not.
**Ask "what is the correlation length" before drawing any new surface.**

## 6. Decisions

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
path is identical (`CLWMR` is in the *same* `wrfprs` file).

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
