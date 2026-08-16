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
node eval/field.mjs  2025-04-22 21 22 23 00   # per hour → out/field-<date>.json
node eval/snowie.mjs 2017-01-20 22 23 00 01   # HRRR only → out/snowie-<date>.json
```

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

**`snowie.mjs`** reads the liquid contour frame over the Payette basin. The
join cannot run in January 2017 — no GOES cloud top before 2023-03-23, no MRMS
before 2020-10-14 — so it reports the HRRR half and names the missing inputs
rather than working around them.

## Things that will bite

**Cold builds cost 30–60 s each.** The archive answers one byte range per
request and a cycle is five sources. Releases are worked cycle by cycle, in
order, so each hour is built once and every later release in it is answered
from cache in milliseconds. Do not parallelise across dates — it multiplies
the builds instead of sharing them.

**A release is scored against the nearest analysis hour.** `at` names the HRRR
cycle and the join runs at the analysis hour only, so 1843Z is scored against
19z, 17 minutes away. Every row carries its `gapMinutes`, and that gap is the
largest source of slop in the test.

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
