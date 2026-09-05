# eval — the evaluation harness

Parses Texas rain-enhancement reports, scores each flare against Weatherman's
layers at that minute, and serves the comparison. The findings are
`docs/EVALUATION.md`.

| Directory | What it is |
| --------- | ---------- |
| `cache/`  | Source reports (PDFs) |
| `data/`   | Parsed records and region config |
| `out/`    | Scored days the eval app reads |

None of those three is committed. A later season is a new snapshot of the
same three directories, not a change to this code.

## What the eval app reads

The app does not re-score against a live Weatherman API. `server.mjs` reads
`out/` on every request.

| Result | File | Field |
| ------ | ---- | ----- |
| Band overlap | `out/balloons-*.json` (`regions.json` → `runs.balloons`) | radiosonde vs model column; **the page calculates overlap from those rows** |
| Original Weatherman layers | `out/painted-*.json` (`runs.painted`) | `near.cloudBase`, `near.radar`, `near.liquid`, `near.candidate` (and `near.cloudTop`) |
| Texas turret features | the same painted files | `storm` on each flare: in 20 dBZ, nearer the edge, upwind, echo top past freezing |

The Panhandle has no balloon file. It briefs on a NAM column, not a sonde.

## Season job

A season is every seeded day in `data/` that has a located flare. **Done**
is a painted file for each of those days, every located flare present, with
`near` and `storm` on each (`storm: null` means we looked and there was no
20 dBZ object). A partial `out/` is an incomplete run, not the season.

The live scoring command is `paint.mjs`. It talks to a running Weatherman
API, draws the product's own layers at native sampling, measures distance
from each flare after storm-motion drift, and stores the radar-storm
reading on the flare.

```bash
node eval/paint.mjs 2025-08-04 --region=wtwma
```

**Parallelism.** One Weatherman API plus one `paint.mjs` per day. Size the
worker count from the box: about 4.5 GiB and 1.5–2 cores each. On 32 vCPU /
123 GiB that is about sixteen days at once, not six. The queue is every
seeded day, not a leftover list.

Copy `out/` back; the evaluation map stays local.

Do not add a scoring script this file does not name. Do not run a second
pipeline for the band after paint: overlap is calculated from the balloon
JSON.

## Scripts

| Script | What it does |
| ------ | ------------ |
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

## Parsing a new programme

```bash
node eval/records.mjs --region=wtwma
node eval/releases.mjs --region=wtwma
node eval/panhandle.mjs
node eval/counties.mjs
node eval/positions.mjs
```

## Where to run the season

The season build belongs on a machine with good CPU, close to the NOAA
archives (**us-east-1**). Copy `eval/out/` back.
