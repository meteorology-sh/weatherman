# eval — comparing the map against days Texas actually flew

**The question: when an operator dropped a flare, how far was it from the
nearest edge of each layer the map paints?** Inside is a distance of zero.
Distance rather than in-or-out, because a release 3 km outside a contour and one
80 km outside are different results and "outside" calls them the same.

`EVALUATION.md` at the repo root says what came of it. This file says how the
answer is built.

Everything here is plain Node reading the Weatherman server over HTTP. There is
nothing to install, and the containers that run it are in the same
`docker-compose.yaml` as the product.

## From a web page of PDFs to a number on a map

Five Texas rain-enhancement programmes publish their flying as PDF reports on
five different websites. Each stage below turns one shape of data into the next,
writes it down, and stops. Nothing in a later stage refetches what an earlier one
already has, so a parser can be rewritten and re-run without touching the
network.

### 1. A programme → `data/regions.json`

Hand-written, one entry per programme: its name, the counties it may seed, the
box its positions have to fall inside, the balloon site its meteorologist briefs
on, and — for the two programmes that print a bearing and a range instead of a
coordinate — the point those are measured from. It also names the files every
later stage reads and writes, so nothing builds a filename out of a date.

### 2. Where the reports are → `data/<region>-2025.json`

A hand-written manifest: a `source` page, and one entry per document with its
resolved URL, the filename to keep it under, and what kind of document it is —
`daily` for one report in one file, `days` for a file holding a run of them.
The URLs are resolved rather than templated because the five hosts have five
different ideas of one: a storage bucket that serves by id, a site that serves by
file id, a Google Doc exported on request.

### 3. The documents → `cache/<region>/*.pdf`

`records.mjs` downloads what a manifest lists, skips what is already there, and
refuses anything that comes back not being a PDF. 128 files, 99 MB, never
committed. The reports never change and the sites are slow, so this is the last
time anything reaches the network for them. Delete a subdirectory and the next
run fetches it again; nothing is lost.

### 4. A PDF → text

`lib/pdf.mjs` inflates the content streams and reads the text out. **It carries
two readers and asks the document which it is** — see below, because two of the
five draw glyph numbers rather than characters and reading those the wrong way
gives pages of plausible nonsense.

### 5. Text → a flight record, `data/releases-<region>-2025.json`

`releases.mjs` for four of the programmes, `panhandle.mjs` for the fifth. This is
the stage that turns prose into data: one entry per flying day, carrying every
flare with a UTC minute and a position.

```jsonc
{
  "date": "2025-04-19",
  "seeded": true,
  "soundings": { "KMAF": { "freezingLevelM": 3661, "minus15HeightM": 5986, … } },
  "releases": [
    {
      "at": "2025-04-19T18:43:00.000Z",
      "timeZ": "1843",
      "plane": "49P",
      "located": true,
      "lat": 31.0982,
      "lon": -100.8598,
      "glaciogenic": 2,
      "hygroscopic": 0,
      "county": "Irion"
    }
  ],
  "claimed": { "Irion": { "glaciogenic": 8, "hygroscopic": 0 }, … },
  "dayTotal": { "glaciogenic": 27, "hygroscopic": 2, "clouds": 3 },
  "observations": [{ "at": "…T18:38:00.000Z", "said": "49P near cell …" }]
}
```

Each report states its flare count three times — the flight table, a per-county
breakdown, and a day total — and the parse is checked against all three. **A row
dropped by the parser moves the table away from both prose figures at once, and
that is a failure.** One prose figure disagreeing on its own is the operator's
arithmetic; those are printed, and the table is used, because it is the only one
of the three with a minute and a position on every row.

### 6. County boundaries → `data/counties-tx.geojson`

`counties.mjs` pulls the boundary of every county named anywhere in a flight
record from Census TIGERweb. Keyless, one request per county. Counties are the
unit because the reports are written in counties.

### 7. A check on the positions

`positions.mjs` asks whether each release falls inside the county its own row
names. It writes nothing — it prints a share per programme, and those shares are
what make a projected position readable at all. The two programmes that print a
latitude and a longitude agree with their own county labels 93.8% and 96.1% of
the time; that is the floor. A programme projecting a bearing and a range has to
be read against it.

### 8. A flying day → `out/painted-<region>-<date>.json`

`paint.mjs` is where the flight record meets the map. For each release it picks
the analysis hour nearest that release's own minute, fetches all five layers the
replay map draws — from the product's own routes, at the same hour parameter,
carrying the same property — windows them to the region, and measures the
distance from the release to the nearest edge of each.

```jsonc
{
  "date": "2025-04-19",
  "region": "wtwma",
  "cellKm": 12,
  "layers": [{ "key": "liquid", "name": "SUPERCOOLED LIQUID WATER", … }],
  "hours": ["2025-04-19T19:00:00.000Z", "2025-04-19T20:00:00.000Z"],
  "frames": { "2025-04-19T19:00:00.000Z": { /* the rings, per layer */ } },
  "analyses": [
    {
      "at": "2025-04-19T19:00:00.000Z",
      "flares": [
        {
          "timeZ": "1843",
          "lat": 31.0982,
          "lon": -100.8598,
          "offsetMinutes": 17,
          "drift": { "stormMotionKt": 22, "km": 11.5, "to": [-100.751, 31.144] },
          "compared": [-100.751, 31.144],
          "near": {
            "liquid": { "measuredTo": "the 10 g/m² contour",
                        "inside": false, "km": 74.6, "kmAtRelease": 66.5 }
          }
        }
      ]
    }
  ]
}
```

The leftover minutes are closed with the model's own 0–6 km storm motion,
sampled at the release point and run over the signed offset to **that layer's
valid time**. GOES and radar usually sit a couple of minutes from the flare;
HRRR still sits up to half an hour away, and that is the 5–15 km arrow the map
draws. Both distances are written: `km` after drifting, `kmAtRelease`
undrifted.

**What "any of this layer at all" means depends on the layer**, so a shape is
carried per layer. Nested contours stack, so the outermost already contains every
other and measuring to it measures the whole layer. Disjoint bands do not — cloud
base's first level is only the cloud under 6,000 ft — so those are combined
first. Measuring a disjoint layer as if it nested reports the distance to one
band while claiming to report the distance to the layer.

### 9. Two other questions over the same record

- `balloons.mjs` → `out/balloons-<region>-2025.json`. The seeding band we draw
  against the weather balloon the region briefs on: freezing level, −15 °C
  height, 700 mb temperature at 12Z.
- `between.mjs` → `out/between-2025.json`. Whether a condition was there at
  **both** analysis hours a release falls between, at **one**, or at **neither**.
  The model analyses on the hour and flares do not, so asking a single hour near
  a 1843Z release forces a choice and then reports the answer as though the
  choice were free. Asking both hours does not.

### 10. The files → a page

`server.mjs` serves the committed flight record and whatever the runs have
written, on port 3100. It holds no weather at all. `app/` is a Vite SPA on port
5174 that draws it, one route per programme — and it imports the ramps, band
levels, colours and layer names from `/app/src`, so a band that moves in
Weatherman moves here too.

**The arithmetic behind a published number lives in `server.mjs`, not in the
page**, so the app and `EVALUATION.md` cannot drift apart by computing the same
figure two ways.

## Running it

```bash
docker-compose up -d                 # all four services
curl localhost:3000/healthcheck      # "Hello, world!"
```

| Service                       | Port | What it is                      |
| ----------------------------- | ---- | ------------------------------- |
| `weatherman-server-service`   | 3000 | The product's API — every layer |
| `weatherman-app-service`      | 5173 | The product                     |
| `weatherman-eval-service`     | 3100 | The flight record and the runs  |
| `weatherman-eval-app-service` | 5174 | The evaluation map              |

A script is one `run` in the evaluation container, which already has the
Weatherman server's address in its environment:

```bash
docker-compose run --rm weatherman-eval-service node releases.mjs
docker-compose run --rm weatherman-eval-service node counties.mjs
docker-compose run --rm weatherman-eval-service node paint.mjs 2025-04-19
```

Everything is scoped to a programme — `--region=<id>` on a script, `/<id>/…` in
the app.

**The evaluation app installs its own dependencies, pinned to the versions
`/app` uses.** It resolves `@` into `/app/src` and mounts that source read-only
at the matching path, so the two trees sit side by side inside the container the
same way they do in the repo. React is named once in `vite.config.ts`
(`resolve.dedupe`) and once in `tsconfig.json` (`paths`), because the files
behind `@` are outside this app's tree and have no `node_modules` above them to
resolve it from.

## The three directories

| Directory | Committed | What is in it                                                                   |
| --------- | --------- | ------------------------------------------------------------------------------- |
| `data/`   | yes       | The manifests, the parsed flight record, the county boundaries, the region list |
| `cache/`  | no        | One subdirectory per programme, holding its 2025 reports — 128 PDFs, 99 MB      |
| `out/`    | no        | What a run wrote. `painted-<date>.json` is one flying day                       |

## The five programmes

`data/regions.json` is the list: the five rain-enhancement programmes
[TDLR lists for Texas](https://www.tdlr.texas.gov/weather/summary.htm), all five
of which have a parsed flight record. The Southern Ogallala Aquifer Rain program
is not one of them.

| Region       | 2025 records                                   | Flight record         |
| ------------ | ---------------------------------------------- | --------------------- |
| `wtwma`      | 36 daily reports                               | 34 days, 499 releases |
| `transpecos` | 48 daily reports, 8 monthly summaries          | 39 days, 472 releases |
| `panhandle`  | 6 months of operations, missions and maps      | 25 days, 255 releases |
| `stwma`      | 12 daily reports, and TDLR's run of the season | 12 days, 83 releases  |
| `plains`     | TDLR's year-to-date document                   | 7 days, 53 releases   |

```bash
docker-compose run --rm weatherman-eval-service node releases.mjs                     # West Texas
docker-compose run --rm weatherman-eval-service node releases.mjs --region=transpecos # same parser
docker-compose run --rm weatherman-eval-service node releases.mjs --region=stwma      # same parser
docker-compose run --rm weatherman-eval-service node releases.mjs --region=plains     # same parser
docker-compose run --rm weatherman-eval-service node panhandle.mjs                    # its own reader
```

**Four of the five file the same document**, because one contractor's
meteorologists write it, so one parser in `lib/reports.mjs` reads them all. What
it is told per region is in `regions.json`: which counties end a table row, which
balloon sites the indices table has columns for, the box a position has to fall
inside, and where a bearing and a range are measured from. The Panhandle files
something different enough to have its own reader in `lib/panhandle.mjs`; that is
the bar for writing another one. Every one of Trans-Pecos's 39 seeded days sums
to the flare total its own report states.

### Reading a report that draws glyphs

**Every programme's reports declare an `Identity-H` font, and two of them draw
the whole page with it.** In those the content stream holds glyph numbers rather
than characters, so the bytes have to go through the font's `ToUnicode` table
before they are text at all — reading them directly gives pages of plausible
bytes that say nothing. It also positions every glyph with its own cursor move,
so the rule that a cursor move is a space would put one between every letter; the
spaces are in the glyph stream instead, and the cursor is worth reading only for
where a line ends.

`lib/pdf.mjs` carries both readers and **asks the document which it is** rather
than guessing from its fonts. West Texas, Trans-Pecos and the Panhandle draw
between 1.5% and 4.1% of their characters with a glyph font and are read as
characters; South Texas and the Rolling Plains draw 98.7% and 100% and are read
as glyphs. Nothing in between has turned up.

The one document this cannot read is TDLR's run of the South Texas season, which
packs its page objects into a compressed object stream. It comes back empty
rather than wrong, and it holds the same twelve days as the dailies beside it.

### What differs between the five

**The Panhandle publishes a month at a time and needs its own reader**, because
three things about its report change what can be said about a release:

- **A position is a bearing and a range** — `109° @ 13 nm` — off a radar display
  whose origin the reports never name. Projected from Amarillo, 87% of the
  season's rows land inside the county their own row names; from the district
  office at White Deer, 9%. So Amarillo it is, and `regions.json` carries the
  point and that reasoning. **Whether the bearings are true or magnetic is not
  stated, and no rotation is applied.** `positions.mjs` is what that costs: as
  printed, 76.5% of Panhandle releases land in the county their row names,
  against 93.8% and 96.1% for the two programmes that print coordinates — and
  about 6° of rotation closes most of the gap, which is what a magnetic display
  would mean. At 30 nm that is 4 km, about a 3 km cell. `bearingDeg` and
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
summary and then all seven daily reports in full. `releases.mjs` splits it on the
heading each report opens with, which is the same thing the Panhandle's monthly
files need.

**It is also the one record whose positions change notation mid-season.** The
reports write `32.69NX100.47W` in May and early June and `32.36, 100.38` on 30
June and 1 July, and the second form only fits the county its own row names when
the fractional part is read as minutes — 11 of 12 rows on 30 June land in the
target area that way, against 6 read as degrees. Nothing in a row says which it
is, and a row whose fractions are both under .60 is valid either way, so **no
notation is inferred and nothing is rewritten**. What it costs is in
`positions.mjs`: 58.5% of Rolling Plains releases land in the county their own
row names, against 94% and 96% for the two programmes that write coordinates one
way all season. It is 53 releases of 1,353 and cannot move a conclusion, but it
is the number to look at first if one of its days reads oddly.

## Building another day

Every flying day of every programme is built — **116 flying days, 1,353
releases, 34 MB**. **A day is one command, and a day that already exists on disk
does not need rebuilding.**

**1. Check the Weatherman server answers.** Everything below reads from it and a
run against a dead server fails one hour at a time rather than at the start.

**2. Pick a day that has no file yet.** This prints each unbuilt flying day and
how many flares it has, most flares first:

```bash
node -e '
const { days } = require("./eval/data/releases-2025.json");
const fs = require("node:fs");
for (const day of days.filter((d) => d.seeded)) {
  if (!fs.existsSync(`eval/out/painted-${day.date}.json`)) {
    console.log(day.date, day.releases.filter((r) => r.located).length);
  }
}' | sort -k2 -rn
```

**3. Build it detached.** It is long, and editing anything under `server/src`
restarts nodemon and kills every request in flight:

```bash
docker-compose run -d --name paint-2025-08-11 \
  weatherman-eval-service node paint.mjs 2025-08-11
docker logs -f paint-2025-08-11        # …and `docker rm` it when it is done
```

Give the container a name and leave off `--rm`: a one-off `run` container is not
one `docker-compose logs` reports on, and `--rm` takes its log with it when it
exits.

**4. Read the log.** Per analysis hour it prints how many levels and rings each
of the five layers came back with and how long it took; then per flare the offset
to the analysis, the storm motion, and the distance to painted liquid; then the
day's totals and the file size.

**5. Reload the page.** Nothing needs restarting — `server.mjs` reads `out/` on
every request, so a day appears in the day picker as soon as its file lands.

**One day at a time.** Two builds at once evict each other's grids from the
Weatherman server's cache, and both crawl re-reading what the other just dropped.

**Budget one download per analysis hour, 30–60 seconds each.** A day's flares
usually fall into a handful of hours. Every flare after the first in an hour is
answered from cache in milliseconds, and the five layers cost one download
between them: `paint.mjs` asks for the seeding opportunity first, and building
that reads every source the other four need.

**When something fails it is recorded, not thrown.** A layer that fails for one
hour is written into the file with its error and the map draws the layers that
did come back. A flare whose storm motion could not be read is measured at the
release point instead, undrifted. A date with no seeded report stops the run
before it downloads anything.

**Six layer errors survive on disk**, all of them the GOES archive having no
sweep near the hour: the 19Z frame on 26 March and the 22Z and 23Z frames on 31
March, each costing that hour its cloud tops and its join. Rebuilding them
returns the same answer, so it is the archive and not the run.

**A painted file is named by its programme, not by its date.** `regions.json`
gives each one the name its runs are written under, because two programmes fly
the same afternoon — 17 August 2025 is a flying day in both West Texas and
Trans-Pecos — and a name built from the date alone lets the second run overwrite
the first.

### Where that leaves the five

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

## The band against the balloons

```bash
docker-compose run --rm weatherman-eval-service node balloons.mjs                     # West Texas   — Midland and Del Rio
docker-compose run --rm weatherman-eval-service node balloons.mjs --region=transpecos # Trans-Pecos  — Midland
docker-compose run --rm weatherman-eval-service node balloons.mjs --region=stwma      # South Texas  — Del Rio
docker-compose run --rm weatherman-eval-service node balloons.mjs --region=plains     # Rolling Plains — Midland
```

**This run needs a balloon, and one programme has none.** The Panhandle briefs on
a NAM forecast column rather than an ascent, so `--region=panhandle` refuses
rather than comparing two models and calling the agreement accuracy.

**The site is the balloon's, not the target area's**: the Rolling Plains fly 200
km from Midland and brief on Midland anyway, so Midland is where our column is
sampled. Midland also serves three programmes, so 121 scored ascents are only 101
distinct ones and the per-region rows may not be added together.

A printed band shallower than 1531 m is dropped and named rather than scored — 15
°C of cooling in less depth than that is steeper than the dry adiabatic lapse
rate, so one of the two edges is a typo and nothing in the record says which.

`balloons.mjs --score` recomputes its whole summary from the file already on disk
without touching the network. **Any figure quoted from this evaluation should be
checkable that way**; a number that cannot be re-derived from committed output
plus a flag is not reproducible and should not be quoted. `balloons.mjs --resume`
and `between.mjs --resume` skip what is already in their output file, so a long
run survives a restart.

## What to watch out for

**The model and the observations do not move together.** The model publishes one
analysis an hour, so 1843Z is compared against 19Z and nothing can make that
closer. The satellite scans every 5 minutes and the radar mosaic arrives every 2,
so both answer about 1843Z directly. Asking at the top of the hour drags them
along with the model: one 19 April release reads a +9 °C cloud top and 31 dBZ at
19:00, and a −11 °C top and 41 dBZ at its own 1843Z.

Precision is not free, though. A scene is cached under the time asked for, so an
hourly run builds once per hour and shares it across every flare in that hour,
while a to-the-minute run builds once per flare.

**Two releases in the 2025 season have no coordinates.** The report gives a time,
an aircraft, a payload and a county and no position. They stay in the flare
totals, out of the map, and are counted in both.

**The archive has holes.** `wrfsfc` is missing for the 20z and 04z cycles around
2017-01-20 while `wrfprs` for those hours is fine. An hour that cannot be built
is recorded as `unbuildable` and the run carries on.

**How far back any of this can go.** The model reaches 2014-07-30, the radar
mosaic 2020-10-14, and satellite cloud top only 2023-03-23. The satellite is the
binding one.
