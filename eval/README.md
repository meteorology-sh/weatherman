# eval — the evaluation harness

**Evaluate against the season** means: score every located 2025 flare
against Weatherman's own layers at that minute, re-score the 12Z balloons
against the modelled seeding band, and store JSON the eval app reads as
regional maps and tables.

Parses Texas rain-enhancement reports, scores each flare against
Weatherman's layers at that minute, and serves the comparison. The
findings are `docs/EVALUATION.md`.

| Directory | What it is |
| --------- | ---------- |
| `cache/`  | Source reports (PDFs) |
| `data/`   | Parsed records and region config |
| `out/`    | Scored days the eval app reads |

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

The files in `out/` today are the quiet-liquid season. This run replaces
them: the same flares, native sampling, storm motion, and storm reading,
plus the Texas fly fill, the Comptroller window, and echo past freezing,
and a fresh balloon file per programme that briefs on a sonde.

## What the eval app reads

The app does not re-score against a live Weatherman API. `server.mjs`
reads `out/` on every request.

| Result | File | Field |
| ------ | ---- | ----- |
| Band overlap | `out/balloons-*.json` (`regions.json` → `runs.balloons`) | radiosonde vs model column; **the page calculates overlap from those rows** |
| Original Weatherman layers | `out/painted-*.json` (`runs.painted`) | `near.cloudBase`, `near.cloudTop`, `near.radar`, `near.liquid`, `near.candidate` |
| Texas fills | the same painted files | `near.target` (Texas fly fill), `near.baseWindow`, `near.echoFreeze` |
| Texas storm features | the same painted files | `storm` on each flare: in 20 dBZ, nearer the edge, upwind, echo top past freezing |

`near.candidate` is the quiet-liquid join (`GET /candidate/field`,
property `seedableSlwPath`). `near.target` is the Texas fly fill
(`GET /candidate/target`, property `fly`) — the fill the operator map
names SEEDING OPPORTUNITY.

The Panhandle has no balloon file. It briefs on a NAM column, not a sonde.

## Season job

A season is every seeded day in `data/` that has a located flare. **Done**
is a painted file for each of those days, every located flare present,
with `near` (original layers and Texas fills) and `storm` on each
(`storm: null` means we looked and there was no 20 dBZ object), and a
balloon file for each programme that briefs on a sonde. A partial `out/`
is an incomplete run, not the season.

`paint.mjs` talks to a running Weatherman API, draws the product's own
layers at native sampling, measures distance from each flare after
storm-motion drift, and stores the radar-storm reading on the flare.

```bash
node eval/paint.mjs 2025-08-04 --region=wtwma
```

`days.mjs` prints those dates:

```bash
node eval/days.mjs --region=wtwma
node eval/days.mjs
```

**Parallelism.** One Weatherman API plus one `paint.mjs` per day. Size the
worker count from the box: about 4.5 GiB and 1.5–2 cores each. On 32 vCPU
/ 123 GiB that is about sixteen days at once. The queue is every seeded
day `days.mjs` prints, not a leftover list.

Copy `out/` back; the evaluation map stays local.

Do not add a scoring script this file does not name. Do not run a second
pipeline for the band after paint: overlap is calculated from the balloon
JSON.

## Where to run the season

The season build belongs on a machine with good CPU, close to the NOAA
archives (**us-east-1**). SSH into that box. The Weatherman server must
be running there; `paint.mjs` and `balloons.mjs` fetch its routes.

```bash
ssh <user>@<us-east-1-box>
cd weatherman
git fetch && git checkout texas && git pull
docker compose up -d weatherman-server-service
# wait until GET /healthcheck returns 200
export WEATHERMAN_SERVER=http://localhost:3000
```

A stale container that cannot find `grib_get_data` needs
`docker compose up --build`. A missing npm module after a dependency
change needs `docker compose up --build --renew-anon-volumes`.

### Paint every flying day

Keep about sixteen `paint.mjs` processes at a time. GNU `parallel` or
`xargs -P` is enough:

```bash
while IFS=$'\t' read -r region date; do
  echo "$region $date"
done < <(node eval/days.mjs) \
  | xargs -P 16 -n 2 sh -c 'node eval/paint.mjs "$1" --region="$0"'
```

Each process writes `eval/out/` under the name `regions.json` gives that
programme (`painted-{date}.json`, `painted-transpecos-{date}.json`, …).
Two programmes fly the same afternoon; those names must stay distinct.

A day that fails (timeout, 500, archive miss) leaves no file or a file
`verify.mjs` will refuse. Re-run that date alone.

### Redo the radiosondes

Four programmes brief on a balloon. The Panhandle briefs on NAM and is
refused here. One process per programme is enough; each ascent is one
HRRR column at 12Z.

```bash
node eval/balloons.mjs --region=wtwma
node eval/balloons.mjs --region=transpecos
node eval/balloons.mjs --region=stwma
node eval/balloons.mjs --region=plains
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
storm motion and a storm reading on every located flare, and a balloon
file per sonde programme. `score-season.mjs` prints the EVALUATION.md
tables from `out/`. `pack.mjs` writes `eval/eval-snapshot.tar.gz` after
verify passes.

Copy `out/` (or the tarball) back. The eval app and `EVALUATION.md` are
local work.

## Painted JSON

One file per programme per flying day. Compact JSON. The eval app and
`score-season.mjs` read these fields:

| Key | What it is |
| --- | ---------- |
| `date`, `region`, `window`, `cellKm` | which day, which programme, the box, native km per fill |
| `layers[]` | key, name, property, unit, cellKm for each fill |
| `frames[hour][key]` | contour levels at that analysis, native stairs |
| `marks[hour]` | cores, heading ticks, lightning at that hour |
| `analyses[].flares[]` | each located flare |

On each flare:

| Field | What it is |
| ----- | ---------- |
| `at`, `timeZ`, `lon`, `lat` | the release |
| `drift`, `compared` | storm-motion offset and the drifted point |
| `near.<key>` | `inside`, `km`, `kmAtRelease`, `validTime` for that fill |
| `storm` | `/candidate/storm` at the release, or `null` |

Fills `paint.mjs` stores, all `fine=1`:

| `near` key | Route | Property | Cell |
| ---------- | ----- | -------- | ---- |
| `cloudBase` | `/forecast/cloudbase` | `cloudBaseFt` | 3 km |
| `cloudTop` | `/cloudtop/temperature` | `topColdnessC` | 2 km |
| `liquid` | `/forecast/liquid` | `slwPath` | 3 km |
| `radar` | `/radar/reflectivity` | `reflectivity` | 1 km |
| `candidate` | `/candidate/field` | `seedableSlwPath` | 3 km |
| `target` | `/candidate/target` | `fly` | 3 km |
| `baseWindow` | `/forecast/cloudbase/window` | `inWindow` | 3 km |
| `echoFreeze` | `/radar/echotop/past-freezing` | `pastFreezing` | 3 km |

Inside is inside the contour after storm-motion drift. A missing frame
for an hour drops that flare from that column's denominator.

## How the eval app should drive

Do not change the eval app in this run. After `out/` is complete, the
app should read those files the way `server.mjs` already serves them,
and add the Texas fills next to the layers it already draws.

**Regional map.** One programme, one painted day, that programme's
county box. Flare positions as points. Layer geometry from
`frames[hour]` in the painted file — the same polygons `paint.mjs`
stored, native stairs. Switches for the original five fills and for
`target`, `baseWindow`, and `echoFreeze`. Radar marks (cores, heading,
lightning) from `marks`. Opening set: radar, Texas fly fill (`target`),
quiet-liquid join (`candidate`) available as a switch.

**Tables on the programme page.** Four blocks, same arithmetic as
`score-season.mjs`:

1. Original Weatherman layers — cloud base, cloud tops, radar,
   supercooled liquid, quiet-liquid join.
2. Texas fills — fly fill, Comptroller window, echo past freezing.
3. Texas storm features — upwind, in 20 dBZ, nearer the edge, echo top
   past freezing, from `storm` on each flare.
4. THE FLARES — each release, inside-or-kilometres per fill, and the
   four storm features.

**THE BAND.** Every scored ascent from `balloons-*.json`. Overlap is
calculated in `server.mjs` from those rows, the same function
`score-season.mjs` calls.

**Findings.** The season tables `EVALUATION.md` reprints. A subset of
days is not a season.

The tests that say whether the Texas overlay worked are the table in
`docs/INNOVATION.md` under "How we will know it worked": share of
flares on the upwind raining edge, distance to that edge versus the
core, echo top past freezing, liquid-inside as a reading, rain present
on the storm they flew.

## Scripts

| Script | What it does |
| ------ | ------------ |
| `days.mjs` | Print seeded days that have a located flare. |
| `paint.mjs` | Score one flying day. Writes the painted file `regions.json` names. |
| `balloons.mjs` | Compare the report sounding table to HRRR at 12Z. Writes `runs.balloons`. The app then calculates band overlap from that file. |
| `server.mjs` | HTTP for the eval app (port 3100). Re-reads `out/` per request. |
| `releases.mjs` | Download and parse daily reports into a flight record. |
| `panhandle.mjs` | Same, for the Panhandle's monthly files. |
| `records.mjs` | Download a programme's PDFs into `cache/` without parsing. |
| `counties.mjs` | Pull county polygons from TIGERweb into `data/counties-tx.geojson`. |
| `positions.mjs` | Share of releases that land in the county their own row names. |
| `score-season.mjs` | Print the EVALUATION.md tables from `out/`. No network. |
| `verify.mjs` | Is this tree a complete season? No network. Exit 1 if not. |
| `pack.mjs` | After `verify.mjs` passes, pack `data/`, `cache/`, `out/` to `eval/eval-snapshot.tar.gz`. |

### Helpers in `lib/`

Not run on their own, except the tests.

| File | What it does |
| ---- | ------------ |
| `geo.mjs` | Project a bearing and a range onto the globe, and the distance from a point to a contour. |
| `reports.mjs` | Parse a daily operations report. |
| `panhandle.mjs` | Parse a Panhandle monthly report. |
| `pdf.mjs` | Pull text out of the source PDFs. |
| `weatherman.mjs` | Address of the Weatherman API. Ask it for the storm at a point. |
| `storm-score.mjs` | Yes or no for each Texas turret feature from a storm reading. |
| `band-score.mjs` | Band overlap from one balloon row. The eval app and `score-season.mjs` both call this. |
| `storm-score.test.mjs` | Tests for the turret-feature rules. |
| `band-score.test.mjs` | Tests for the overlap arithmetic. |
