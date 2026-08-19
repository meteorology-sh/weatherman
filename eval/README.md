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
[TDLR lists for Texas](https://www.tdlr.texas.gov/weather/summary.htm). West
Texas is the only one with a parsed flight record, and the rest are listed rather
than hidden so the gap in coverage is visible. Their reports are on disk — what
each one still needs is a parser for its layout.

## Building another day

This is the work that is left. **Two of the 34 flying days are built; the other
32 are the same command with a different date.**

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
what can be read out of them is read: **three of the five now have a flight
record**, and `data/regions.json` says which file each one is in.

| Region       | 2025 records                                   | Flight record                        |
| ------------ | ---------------------------------------------- | ------------------------------------ |
| `wtwma`      | 36 daily reports                               | **34 days, 499 releases**            |
| `transpecos` | 48 daily reports, 8 monthly summaries          | **39 days, 472 releases**            |
| `panhandle`  | 6 months of operations, missions and maps      | **25 days, 255 releases**            |
| `stwma`      | 12 daily reports, and TDLR's run of the season | no — needs a font-aware PDF reader   |
| `plains`     | TDLR's year-to-date document                   | no — maps and a scan, no flare table |

```bash
node eval/releases.mjs                     # West Texas
node eval/releases.mjs --region=transpecos  # Trans-Pecos, same parser
node eval/panhandle.mjs                     # the Panhandle, its own reader
```

**Trans-Pecos files the same document West Texas does** — one meteorologist
writes both — so one parser reads both, told which counties end a table row and
which sounding sites the indices table has columns for. Both come from
`regions.json`. Every one of its 39 seeded days sums to the flare total its own
report states.

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
PDF that Doc exports. The text is real text but sits in CID-keyed fonts that
`lib/pdf.mjs` reads as glyph numbers, so it needs a font-aware reader rather
than a regex. Their own page stops at 2 July 2025; TDLR publishes the rest of
the season as one document, and that one is a scan — 35 pages of JPEG, no text
at all.

**Rolling Plains has no records of its own.** The counties contract the flying to
WTWMA, and what TDLR hosts is a year-to-date set of maps rather than a flare
table. Nothing here can be scored against it.

The roster is the five projects TDLR lists. The Southern Ogallala Aquifer Rain
program is not one of them.

### What a new region still needs after its record parses

A flight record makes a region readable in the app — the roster counts it, the
day list fills in, each day carries its releases and what the operator briefed
on. It does not make it **scored**: `reconcile.mjs` and `bracket.mjs` are West
Texas's runs, and `held.mjs <date> --region=<id>` is what paints a day of any
region against the product's own layers.

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

| Script          | What it asks                                                                                       | Output                |
| --------------- | -------------------------------------------------------------------------------------------------- | --------------------- |
| `reconcile.mjs` | The layers against the weather balloons: freezing level, −15 °C height, 700 mb temperature at 12Z. | `reconcile-2025.json` |
| `bracket.mjs`   | Whether a flare sat inside a region present at _both_ analyses it falls between.                   | `bracket-2025.json`   |
| `season.mjs`    | Every release, at the nearer analysis hour.                                                        | `season-2025.json`    |
| `points.mjs`    | One day of that, printed as a breakdown.                                                           | `points-<date>.json`  |
| `veto.mjs`      | The answers that rested on an observation, re-asked at the minute the flare actually left.         | `veto-recheck.json`   |
| `field.mjs`     | The whole target area hour by hour, for a day with no releases to ask about.                       | `field-<date>.json`   |
| `snowie.mjs`    | The liquid contour over the Payette basin in January 2017, model half only.                        | `snowie-<date>.json`  |

`reconcile.mjs --score` recomputes its whole summary from the file already on
disk without touching the network. Any figure quoted from this evaluation should
be checkable that way; a number that cannot be re-derived from committed output
plus a flag is not reproducible and should not be quoted.

`bracket.mjs --resume` and `season.mjs --resume` skip days already in their
output file, so a long run survives a restart.

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
