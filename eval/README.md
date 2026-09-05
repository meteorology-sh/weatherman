# eval — the evaluation harness

Parses Texas rain-enhancement reports, scores each flare against Weatherman's
layers at that minute, and serves the comparison. The findings are
`docs/EVALUATION.md`.

The 2025 snapshot — reports, parsed records, and scored days — is the GitHub
release `eval-2025-v1`. The harness code stays in git. From the repository
root:

```bash
gh release download eval-2025-v1 -p eval-2025-v1.tar.gz
tar -xzf eval-2025-v1.tar.gz
```

| Directory | What it is                                       |
| --------- | ------------------------------------------------ |
| `cache/`  | Source reports (PDFs)                            |
| `data/`   | Parsed records and region config for that season |
| `out/`    | Comparison to Weatherman's layers                |

A later season can change formats, counties, or programmes. That is a new
snapshot, not a change to this code.

## Scoring the Texas-target join

`target.mjs` asks the 2025 flares the Texas question, at both hours around
each release, and writes how much of each programme window the join selected.
The Weatherman server has to be running; the script talks to
`/candidate/point` and `/candidate/target/stats`. It does not paint geometry.

```bash
node eval/target.mjs --day=2025-08-04 --region=wtwma
node eval/target.mjs --resume
```

`--day` is one flying day. The whole season is hours of archive builds; do
not start that until the join's tests have settled. `--resume` keeps days
already in `eval/out/target-2025.json` so a wedged hour does not cost the
run. Incomplete days are retried. Do not commit `eval/out/`.

## Scoring flares against radar storms

`storms.mjs` reads the days already in `eval/out/target-2025.json` and asks
each flare whether it sat inside a contiguous ≥20 dBZ object, how far the
core was, how far the edge was, how long that rain has been seen, whether
the GOES top over the storm is colder than five minutes ago, how many GLM
flashes sat over it, and whether the measured 18 dBZ echo top sits above
the freezing level.

```bash
node eval/storms.mjs
node eval/storms.mjs --day=2025-08-04 --region=wtwma --out=storms-sample.json
```

`--day` and `--region` score a subset. `--out` writes a different file so a sample does not overwrite the season. Re-run without `--resume` after the storm extras change: an old file has no echo-top field and would otherwise be kept.

`paint.mjs` stores cores, heading ticks, lightning, and the storm at each release beside the five fills. The eval app draws those under RADAR REFLECTIVITY, off until asked, the same way the candidate map does.

The programme page (`/wtwma`, `/plains`, …) holds the season bars. The flares page holds one flying day. Each release on that day is a row against the layers it sat in, the join tests stored on the flare, and the radar-storm tests at the analysis it is charged to.

A day painted before storm readings were stored has no `storm` key on its flares. The eval server copies the hour-pair score from `storms-2025.json` onto those flares when it serves the day, using the same hour the map already charged the release to. Lightning, cloud-top change, and modelled liquid are missing from that older run; `fill-storms.mjs` writes the full reading at the release minute onto the painted file without rebuilding the fills.

```bash
node eval/fill-storms.mjs eval/out/painted-2025-04-19.json
```

## Where to run the evaluation

The season build belongs on a machine with good CPU.

One flying day is one Node API plus `grib_filter`: about 4.5 GiB and 1.5–2 cores. Each API keeps 8 archive scenes per source and then drops the oldest, so RSS does not climb with the season.

Run the queue on **m7i.4xlarge in us-east-1** (16 vCPU, 64 GiB): eight days at once, same memory, twice the cores, and the HRRR, MRMS and GOES-19 archives are in that region.

Copy `eval/out/` back; the evaluation map stays local.
