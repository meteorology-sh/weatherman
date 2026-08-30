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

| Directory | What it is |
| --------- | ---------- |
| `cache/`  | Source reports (PDFs) |
| `data/`   | Parsed records and region config for that season |
| `out/`    | Comparison to Weatherman's layers |

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
core was, and how far the quiet edge was.

```bash
node eval/storms.mjs
```
