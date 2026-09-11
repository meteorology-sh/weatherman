# eval — the evaluation harness

**Evaluate against the season** means: score every located 2025 flare
against Weatherman's own layers at that minute, re-score the 12Z balloons
against the modeled seeding band, and store JSON the eval app reads as
regional maps and tables.

Parses Texas rain-enhancement reports, scores each flare against
Weatherman's layers at that minute, and serves the comparison. The
findings are `docs/EVALUATION.md`.

| Directory | What it is                       |
| --------- | -------------------------------- |
| `cache/`  | Source reports (PDFs)            |
| `data/`   | Parsed records and region config |
| `out/`    | Scored days the eval app reads   |

None of those three is committed. A later season is a new snapshot of the
same three directories, not a change to this code.

`eval/out/` is the working score. A subset of painted days is an
incomplete run, not the season.

## What is already on disk

The 2025 flight records are in `data/`. The PDFs are in `cache/`. County
polygons are in `data/counties-tx.geojson`. **Do not re-download or
re-parse operations reports.** `releases.mjs`, `panhandle.mjs`,
`records.mjs`, `counties.mjs`, and `positions.mjs` stay idle for this
run.

`out/` holds the complete Texas season: every located flare at native
sampling with storm motion, the storm reading, and the distance to each
layer Weatherman draws, and a balloon file per program that briefs on a
sonde.

## What the eval app reads

The app does not re-score against a live Weatherman API. `server.mjs`
reads `out/` on every request.

| Result                      | File                                                     | Field                                                                                                                          |
| --------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Band overlap                | `out/balloons-*.json` (`regions.json` → `runs.balloons`) | radiosonde vs model column; **the page calculates overlap from those rows**                                                    |
| The layers Weatherman draws | `out/painted-*.json` (`runs.painted`)                    | `near.radar`, `near.echoFreeze`, `near.cloudBase`, `near.target`                                                               |
| Texas storm features        | the same painted files                                   | `storm` on each flare: in 20 dBZ, nearer the edge, upwind, echo top past freezing                                              |
| The click on each release   | the same painted files                                   | `cell`, `storm` and `column` on each flare: Fly or Don't Fly with the tests behind it, then Radar, Cloud, and Environment |

`near.target` is the Texas fly fill (`GET /candidate/target`, property
`fly`) — the fill the operator map names SEEDING OPPORTUNITY.

**The app draws the product's layers and nothing else.** Weatherman's own
panel has four switches: the fly fill, radar with three gates under it,
cloud base, and supercooled liquid water. This page carries the same four.
A layer this page drew that the product does not draw would be a claim
about a map nobody flies, so `paint.mjs` paints those five fills and
`score-season.mjs` scores those five, and nothing else.

The Panhandle has no balloon file. It briefs on a NAM column, not a sonde.

## Season job

A season is every seeded day in `data/` that has a located flare. **Done**
is a painted file for each of those days, every located flare present,
with `near` (each layer), `storm` on each
(`storm: null` means we looked and there was no 20 dBZ object), and the
click readout `cell` and `column` on each (either may be null for a
release outside the model's grid), and a balloon file for each program
that briefs on a sonde. A partial `out/`
is an incomplete run, not the season.

`paint.mjs` talks to a running Weatherman API, draws the product's own
layers at native sampling, measures distance from each flare after
storm-motion drift, and stores on the flare what a click on it would have
answered: the radar storm, the cell's FLY or DON'T FLY, and the modeled
column.

**A layer is drifted to the clock that places its edge.** Every entry in
`LAYERS` names a `clock` — `model` for the HRRR analysis hour, `radar` or
`scene` for an observation valid at the minute asked for. A fill built
from the model alone is as old as its analysis and the release is carried
to meet it; a fill whose edge is decided by an observation has already
followed the storm, and drifting it applies a correction twice. A new
layer states which it is, and a layer that gains a measured gate changes
its answer in the same edit.

```bash
node eval/paint.mjs 2025-08-04 --region=wtwma
```

`days.mjs` prints those dates:

```bash
node eval/days.mjs --region=wtwma
node eval/days.mjs
```

**Parallelism.** One Weatherman API plus one `paint.mjs` per day. Each pair
holds about 1.7 cores and 5 GiB under load, and the work is bound by cores,
not by archive bandwidth. Given a pair per flying day the whole season runs
in one wave and costs about as long as its slowest day. The queue is every
seeded day `days.mjs` prints, not a leftover list.

The API is one Node process. Painters sharing one address wait on one event
loop, so give each painter its own API on its own port and pair the two by
job slot. `{%}` is the slot number GNU `parallel` assigns:

```bash
DAYS=$(node eval/days.mjs | wc -l)
PAIRS=${PAIRS:-$DAYS}          # fewer than DAYS paints in waves

echo "start   $(date -u +%FT%TZ) UTC / $(TZ=America/Chicago date +'%F %T %Z')"
echo "box     $(nproc) vCPU, $(free -g | awk '/^Mem:/{print $2}') GiB, \
$(curl -s http://169.254.169.254/latest/meta-data/instance-type)"
echo "queued  $DAYS days, $PAIRS at a time = $(( (DAYS + PAIRS - 1) / PAIRS )) waves"

for i in $(seq 1 $PAIRS); do
  docker run -d --name wm-$i -p $((3000 + i)):3000 \
    -v /home/ubuntu/weatherman/server:/usr/src/server \
    -v /usr/src/server/node_modules \
    weatherman-weatherman-server-service:latest yarn docker
done
for i in $(seq 1 $PAIRS); do
  until curl -sf -o /dev/null http://localhost:$((3000 + i))/healthcheck; do sleep 2; done
done

# Every five minutes: days done, painters up, load, and the estimate re-derived.
( started=$(date +%s)
  while sleep 300; do
    done_n=$(tail -n +2 season.joblog 2>/dev/null | wc -l)
    mins=$(( ($(date +%s) - started) / 60 ))
    [ "$done_n" -gt 0 ] &&
      echo "[+${mins}m] $done_n/$DAYS done, $(pgrep -fc paint.mjs) painters,\
 load $(cut -d' ' -f1 /proc/loadavg), ~$(( (DAYS - done_n) * mins / done_n ))m left"
    [ "$done_n" -ge "$DAYS" ] && break
  done ) &

parallel -j $PAIRS --colsep '\t' --joblog season.joblog \
  'WEATHERMAN_SERVER=http://localhost:$((3000 + {%})) \
   node eval/paint.mjs {2} --region={1} > logs/{1}-{2}.log 2>&1' \
  :::: <(node eval/days.mjs)

echo "finished $(TZ=America/Chicago date +'%F %T %Z'), $(ls eval/out | wc -l) files"
```

Per-layer lines go to `logs/`, one file per painter, so the console
carries the season and not 116 days of ring counts.

The bare `-v /usr/src/server/node_modules` gives each container the
`node_modules` from its own image, so the bind mount over `/usr/src/server`
does not hide it. Wait for `GET /healthcheck` on every port before the
first painter starts.

Copy `out/` back; the evaluation map stays local.

Do not add a scoring script this file does not name. Do not run a second
pipeline for the band after paint: overlap is calculated from the balloon
JSON.

## Where to run the season

The season runs on an EC2 instance in **us-east-1**, the region holding the
HRRR, MRMS and GOES-19 archives. **m7i.48xlarge** (192 vCPU, 768 GiB) carries
a pair for every flying day of a 2025-sized season, which is what puts the
season under ten minutes; it needs an on-demand quota of at least 192 vCPU.
`~/aws/launch-eval-box.sh` starts one on
Ubuntu 24.04 with Docker, Node and GNU `parallel` already installed and
prints its address; the key is `~/aws/pixelbook.pem`. Terminate the instance
when the season is done — it bills by the second while it runs.

```bash
TYPE=m7i.48xlarge ~/aws/launch-eval-box.sh
ssh -i ~/aws/pixelbook.pem ubuntu@<address>
```

`data/` and `cache/` are not in git, and the reports are not re-parsed for a
season, so copy the tree up rather than cloning it:

```bash
rsync -az --exclude node_modules --exclude .git --exclude eval/out \
  -e "ssh -i ~/aws/pixelbook.pem" ./ ubuntu@<address>:weatherman/
ssh -i ~/aws/pixelbook.pem ubuntu@<address> \
  "cd weatherman && docker compose build weatherman-server-service"
```

The APIs run that image. Each painter sets its own `WEATHERMAN_SERVER`, so
nothing exports one. Cores set the worker count: a box that cannot hold a
pair per day paints the season in waves, each wave as long as its slowest
day.

A stale container that cannot find `grib_get_data` needs
`docker compose up --build`. A missing npm module after a dependency
change needs `docker compose up --build --renew-anon-volumes`.

### Paint every flying day

Start one API per painter and pair them by slot, as **Parallelism**
above shows.

Each process writes `eval/out/` under the name `regions.json` gives that
program (`painted-{date}.json`, `painted-transpecos-{date}.json`, …).
Two programs fly the same afternoon; those names must stay distinct.

A painter whose API does not answer in time stores `null` for that layer
and still writes the day, and a `null` layer reads the same as a layer
that was empty. Size is the signal: a populated day is hundreds of
kilobytes, a day of nulls is tens. Re-run that date alone.

### What a season run prints

A season is long enough that silence is indistinguishable from a hang, so
the run reports on itself. Four things, all one line each:

- **Start time**, UTC and US Central, on the first line.
- **The box**: vCPU count, total RAM, instance type. What the run was
  given decides how many waves it takes, so it is recorded next to the
  result rather than remembered.
- **An estimated run time**, from the day count and the pair count: days
  divided by pairs, rounded up, times the slowest day seen so far. It is
  a wave count times a wave, not a promise.
- **Progress every five minutes** until the last day lands: days done of
  days queued, painters still running, load average, and the estimate
  re-derived from the rate actually observed.

Nothing else. A per-layer line per painter belongs in that painter's own
log, not on the console watching the season.

### Redo the radiosondes

Four programs brief on a balloon. The Panhandle briefs on NAM and is
refused here. One process per program is enough; each ascent is one
HRRR column at 12Z.

Each ascent is its own HRRR run, so nothing is shared between them and the
work parallelises exactly. `WEATHERMAN_SERVERS` takes a comma-separated
list and the script runs one worker per address — one, because an API is a
single event loop and a second request to it only queues. Point it at the
same containers the paint used:

```bash
APIS=$(seq 1 $PAIRS | sed 's|^|http://localhost:30|' | paste -sd,)
for r in wtwma transpecos stwma plains; do
  WEATHERMAN_SERVERS=$APIS node eval/balloons.mjs --region=$r &
done
wait
```

Rows are sorted before the file is written, so a run over one API and a run
over thirty produce the same output. With a single address the script is
unchanged:

```bash
node eval/balloons.mjs --region=wtwma
```

`--resume` keeps rows already on disk. `--score` reprints from the file
with no fetch.

### Confirm, pack, copy back

```bash
node eval/verify.mjs
node eval/score-season.mjs
node eval/pack.mjs
```

`verify.mjs` requires native cell sizes for every fill this run stores,
storm motion, a storm reading and a click readout on every located flare,
and a balloon file per sonde program. It asserts those fields are
present, not that they carry a value. `score-season.mjs` prints the EVALUATION.md
tables from `out/`. `pack.mjs` writes `eval/eval-snapshot.tar.gz` after
verify passes.

Copy `out/` (or the tarball) back. The eval app and `EVALUATION.md` are
local work.

## Painted JSON

One file per program per flying day. Compact JSON. The eval app and
`score-season.mjs` read these fields:

| Key                                  | What it is                                            |
| ------------------------------------ | ----------------------------------------------------- |
| `date`, `region`, `window`, `cellKm` | which day, which program, the box, native km per fill |
| `layers[]`                           | key, name, property, unit, cellKm for each fill       |
| `frames[hour][key]`                  | contour levels at that analysis, native stairs        |
| `marks[hour]`                        | cores, heading ticks, lightning at that hour          |
| `analyses[].flares[]`                | each located flare                                    |

On each flare:

| Field                       | What it is                                                                                                                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `at`, `timeZ`, `lon`, `lat` | the release                                                                                                                                                                                                                                                                                                                   |
| `drift`, `compared`         | storm-motion offset and the drifted point                                                                                                                                                                                                                                                                                     |
| `near.<key>`                | `inside`, `km`, `kmAtRelease`, `validTime`, and `clock` / `clockTime` — which of the frame's timestamps placed that fill's edge, and what it read                                                                                                                                                                             |
| `storm`                     | `/candidate/storm` at the release, or `null`                                                                                                                                                                                                                                                                                  |
| `cell`                      | `/candidate/point` at the release minute, whole — `target` and `verdict`, the payload the column supports, merged cloud base with its source and the CCL behind it, base above ground, warm-cloud depth, 18 dBZ echo top, freezing level, rain, liquid, observed cloud-top temperature and phase — or `null` outside the grid |
| `column`                    | `/forecast/sounding` at the analysis — ground, freezing level, seeding band, the profile levels, and the `wrfsfc` diagnostics — or `null` outside the grid                                                                                                                                                                    |

**Every reading a click returns is stored on the flare and shown in a
table.** `/candidate/point` is the operator's own panel; whatever it
answers about a 3 km cell is what the evaluation gets to ask about a
release. So when a field is added to that route, it is added to `cellAt`
in `paint.mjs` and to a column in the flare tables in the same change —
a reading the map shows an operator and the evaluation quietly drops is
a reading nobody can check.

Which table it goes in follows what it is. The operator's panel is built
from `app/src/lib/readout.ts`, and the flare tables print those same
builders — the verdict, Radar, Cloud, Environment — so a figure there
reads as the figure a crew saw. Anything the panel does not print goes in
Rest of the Click, which is the evaluation's own and holds no verdicts.
A reading added to the panel is added to `readout.ts`, and reaches both.

**A field added to a route after a season is painted is not in that
season.** The painted files hold what the server answered on the day they
were written, so a new reading means a repaint before it can be quoted —
`verify.mjs` counts days and readouts, not columns, and will not catch
it. Either repaint or say plainly that the column is empty for that run.

Fills `paint.mjs` stores, all `fine=1`:

| `near` key   | Route                          | Property          | Cell |
| ------------ | ------------------------------ | ----------------- | ---- |
| `target`     | `/candidate/target`            | `fly`             | 3 km |
| `radar`      | `/radar/reflectivity`          | `reflectivity`    | 1 km |
| `echoFreeze` | `/radar/echotop/past-freezing` | `pastFreezing`    | 3 km |
| `cloudBase`  | `/candidate/cloudbase`         | `cloudBaseFt`     | 3 km |
| `liquid`     | `/forecast/liquid`             | `slwPath`         | 3 km |

Inside is inside the contour after storm-motion drift. A missing frame
for an hour drops that flare from that column's denominator.

## How the eval app drives

The app reads the files `server.mjs` serves out of `out/`. It never
re-scores against a live Weatherman API.

**The layer list is the product's list.** `eval/app/src/lib/layers.ts`
names five fills, each pointing at the legend, band table and color in
`@/lib/arcgis` — radar, echo past freezing under it, cloud base,
supercooled liquid water, and the fly fill. The nesting is the product's nesting: a gate is drawn only
while the layer it annotates is on, and the storm marks go in under the
fly fill because that is where `Map.tsx` adds them. A fill the product
stops drawing comes out of that file.

**Regional map.** One program, one painted day, that program's
county box. Flare positions as points. Layer geometry from
`frames[hour]` in the painted file — the same polygons `paint.mjs`
stored, native stairs. Radar marks (cores, heading, lightning) from
`marks`. Opening set: the fly fill alone, which is what `replay.ts` opens
with. Heading and lightning wait on their own switches under radar, as they
do there. Every fill and mark is drawn at `LAYER_OPACITY` from `bands.ts`,
the opacity the product sets on each layer.

A gate is one fill at one alpha, not a ramp. The route answers pass or
fail on a 3 km square, so shading it by a contour level would invent a
quantity.

**Tables on the program page**, in the order they are read. The counts
in blocks 1 and 3 are the arithmetic `score-season.mjs` prints:

1. The layers Weatherman draws — radar, echo past freezing, cloud base,
   supercooled liquid water, the fly fill.
2. THE FLARES — each release, inside-or-kilometers per fill.
3. Texas storm features — upwind, in 20 dBZ, nearer the edge, echo top
   past freezing, from `storm` on each flare.
4. What a click would have said, in the operator panel's order — Fly or
   Don't Fly (verdict, payload, reason, and the tests behind it), Radar,
   Cloud, and Environment — from `cell`, `storm` and `column` on each
   flare, built by the product's own `app/src/lib/readout.ts` so a figure
   there reads as the figure an operator would have read. Rest of the
   Click is the evaluation's own: the liquid verdict, HRRR's own base
   against the merged one, whether the base was drawn, the freezing level
   the echo-top test was asked against, and each source's scan minute.
   Nothing in it is a verdict.

**RADIOSONDE.** Every scored ascent from `balloons-*.json`. Overlap is
calculated in `server.mjs` from those rows, the same function
`score-season.mjs` calls. The page leads with the seeding band and calls
out the CCL separately, because that row is the cloud-base layer's
fallback height rather than a band edge.

Every measured number on that page is already on disk: the reports print
the ascent's own table and `releases.mjs` parsed it into
`data/releases-*.json` as `day.soundings[<station>]`. `balloons.mjs`
fetches only the model column to set beside it.

**Findings.** The season tables `EVALUATION.md` reprints. A subset of
days is not a season.

The tests that say whether the Texas overlay worked are the table in
`docs/INNOVATION.md` under "How we will know it worked": share of
flares on the upwind raining edge, distance to that edge versus the
core, echo top past freezing, liquid-inside as a reading, rain present
on the storm they flew.

## Scripts

| Script             | What it does                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `days.mjs`         | Print seeded days that have a located flare.                                                                                   |
| `paint.mjs`        | Score one flying day. Writes the painted file `regions.json` names.                                                            |
| `balloons.mjs`     | Compare the report sounding table to HRRR at 12Z. Writes `runs.balloons`. The app then calculates band overlap from that file. |
| `server.mjs`       | HTTP for the eval app (port 3100). Re-reads `out/` per request.                                                                |
| `releases.mjs`     | Download and parse daily reports into a flight record.                                                                         |
| `panhandle.mjs`    | Same, for the Panhandle's monthly files.                                                                                       |
| `records.mjs`      | Download a program's PDFs into `cache/` without parsing.                                                                       |
| `counties.mjs`     | Pull county polygons from TIGERweb into `data/counties-tx.geojson`.                                                            |
| `positions.mjs`    | Share of releases that land in the county their own row names.                                                                 |
| `score-season.mjs` | Print the EVALUATION.md tables from `out/`. No network.                                                                        |
| `verify.mjs`       | Is this tree a complete season? No network. Exit 1 if not.                                                                     |
| `pack.mjs`         | After `verify.mjs` passes, pack `data/`, `cache/`, `out/` to `eval/eval-snapshot.tar.gz`.                                      |

### Helpers in `lib/`

Not run on their own, except the tests.

| File                   | What it does                                                                              |
| ---------------------- | ----------------------------------------------------------------------------------------- |
| `geo.mjs`              | Project a bearing and a range onto the globe, and the distance from a point to a contour. |
| `reports.mjs`          | Parse a daily operations report.                                                          |
| `panhandle.mjs`        | Parse a Panhandle monthly report.                                                         |
| `pdf.mjs`              | Pull text out of the source PDFs.                                                         |
| `weatherman.mjs`       | Address of the Weatherman API. Ask it for the storm at a point.                           |
| `storm-score.mjs`      | Yes or no for each Texas turret feature from a storm reading.                             |
| `band-score.mjs`       | Band overlap from one balloon row. The eval app and `score-season.mjs` both call this.    |
| `tolerance.mjs`        | How far a printed position can move a release. `score-season.mjs` adds one layer cell.    |
| `storm-score.test.mjs` | Tests for the turret-feature rules.                                                       |
| `band-score.test.mjs`  | Tests for the overlap arithmetic.                                                         |
| `tolerance.test.mjs`   | Tests for the position rounding bounds.                                                   |
