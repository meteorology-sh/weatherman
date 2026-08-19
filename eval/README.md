# eval — comparing the map against days Texas actually flew

Plain Node scripts, outside both packages and both test suites. They talk to a
running Weatherman server over HTTP, so there is nothing to build and nothing to
install.

**The question they answer: when an operator dropped a flare, how far was it
from the nearest edge of each layer the map paints?** Inside is a distance of
zero. Distance rather than in-or-out, because a release 3 km outside a contour
and one 80 km outside are different results and "outside" calls them the same.

`EVALUATION.md` at the repo root says what came of it. This file says how to run
it.

## The three directories

| Directory | Committed | What is in it                                                                     |
| --------- | --------- | --------------------------------------------------------------------------------- |
| `data/`   | yes       | The manifests, the parsed flight record, the county boundaries, the region roster |
| `cache/`  | no        | One subdirectory per programme, holding its 2025 reports — 128 PDFs, 99 MB        |
| `out/`    | no        | What a run wrote. `held-<date>.json` is one flying day                            |

**`cache/` is downloaded, not authored.** Each programme's PDFs are fetched once
from the addresses in its `data/<region>-2025.json` manifest and kept, because
the reports never change and the sites are slow. Keeping them means a parser can
be edited and re-run against the same documents without touching the network.
Delete a subdirectory and the next run downloads it again; nothing is lost.

## Running it

```bash
docker-compose up                   # the Weatherman server, port 3000
curl localhost:3000/healthcheck     # "Hello, world!"

node eval/releases.mjs              # West Texas   → data/releases-2025.json
node eval/records.mjs               # the others   → cache/<region>/
node eval/counties.mjs              # boundaries   → data/counties-tx.geojson
node eval/held.mjs 2025-04-19       # one day      → out/held-2025-04-19.json
```

To look at it rather than read it:

```bash
node eval/server.mjs                # the flight record and the runs, port 3100
cd eval/app && yarn dev             # the map, port 5174
```

Everything is scoped to a region — `--region=wtwma` on a script, `/wtwma/…` in
the app. `data/regions.json` is the roster: the five rain-enhancement programmes
[TDLR lists for Texas](https://www.tdlr.texas.gov/weather/summary.htm), all five
of which have a parsed flight record.

## Building another day

Every flying day of every region is built. **A day is one command, and a day
that already exists on disk does not need rebuilding** — the run is the same
whether it is the first or the hundredth.

**1. Check the Weatherman server answers.** Everything below reads from it and a
run against a dead server fails one hour at a time rather than at the start.

**2. Pick a day that has no file yet.** This prints each unbuilt flying day and
how many flares it has, most flares first:

```bash
node -e '
const { days } = require("./eval/data/releases-2025.json");
const fs = require("node:fs");
for (const day of days.filter((d) => d.seeded)) {
  if (!fs.existsSync(`eval/out/held-${day.date}.json`)) {
    console.log(day.date, day.releases.filter((r) => r.located).length);
  }
}' | sort -k2 -rn
```

**3. Build it detached.** It is long, and editing anything under `server/src`
restarts nodemon and kills every request in flight:

```bash
(setsid node eval/held.mjs 2025-08-11 > eval/out/held-2025-08-11.log 2>&1 &)
tail -f eval/out/held-2025-08-11.log
```

**4. Read the log.** Per analysis hour it prints how many levels and rings each
of the five layers came back with and how long it took; then per flare the
offset to the analysis, the storm motion, and the distance to painted liquid;
then the day's totals and the file size.

**5. Reload the page.** Nothing needs restarting — `server.mjs` reads `out/` on
every request, so a day appears in the day picker as soon as its file lands.

**One day at a time.** Two builds at once evict each other's grids from the
Weatherman server's cache, and both crawl re-reading what the other just
dropped.

**Budget one download per analysis hour, 30–60 seconds each.** A day's flares
usually fall into a handful of hours. Every flare after the first in an hour is
answered from cache in milliseconds, and the five layers cost one download
between them: `held.mjs` asks for the seeding opportunity first, and building
that reads every source the other four need.

**When something fails it is recorded, not thrown.** A layer that fails for one
hour is written into the file with its error and the map draws the layers that
did come back. A flare whose storm motion could not be read is measured at the
release point instead, undrifted. A date with no seeded report in
`data/releases-2025.json` stops the run before it downloads anything.

## The other Texas programmes

`records.mjs` pulls each programme's 2025 reports into `cache/<region>/`, and
what can be read out of them is read. **All five have a flight record**, and
`data/regions.json` says which file each one is in.

| Region       | 2025 records                                   | Flight record         |
| ------------ | ---------------------------------------------- | --------------------- |
| `wtwma`      | 36 daily reports                               | 34 days, 499 releases |
| `transpecos` | 48 daily reports, 8 monthly summaries          | 39 days, 472 releases |
| `panhandle`  | 6 months of operations, missions and maps      | 25 days, 255 releases |
| `stwma`      | 12 daily reports, and TDLR's run of the season | 12 days, 83 releases  |
| `plains`     | TDLR's year-to-date document                   | 7 days, 53 releases   |

```bash
node eval/releases.mjs                     # West Texas
node eval/releases.mjs --region=transpecos # Trans-Pecos, same parser
node eval/releases.mjs --region=stwma      # South Texas, same parser
node eval/releases.mjs --region=plains     # Rolling Plains, same parser
node eval/panhandle.mjs                    # the Panhandle, its own reader
```

**Four of the five file the same document**, because one contractor's
meteorologists write it, so one parser in `lib/reports.mjs` reads them all. What
it is told per region is in `regions.json`: which counties end a table row,
which sounding sites the indices table has columns for, the window a position
has to fall inside, and where a bearing and a range are measured from. Every one
of Trans-Pecos's 39 seeded days sums to the flare total its own report states.

### Reading a report that draws glyphs

**Every programme's reports declare an `Identity-H` font, and two of them draw
the whole page with it.** In those the content stream holds glyph numbers rather
than characters, so the bytes have to go through the font's `ToUnicode` table
before they are text at all — reading them directly gives pages of plausible
bytes that say nothing. It also positions every glyph with its own cursor move,
so the rule that a cursor move is a space would put one between every letter;
the spaces are in the glyph stream instead, and the cursor is worth reading only
for where a line ends.

`lib/pdf.mjs` carries both readers and **asks the document which it is** rather
than guessing from its fonts. West Texas, Trans-Pecos and the Panhandle draw
between 1.5% and 4.1% of their characters with a glyph font and are read as
characters; South Texas and the Rolling Plains draw 98.7% and 100% and are read
as glyphs. Nothing in between has turned up.

The one document this cannot read is TDLR's run of the South Texas season, which
packs its page objects into a compressed object stream. It comes back empty
rather than wrong, and it holds the same twelve days as the dailies beside it.

### What differs between the four

**The Panhandle publishes a month at a time and needs its own reader**, because
three things about its report change what can be said about a release:

- **A position is a bearing and a range** — `109° @ 13 nm` — off a radar display
  whose origin the reports never name. Projected from Amarillo, 87% of the
  season's rows land inside the county their own row names; from the district
  office at White Deer, 9%. So Amarillo it is, and `regions.json` carries the
  point and that reasoning. **Whether the bearings are true or magnetic is not
  stated, and no rotation is applied.** `registration.mjs` is what that costs:
  as printed, 76.5% of Panhandle releases land in the county their row names,
  against 93.8% and 96.1% for the two programmes that print coordinates — and
  about 6° of rotation closes most of the gap, which is what a magnetic display
  would mean. At 30 nm that is 4 km, under half a 12 km cell. `bearingDeg` and
  `rangeNm` stay on every release so the projection can be redone from the
  source.
- **Flare counts are per day, not per release.** The flight table says a flare
  was released and never how many, so the count comes from the monthly
  operations report and a release carries `null`.
- **The indices are a model forecast** — the 12Z NAM valid at 21Z over Amarillo
  — rather than a balloon ascent, and its column stops at −10 °C. They say what
  the meteorologist planned against. **Nothing may be checked against them the
  way the West Texas band is checked against the balloons.**

The district's own April missions file is missing the 30 April report its own
operations report lists. `panhandle.mjs` prints that rather than passing over it.

**South Texas writes each day as a Google Doc**, and `records.mjs` fetches the
PDF that Doc exports. Its table prints one row per seeding pass with no flare
count on it, so a release carries `null` the way a Panhandle one does and the
counts come from the closing sentence. **Its positions are a bearing and a range
too**, from April on, off an origin the reports never name — projected from
Pleasanton, the town the reports head themselves with, 76.9% of radial rows land
in the county their own row names, against 64.1% from the municipal airport four
kilometres away and under 2% from San Antonio, Hondo or any of the three nearest
radars. Bearings are used as printed here as well. That six degrees of eastward
rotation helps both programmes and neither states its convention is the whole of
what is known.

**Rolling Plains publishes one document a season**, holding a monthly flight
summary and then all seven daily reports in full. `releases.mjs` splits it on
the heading each report opens with, which is the same thing the Panhandle's
monthly files need.

**It is also the one record whose positions change notation mid-season.** The
reports write `32.69NX100.47W` in May and early June and `32.36, 100.38` on 30
June and 1 July, and the second form only fits the county its own row names when
the fractional part is read as minutes — 11 of 12 rows on 30 June land in the
target area that way, against 6 read as degrees. Nothing in a row says which it
is, and a row whose fractions are both under .60 is valid either way, so **no
notation is inferred and nothing is rewritten**. What it costs is in
`registration.mjs`: 58.5% of Rolling Plains releases land in the county their
own row names, against 94% and 96% for the two programmes that write coordinates
one way all season. It is 53 releases of 1,353 and cannot move a conclusion, but
it is the number to look at first if one of its days reads oddly.

The roster is the five projects TDLR lists. The Southern Ogallala Aquifer Rain
program is not one of them.

### What a new region still needs after its record parses

A flight record makes a region readable in the app — the roster counts it, the
day list fills in, each day carries its releases and what the operator briefed
on. `held.mjs <date> --region=<id>` is what paints a day of any region against
the product's own layers, and `reconcile.mjs --region=<id>` is what checks the
seeding band against the balloon that region briefs on. `bracket.mjs` is still
West Texas's alone.

Every flying day of all five is painted — **116 flying days, 1,353 releases,
34 MB** — which is what puts the flight record and the layers on the same map:

| Region         | Days painted | Releases | In painted liquid | Within a cell |
| -------------- | -----------: | -------: | ----------------: | ------------: |
| West Texas     |     34 of 34 |      497 |             14.9% |         36.0% |
| Trans-Pecos    |     38 of 38 |      465 |             19.6% |         49.2% |
| Panhandle      |     25 of 25 |      255 |             34.1% |         75.0% |
| South Texas    |     12 of 12 |       83 |             13.0% |         48.1% |
| Rolling Plains |       7 of 7 |       53 |             16.7% |         56.3% |

Cloud base lands within a cell of 88% to 98% of releases in all five and cloud
tops 87% to 95%. The liquid is where they part, and the spread is the finding —
the median release is 34 km from painted liquid in West Texas and 4 km in the
Panhandle. Counted by day, which is the honest unit because a sortie succeeds or
fails as one thing, that is 10 of 34 days against 15 of 23. `EVALUATION.md` is
where it is argued, including why the airmass explanation that fitted the first
three programmes does not survive the other two.

**Six layer errors survive on disk**, all of them the GOES archive having no
sweep near the hour: the 19Z frame on 26 March and the 22Z and 23Z frames on 31
March, each costing that hour its cloud tops and its join. Rebuilding them
returns the same answer, so it is the archive and not the run. The day keeps its
other layers and the map draws what came back.

**A painted file is named by its region, not by its date.** `regions.json` gives
each region the name its runs are written under, because two programmes fly the
same afternoon — 17 August 2025 is a flying day in both West Texas and
Trans-Pecos — and a name built from the date alone lets the second run overwrite
the first.

## What each script does

These four are the current path:

**`releases.mjs`** downloads the daily reports its region's manifest lists,
caches them, and parses every flare release into
`{ at, lat, lon, glaciogenic, hygroscopic, county }`. West Texas by default,
`--region=transpecos` for the other programme that files the same document. Each report states its
flare count three times — the flight table, a per-county breakdown, and a day
total — and the script checks all three against each other. **A row dropped by
the parser moves the table away from both prose figures at once, and that is a
failure.** One prose figure disagreeing on its own is the operator's arithmetic;
those are printed, and the table is used.

**`counties.mjs`** pulls the boundary of every county that appears in the
release list from Census TIGERweb. Keyless, one request per county.

**`records.mjs`** downloads every programme's 2025 reports into
`cache/<region>/`, one manifest per region, skipping what is already there and
refusing anything that comes back not being a PDF. It fetches and stops there.

**`registration.mjs`** checks every parsed release against the county its own
row names, using the boundaries `counties.mjs` fetched. The two programmes that
print coordinates are the noise floor — how often an operator's county label and
an operator's position disagree at all — and the Panhandle's projected positions
mean nothing without them to read against.

**`panhandle.mjs`** reads the Panhandle district's monthly mission files into
`data/releases-panhandle-2025.json`, taking each day's flare count from the
monthly operations report because the flight table carries none, and projecting
each bearing and range from the origin in `regions.json`.

**`held.mjs`** builds one flying day into everything the map needs. Each release
is charged to the analysis nearest its own minute, by the server's own rounding
rule — 1843Z goes to 19Z at 17 minutes, not to 18Z at 43 — and for each such
analysis it fetches all five layers the replay map draws, windows them to the
region, and measures the distance from the release to the nearest edge of each.

The leftover minutes are closed with the model's 0–6 km storm motion, sampled at
the release point and run over the signed offset to the analysis. On 19 April
that offset is 10–25 minutes and the motion 13–25 kt, so it carries a release
5–15 km — most of a 12 km grid cell, and enough to cross a contour on its own.
Both distances are written, drifted and undrifted.

**What "any of this layer at all" means depends on the layer**, so the script
carries a shape per layer. Nested contours stack, so the outermost one already
contains every other and measuring to it measures the whole layer. Disjoint
bands do not — cloud base's first level is only the cloud under 6,000 ft — so
those are combined first. Measuring a disjoint layer as if it nested reports the
distance to one band while claiming to report the distance to the layer.

**`server.mjs`** serves the flight record and whatever the runs have written, on
port 3100. It holds no weather. **`app/`** is the map that draws it: a Vite SPA
on port 5174, one route per region.

The app installs nothing — `eval/app/node_modules` is a symlink to `/app`'s, and
`@` resolves to `/app/src`. That is the point rather than a packaging trick: the
layer switches, the ramps, the band levels, the colours and the layer names are
imported from `app/src/lib/arcgis` and `app/src/app/components/panel`, so a band
that moves in Weatherman moves here too. A second install could drift a version
and repaint a band. It pulls no ArcGIS runtime; the map is SVG over rings
`held.mjs` already wrote to disk.

### Earlier runs

These answered the in-or-out question that came before the distance one.
`EVALUATION.md` quotes their numbers, and their output is on disk in `out/`.

| Script          | What it asks                                                                                                            | Output                         |
| --------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `reconcile.mjs` | The seeding band against the weather balloons: freezing level, −15 °C height, 700 mb temperature at 12Z. Region-scoped. | `reconcile-<region>-2025.json` |
| `bracket.mjs`   | Whether a flare sat inside a region present at _both_ analyses it falls between.                                        | `bracket-2025.json`            |
| `season.mjs`    | Every release, at the nearer analysis hour.                                                                             | `season-2025.json`             |
| `points.mjs`    | One day of that, printed as a breakdown.                                                                                | `points-<date>.json`           |
| `veto.mjs`      | The answers that rested on an observation, re-asked at the minute the flare actually left.                              | `veto-recheck.json`            |
| `field.mjs`     | The whole target area hour by hour, for a day with no releases to ask about.                                            | `field-<date>.json`            |
| `snowie.mjs`    | The liquid contour over the Payette basin in January 2017, model half only.                                             | `snowie-<date>.json`           |

`reconcile.mjs --score` recomputes its whole summary from the file already on
disk without touching the network. Any figure quoted from this evaluation should
be checkable that way; a number that cannot be re-derived from committed output
plus a flag is not reproducible and should not be quoted.

`bracket.mjs --resume`, `season.mjs --resume` and `reconcile.mjs --resume` skip
what is already in their output file, so a long run survives a restart.

**The seeding band run needs a balloon, and one region has none.**

```bash
node eval/reconcile.mjs                       # West Texas   — Midland and Del Rio
node eval/reconcile.mjs --region=transpecos   # Trans-Pecos  — Midland
node eval/reconcile.mjs --region=stwma        # South Texas  — Del Rio
node eval/reconcile.mjs --region=plains       # Rolling Plains — Midland
```

The Panhandle briefs on a NAM forecast column rather than an ascent, so
`--region=panhandle` refuses rather than comparing two models and calling the
agreement accuracy. **The site is the balloon's, not the target area's**: the
Rolling Plains fly 200 km from Midland and brief on Midland anyway, so Midland
is where our column is sampled. Midland also serves three programmes, so 121
scored ascents are only 101 distinct ones and the per-region rows may not be
added together.

A printed band shallower than 1531 m is dropped and named rather than scored —
15 °C of cooling in less depth than that is steeper than the dry adiabatic lapse
rate, so one of the two edges is a typo and nothing in the record says which.

## What to watch out for

**The model and the observations do not move together.** The model publishes one
analysis an hour, so 1843Z is compared against 19Z and nothing can make that
closer. The satellite scans every 5 minutes and the radar mosaic arrives every
2, so both answer about 1843Z directly. Asking at the top of the hour drags them
along with the model: one 19 April release reads a +9 °C cloud top and 31 dBZ at
19:00, and a −11 °C top and 41 dBZ at its own 1843Z.

Precision is not free, though. A scene is cached under the time asked for, so an
hourly run builds once per hour and shares it across every flare in that hour,
while a to-the-minute run builds once per flare. `season.mjs` is hourly for that
reason and `veto.mjs` is to-the-minute where it has to be.

**Two releases in the 2025 season have no coordinates.** The report gives a time,
an aircraft, a payload and a county and no position. They stay in the flare
totals, out of the map, and are counted in both.

**The archive has holes.** `wrfsfc` is missing for the 20z and 04z cycles around
2017-01-20 while `wrfprs` for those hours is fine. An hour that cannot be built
is recorded as `unbuildable` and the run carries on.

**How far back any of this can go.** The model reaches 2014-07-30, the radar
mosaic 2020-10-14, and satellite cloud top only 2023-03-23. The satellite is the
binding one, which is why `snowie.mjs` reports the model half over Idaho in 2017
and names the missing inputs rather than working around them.
