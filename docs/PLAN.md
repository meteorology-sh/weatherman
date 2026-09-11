# Plan — what is open

The clock rule is built: every layer in `paint.mjs` names the timestamp
that places its edge, and a flare is drifted to that timestamp and to
nothing where the edge is already current to the release minute. CCL is
reported on a click, carried in the flare tables, and stored on each
painted flare. `docs/EVALUATION.md` is reprinted from the files on disk.

What follows is what an audit of the evaluation turned up. The first item
is the one that decides how much the rest of the numbers are worth.

---

## 1. The tolerance reads in one direction

Inside is a bit — the flare was inside the fill or it was not — and both
sides of that comparison are softer than the bit implies. The season
tables carry a tolerance above that bit and none below it.

**The release point.** Two programmes print GPS coordinates. The other
three do not:

| Programme      | Flares | How the position is known                                         |
| -------------- | -----: | ----------------------------------------------------------------- |
| West Texas     |    497 | coordinates, mostly to four decimals                              |
| Trans Pecos    |    465 | coordinates, mostly to four decimals                              |
| Panhandle      |    255 | a bearing and a range from a point the reports never name         |
| South Texas    |     83 | the same, from April on                                           |
| Rolling Plains |     53 | coordinates to one or two decimals — a tenth of a degree is 11 km |

`data/regions.json` settles both unnamed origins by which one puts the
most rows in the county their own row names, and records that about six
degrees of eastward rotation would close most of the remaining gap in
both programmes at once — what a magnetic bearing display would look
like. No rotation is applied. Six degrees at 30 nm is 4 km, which is
wider than the cell the fills are drawn on.

It shows in the results. Seeding-opportunity overlap, grouped by how
precisely the release was printed:

| Printed precision       | Flares |    Inside |
| ----------------------- | -----: | --------: |
| four decimals (~10 m)   |   1031 | **83.1%** |
| three decimals (~500 m) |    212 |     79.7% |
| two decimals (~1.1 km)  |     69 |     65.2% |

**The layer edge.** The fills are traced from 3 km cells and drawn as
smooth contours, so the boundary is placed to a precision the underlying
grid does not have.

**What is built.** `score-season.mjs` gives each release a tolerance of
one cell of the layer plus the rounding of its printed position
(`eval/lib/tolerance.mjs`), and reports every layer as inside, within
tolerance, or outside. Within tolerance is its own column and never joins
inside.

**The work.** `nearness` keeps `edgeKm` only for a release that missed, so
how many releases inside were a cell from the edge is not recorded, and
inside has no lower bound. Storing `edgeKm` whether or not the release was
inside reads the margin in both directions, and needs a repaint. The
inferred radial origin, a bearing that may be magnetic, and Rolling Plains
rows that may print minutes stay outside the bound until each is measured.

This is the largest single change to what the evaluation claims, and it
can move a figure in either direction — 25% of the season's flares are
positioned no better than the cell they are being scored against.

## 2. The two halves of the product round the hour differently

`/candidate/*` sends a timestamp to `nearestHour`: 23:31 gets the 00z
analysis, seventeen minutes away rather than fifty-three. `/forecast/*`
sends the same timestamp to `floorHour` and gets 23z. Both are asked at
the release minute, so the same flare is scored against two different
analyses:

| Layer                           | Route        | Analysis for a 23:31 release |
| ------------------------------- | ------------ | ---------------------------- |
| Seeding opportunity, cloud base | `/candidate` | 00z                          |
| Supercooled liquid, base window | `/forecast`  | 23z                          |

684 of 1,330 flares — every release after the half hour — took an SLW
field an hour older than the seeding opportunity beside it. The drift is
computed to each frame's own valid time, so the arithmetic is consistent;
what is wrong is that an operator asking one question at one moment gets
two different atmospheres, and the evaluation inherits it.

**The work.** One rounding rule, in `shared/replay.ts`, used by both. The
model half of a request rounds to the nearer analysis; nothing truncates.

## 3. The map draws one frame and the table scores another

The eval app draws `frames[hour]` — one set of fills per analysis hour.
Each flare's distance is measured against a frame fetched at that flare's
own minute. For the radar and satellite layers those are always different
scans; for the HRRR layers they are different analyses whenever item 2
applies.

So a release can sit visibly inside the fill on the page and be scored
outside, or the reverse, with nothing on the page to say why.

**The work.** Either the page draws the frame each flare was scored
against when that flare is selected, or the stored distance names the
frame it came from and the page says so. The second is cheaper and is
already half-done: `near.<layer>.clockTime` is on every newly painted
flare.

## 4. Selectivity is measured over the wrong ground, twice

`Ground asked` is the programme's rectangular window. West Texas asks
about 892,872 km², most of which the programme has no permit to seed, so
"7.6% of the ground" is a share of a rectangle rather than of the ground
a crew could work. The county list that would give the honest denominator
is already in `data/regions.json` and `data/counties-tx.geojson`.

The numerator has the opposite problem. A contour is kept whole when any
part of it falls in the window — right for drawing, since clipping would
invent a coastline through the middle of a cloud, and wrong for area
accounting, because the ground outside the window is counted while the
denominator excludes it. Painted area reaches 125% of the window for
cloud base and 107% for the base window; 6.5% of the seeding
opportunity's vertices lie outside the window they were asked about.

**The work.** Clip when measuring, not when drawing. Report the share of
the permit counties beside the share of the window.

## 5. The flares are not 1,353 independent samples

1,353 releases come from 116 flying day-programmes, a median of 8.5 per
day and as many as 46. Flares from one sortie are minutes apart on one
storm, so they succeed and fail together. Every percentage in
`EVALUATION.md` is printed as though each release were its own trial,
which overstates how precisely the season is known.

**The work.** The day is the unit. Report the per-day rate and its
spread, or a cluster-robust interval, beside the pooled figure.

## 6. Smaller, and worth writing down

- **A repaint is owed.** `cclFt` on `cell` and `column`, and the corrected
  distances, exist only for days painted since this change.
  `score-season.mjs` derives the corrected tables from what is on disk;
  the eval app cannot, and shows the old distances until the season is
  painted again.
- **The CCL runs 287 m low** against the sounding tables the crews brief
  on, across 105 ascents, with a 342 m typical miss. It is a bias, not
  noise, and it is the height the cloud-base layer stands on wherever
  HRRR diagnoses no cloud.
- **39 flares stood in no 20 dBZ storm object and 12 answered no click.**
  Both are legitimate answers rather than failures, and `verify.mjs` is
  right to test that the key is present rather than that a value is under
  it. Its summary line then prints "storm reading on 1353, click readout
  on 1353", which reads as 1,353 answers and is how a wrong figure got
  into `EVALUATION.md`. The line should count what answered.
- **The drift is a straight line at one speed.** A single HRRR storm
  motion carried up to half an hour, over a storm that may have turned.
  It is used least where it matters most, now that the radar-gated fills
  do not drift at all.

## Standing refusals

Do not wrap TITAN. Do not add LROSE. Do not retarget the opportunity
contour onto flares. Do not tune the base to recover flares that fail the
radar gate.
