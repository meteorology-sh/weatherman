# eval — scoring the map against real seeding operations

Plain node scripts, outside both packages and both test suites. They talk to a
running server over HTTP, so there is nothing to build and no dependency to
install. `EVALUATION.md` at the repo root says what is being tested and why;
this says how to run it.

```bash
docker-compose up                      # or cd server && yarn dev
node eval/releases.mjs                 # ground truth  → data/releases-2025.json
node eval/counties.mjs                 # target areas  → data/counties-tx.geojson
node eval/points.mjs 2025-04-19        # per release   → out/points-<date>.json
node eval/season.mjs                   # every day     → out/season-2025.json
node eval/veto.mjs                     # observed half → out/veto-recheck.json
node eval/reconcile.mjs                # vs soundings  → out/reconcile-2025.json
node eval/bracket.mjs                  # both analyses → out/bracket-2025.json
node eval/held.mjs   2025-04-19        # every layer   → out/held-<date>.json
node eval/field.mjs  2025-04-22 21 22 23 00   # per hour → out/field-<date>.json
node eval/snowie.mjs 2017-01-20 22 23 00 01   # HRRR only → out/snowie-<date>.json
```

To look at it rather than read it, run both servers and the map:

```bash
node eval/server.mjs                   # flight record + scores, port 3100
cd eval/app && yarn dev                # the map, port 5174
```

Everything is scoped to a region — `--region=wtwma` on the harness, `/wtwma/...`
in the app. `data/regions.json` is the roster, and West Texas is the only one
with a parsed flight record so far. The rest are listed rather than hidden, so
the gap in coverage is visible; each needs its report source found and read
before anything here can be measured against it.

## What each one does

**`releases.mjs`** downloads the WTWMA daily reports listed in
`data/wtwma-2025.json`, caches the PDFs in `cache/`, and parses every flare
release into `{ at, lat, lon, glaciogenic, hygroscopic, county }`. Re-run it
after editing the parser; it re-parses from cache without touching the network.

Each report states its flare count three times — the flight table, a per-county
breakdown, and a day total. The script checks all three against each other.
**A row dropped by the parser moves the table away from both prose figures at
once, and that is a failure.** One prose figure disagreeing on its own is the
operator's arithmetic; those are printed and the table is used.

**`counties.mjs`** pulls the boundary of every county that appears in the
release list from Census TIGERweb. Keyless, one request per county.

**`points.mjs`** is the evaluation. For each release it asks
`/candidate/point` what the map said about that cell at the matching HRRR
cycle, and prints the verdict breakdown.

**`field.mjs`** asks the same question of the whole target area, hour by hour,
by sampling a lattice inside the county polygons and deduplicating by the cell
each sample resolves to. This is what a day with no releases needs.

**It always samples all 13 counties**, and splits the result into the counties
that day's aircraft worked and the rest. Sampling only the worked counties
would give a seeded day and a declined day two different denominators, and the
comparison that matters — coverage where they flew against coverage where they
did not, the same hour — cannot be read off two different footprints.

**`veto.mjs`** asks again about every verdict that rested on an observation —
the radar vetoes and the candidates — at the minute each flare actually left.
It skips the cells charged to no liquid: those are the model's own answer, and
the model resolves to the same analysis hour either way.

**`reconcile.mjs`** scores the layers against the radiosondes. Every WTWMA daily
report opens with a sounding table — Midland and Del Rio, nine indices each —
and 12Z is an HRRR analysis hour, so the freezing level, the −15 °C height and
the 700 mb temperature can be compared with no rounding on either side. It is
the only check here that does not have to argue about a clock.

Cloud base is carried and printed but not scored: the report's is a
lifted-parcel level and ours is the base of whatever deck is overhead, so a
difference is not an error. A reported freezing level at or below sea level is
dropped as a bad lift out of the PDF rather than charged to the model.

**`bracket.mjs`** asks the join at both analyses a flare sits between — 18Z and
19Z for an 1843Z release — and reports what the pair agree on. A condition
present at both ends was present across the whole gap, so the answer does not
depend on which analysis the release is charged to. Three nested tests run over
the same pair: liquid in the band, seedable cloud before the radar veto, and
seedable with the radar included. The middle one is exact because the rejection
order puts rain last, so a cell charged to `raining` passed everything before it.

`--day=2025-08-11` scores one day; `--resume` continues from what is already in
`out/bracket-2025.json`.

**`held.mjs`** builds one flying day into everything a map needs, and answers
"how near did they seed" rather than "did they seed inside". Each release is
charged to the analysis nearest its own minute — the server's own rounding rule,
so 1843Z goes to 19Z at 17 minutes rather than 18Z at 43 — and for each such
analysis it fetches all five layers the replay map draws, windows them to the
region, and measures the distance from the release to the nearest edge of each.
Inside is distance zero.

The leftover minutes are closed with HRRR's 0–6 km storm motion, sampled at the
release point and run over the signed offset to the analysis. On 19 April that
offset is 10–25 minutes and the motion 13–25 kt, so it moves a release 5–15 km —
most of a grid cell, and enough to cross a contour on its own. Both distances
are written: drifted, and undrifted for comparison.

**What "any of this layer at all" means depends on the layer**, and the script
carries a `shape` per layer for it. Nested bands stack, so the outermost contour
already contains every other one and measuring to it is measuring to the whole
layer. Disjoint bands do not — cloud base's first level is only the cloud under
6,000 ft — so those are unioned first. Measuring a disjoint layer as if it
nested silently reports the distance to one band while claiming to report the
distance to the layer.

Season verdicts are read back out of `bracket-2025.json` rather than recomputed,
so a release can be lined up against the season table. They are not what the map
draws: the sweep answers the stricter both-hours question and this page answers
distance at one.

**`server.mjs`** serves the flight record and whatever the sweeps have scored,
on port 3100. It holds no weather. **`app/`** is the map that draws it: a Vite
SPA on port 5174, one route per region, with a findings page, the sounding
comparison and the flare map under each.

The app installs nothing — `eval/app/node_modules` is a symlink to `/app`'s, and
`@` resolves to `/app/src`. That is not a packaging trick, it is the point: the
layer switches, the ramps, the band levels, the colours and the layer names are
imported from `app/src/lib/arcgis` and `app/src/app/components/panel`, so a band
that moves in Weatherman moves here. A page built to show where we disagree with
an operator must not also disagree with the app it is inspecting, and a second
install could drift a version and repaint a band.

It pulls no ArcGIS runtime. The map is SVG over rings `held.mjs` already wrote to
disk — there is no layer to load, no url to repoint and no view to keep alive.

**`snowie.mjs`** reads the liquid contour frame over the Payette basin. The
join cannot run in January 2017 — no GOES cloud top before 2023-03-23, no MRMS
before 2020-10-14 — so it reports the HRRR half and names the missing inputs
rather than working around them.

## Reproducing a published number

Everything here needs a running server and nothing else — no install, no build
step, no key. Check the server answers before starting anything long:

```bash
docker-compose up                 # or cd server && yarn dev
curl localhost:3000/healthcheck   # "Hello, world!"
```

| To get                                                    | Run                                      | Cost                |
| --------------------------------------------------------- | ---------------------------------------- | ------------------- |
| The sounding comparison and the band-overlap figure       | `node eval/reconcile.mjs`                | 68 soundings        |
| The same summary, from the run already on disk            | `node eval/reconcile.mjs --score`        | instant             |
| Every verdict, at the nearer analysis hour                | `node eval/season.mjs`                   | 33 days             |
| The observed half, re-asked at the true minute            | `node eval/veto.mjs`                     | one build per flare |
| Whether a flare sat inside a region held at both analyses | `node eval/bracket.mjs`                  | 125 builds          |
| One day of that                                           | `node eval/bracket.mjs --day=2025-08-11` | 8 builds            |
| A day drawn as a map — five layers at every analysis      | `node eval/held.mjs 2025-04-19`          | one build per hour  |

**Cost is builds, not minutes.** A cold build is 30–60 s and everything else is
milliseconds, so the honest unit is how many distinct hours a run has to
construct. `bracket.mjs` asks 994 questions but only builds 125 hours, because
every release in an hour is answered from that hour's cached scene.

`held.mjs` fetches the join first even though it draws it last. The join reads
every source the other four layers read, so building it warms all of them and
five layers cost one build per hour rather than five — on 19 April that is 51–55
seconds for the join and under a second for the rest of the hour.

**Re-scoring is separate from re-fetching.** `reconcile.mjs --score` recomputes
the whole summary — the per-reading table and the band overlap — from
`out/reconcile-2025.json` without touching the network. Any figure quoted from
this evaluation should be checkable that way; if a number cannot be re-derived
from committed output plus a flag, it is not reproducible and should not be
quoted.

**A guard belongs at scoring, not at fetching.** The sounding table is lifted
from a PDF and occasionally yields something impossible — a freezing level below
sea level. Readings like that are written to the output and dropped when scored,
so the raw lift stays inspectable and a stored sweep and a fresh one still print
the same table.

**Sweeps survive a restart.** `bracket.mjs --resume` and `season.mjs --resume`
skip days already in their output file. Run long sweeps detached, because
editing anything under `server/src` restarts nodemon and every in-flight request
dies with it:

```bash
(setsid node eval/bracket.mjs --resume > eval/out/bracket.log 2>&1 &)
```

## Things that will bite

**Cold builds cost 30–60 s each.** The archive answers one byte range per
request and a cycle is five sources. Releases are worked cycle by cycle, in
order, so each hour is built once and every later release in it is answered
from cache in milliseconds. Do not parallelise across dates — it multiplies
the builds instead of sharing them.

**The model half and the observed half do not move together.** `at` resolves
HRRR to its nearest analysis hour — 1843Z is scored against 19z, 17 minutes
away, and nothing can make that closer, because HRRR analyses once an hour. The
satellite scans every 5 minutes and the radar mosaic arrives every 2, so both
answer about 1843Z directly.

**So ask at the release, not at the hour.** Rounding the request to 19:00 pulls
the satellite and the radar to the top of the hour with it, and they move in
that time: one 19 April release reads a +9 °C liquid top and 31 dBZ at 19:00
and a −11 °C ice top and 41 dBZ at its own 1843Z. Every row carries the gap to
each of the three sources, read back off the answer rather than assumed.

The cost is that precision is not free. A scene is cached under the timestamp
asked for, so an hourly sweep builds once per cycle and shares it across every
flare in that hour, while a precise sweep builds once per flare. `season.mjs`
is hourly for that reason and `veto.mjs` is precise where it has to be.

**Two releases in the 2025 season have no coordinates.** The report gives a
time, a plane, a payload and a county and no position. They stay in the flare
totals, out of the point results, and are counted in both.

**The archive has holes.** `wrfsfc` is missing for the 20z and 04z cycles
around 2017-01-20 while `wrfprs` for those hours is fine. An hour that cannot
be built is recorded as `unbuildable` and the sweep carries on.

**Run one sweep at a time.** Two concurrent sweeps on different dates evict
each other's profile grids — the server keeps only the last few — and both
crawl while rebuilding what the other just dropped.

**`cache/` and `out/` are working files.** `data/` is the committed input:
the manifest, the parsed releases and the county polygons.
