# Review — what the 2025 season settles about the radar gate

The seeding-opportunity fill scores 87.3% of the season's located flares and
scores two programs far lower than the other three: South Texas 68.7% and
Rolling Plains 69.8%, against Trans-Pecos 92.0%, the Panhandle 91.0% and West
Texas 85.9%. Two explanations fit that spread. Either the low programs print
positions the record cannot place, or the fill asks for something their crews
do not fly. This separates them, and then asks what relaxing the criterion
would cost.

Every number here is measured from the painted season in `eval/out/2025/` — 116
days, 253 analysis hours, 1,353 located flares — and from
`eval/data/counties-tx.geojson`. The Panhandle and South Texas print a bearing
from magnetic north and a range; their releases are placed with the FAA
variation of record at each program's origin, as `UNCERTAINTY.md` §6
describes, and every figure below is measured from those positions.

---

## 1. The gap is position quality in one program and criteria in another

A release that lands in the county its own row names is one the record places.
Splitting each program's fly rate by that test separates a program the fill
disagrees with from a program we cannot locate.

| Program        | Pooled | In its named county | Somewhere else |
| -------------- | -----: | ------------------: | -------------: |
| Trans Pecos    |  92.0% | 413/447 (**92.4%**) |  14/18 (77.8%) |
| Panhandle      |  91.0% | 202/220 (**91.8%**) |  30/35 (85.7%) |
| West Texas     |  85.9% | 400/466 (**85.8%**) |  24/31 (77.4%) |
| Rolling Plains |  69.8% |   25/31 (**80.6%**) |  10/22 (45.5%) |
| South Texas    |  68.7% |   49/75 (**65.3%**) |    5/8 (62.5%) |

**Rolling Plains is a record problem.** It rises from 69.8% to 80.6% once the
rows that miss their own county are set aside, and the rows that miss score
45.5%. Its reports write a fraction that is sometimes a decimal degree and
sometimes minutes; `UNCERTAINTY.md` is where that is described.

**The Panhandle is placed, and scores with the programs that print
coordinates.** With its bearings read from magnetic north, 220 of its 255
releases land in their named county and those score 91.8%, beside Trans-Pecos.
Its placed and unplaced releases separate the way West Texas's and
Trans-Pecos's do.

**South Texas is not a record problem.** Its placed releases score 65.3%,
barely above the ones the record does not place, so position quality accounts
for little of its gap. What is left is about twenty points against the
programs that print coordinates, and it is about the criteria.

## 2. What the fill rejects is the rain test, and the rejections are real

Of the 1,239 releases that land in their named county, 121 fail for no
measured 20 dBZ in the cell or the eight around it. For South Texas that is 26
of its 75 placed releases against **none** rejected for cloud base; for the
Panhandle, 10 of 220.

Those rejections are not a sampling artifact. Reflectivity is averaged in
Z from the 1 km mosaic into 3 km blocks (`coarsenReflectivity` in
`server/src/lib/services/mrms/radar.ts`), which could in principle push a real
core under the threshold. It does not. What the release cell actually read:

| The cell the release landed in   | Releases |
| -------------------------------- | -------: |
| covered by radar, no echo at all |      110 |
| 0–15 dBZ                         |        5 |
| 15–20 dBZ                        |        3 |
| no radar coverage                |        3 |

110 of 121 sit in a cell a radar was watching that held no echo whatever, and
three sit in the band a dilution would produce. They are a median 4.9 km from
the edge of a storm whose core peaks at a median 42 dBZ.

**These are flank passes.** A crew flew the quiet side of a strong cell, which
is what `PROXY.md` describes them doing: rain is how the meteorologist finds
the cell, not how the cell is crossed off. The gate is discarding real seeding
opportunity.

## 3. Widening the neighbourhood does not survive its own cost

The rain test searches one 3 km cell and its eight neighbours — about 4.2 km
at the diagonal. Two things rule out widening it.

**The test stops asking anything.** Storm objects are matched out to
`NEAR_LIMIT_KM = 40` (`server/src/lib/services/mrms/objects.ts`), and almost
every release is already near one:

| A 20 dBZ object within |   Placed releases |
| ---------------------- | ----------------: |
| 0 km (inside it)       |  806/1239 (65.1%) |
| 4.2 km                 | 1152/1239 (93.0%) |
| 7.1 km                 | 1193/1239 (96.3%) |
| 12 km                  | 1213/1239 (97.9%) |
| 40 km                  | 1223/1239 (98.7%) |

A gate that passes a release with an object within 7.1 km passes 96.3% of
them. The fly rate it would produce — West Texas 91.4%, Trans-Pecos 95.7%, the
Panhandle 95.9%, South Texas 93.3%, Rolling Plains 93.5% — is mostly the test
declining to answer.

**The ground costs more than the catch is worth.** The season's 20 dBZ mask is
42,055 polygons covering 3,802,901 km² and carrying 1,575,450 km of perimeter.
Growing a mask adds area in proportion to its perimeter, and this one is
shredded rather than blobby:

| Polygon size |  Count | Share of area | Share of perimeter |
| ------------ | -----: | ------------: | -----------------: |
| under 10 km² | 25,943 |          2.1% |              12.8% |
| 10–50 km²    |  8,735 |          5.4% |              14.4% |
| 50–200 km²   |  4,682 |         12.3% |              18.6% |
| 200–1000 km² |  2,081 |         23.0% |              22.6% |
| 1000 km² up  |    614 |     **57.2%** |          **31.7%** |

Growing every polygon by one 3 km cell adds about 5.9 million km². The fill
already pays that: it paints 7,830,786 km² over the season's analysis hours
against a 3,802,901 km² undilated mask. A second cell adds roughly that much
again, for the few dozen flares that sit between 4.2 and 7.1 km from rain.

## 4. Anchoring the band to storm objects does not rescue it either

The obvious repair is to stop growing a buffer around everything and instead
light the flank of a tracked object, which is bounded by the storm rather than
by a radius. The perimeter table above is what refuses it. The 82.5% of
polygons under 50 km² hold only 27.2% of the perimeter, so restricting growth
to objects large enough to track removes 2.26 million km² of the 5.9 — 38%,
not an order of magnitude. Large storms carry the most perimeter because they
are large and ragged, and a flank band around a 1,000 km² storm is a great deal
of ground.

Making the band one-sided would roughly halve it, and that is the version that
cannot work: the upwind test scores 43.0% at the flare over the season, for the
reason `PROXY.md` gives — storm motion from the previous mosaic is not the
updraft, which the pilot measures as climb rate. A gate on it would refuse most
real releases.

`EVALUATION.md` already reports upwind and nearer-the-edge as readings on each
flare. Turning either into a painted field is a different object from a reading
at a point, but the arithmetic above is what that field would cost, and neither
form of it beats the gate now in place.

## 5. What stands, and what blocks a decision

Standing:

- South Texas has a criteria gap, not a record gap. Rolling Plains is the
  reverse. The Panhandle has neither once its bearings are read from magnetic
  north.
- The rain gate discards genuine flank passes beside strong storms — 110
  releases in clear, radar-watched air.
- No relaxation measured here improves catch and ground together. Every one
  buys flares by painting countryside.

What blocks it: every candidate is scored on how many flares it catches, and
the season contains no ground where the right answer is "no". 117 of 128 filed
report-days were seeded, and a day nobody filed a report for is not in the
record. Until there is a negative class, more catch and more painted ground
cannot be told apart, and a looser gate will always look better than a tighter
one.

The days a program filed a report, flew, and released nothing do not supply it.
There are eleven, and their observation logs are severe convection — 67 to 70
dBZ, vertically integrated liquid past 250 kg/m², echo tops near 20 km. Severe
weather suspends seeding under the TDLR permit, so those are days the fill is
built to draw and the permit stopped the aircraft. The nearest honest source is
the in-season days with no filed report at all, and its weakness is that
nothing confirms nobody flew.

---

## 6. Scoring the 2023 and 2024 seasons beside 2025

2024 is scored in `EVALUATION-2024.md`. Its record is thin: six West Texas days
of twenty-four, the Panhandle from June to September, and only the South Texas
rows printed as coordinates, because no single origin places that season's
bearings. Trans-Pecos and the Rolling Plains posted nothing that survives. The
Panhandle's 8°E variation places its 2024 releases as it places 2025's, which
is the replication step 3 asks for.

Three seasons instead of one triples the flare count and asks whether South
Texas's gap is a property of that district or of one year's record. It does not
supply a negative class — another seeded season adds no ground where the answer
should be no — so it settles §1 and §2 and leaves §5 exactly where it is.

### What already transfers

The daily-report parser (`eval/lib/reports.mjs`) reads four of the five
programs, `eval/lib/panhandle.mjs` reads the fifth, and `eval/lib/pdf.mjs`
pulls the text. The painter, the scorer and the verifier are season-agnostic:
they walk whatever a season's `eval/data/<season>/regions.json` lists.

The archives reach back. HRRR and MRMS cover both seasons. The satellite does
too without a change — `server/src/lib/services/goes/scene.ts` reads
`noaa-goes19` and falls back to `noaa-goes16` for any hour before GOES-19's
archive begins in April 2025, so 2023 and 2024 read GOES-16 as GOES-East.

### The work, in order

1. **Build a document manifest per program per season**, in the shape the 2025
   ones use: `source`, `note`, and `documents[]` of `file`, `url`, `date`,
   `kind`, and `flew` on a day the aircraft launched and seeded nothing. The
   three hosts serve documents by opaque id rather than by a path that can be
   templated, so each URL is resolved from that program's own page.

2. **Add one `regions.json` per season.** Each program names its own `reports`,
   `releases` and `runs`, and its own county list, window box and sounding
   sites, read from that season's reports: permit target areas move between
   years.

3. **Settle each radial origin and its magnetic variation again.** The
   Panhandle and South Texas print a bearing from magnetic north off an origin
   the reports never name. `eval/positions.mjs` prints how many releases land
   in their named county, which way the misses lean, and the further turn that
   would place the most. With the right origin and the FAA variation of record
   for it, the misses lean neither way and no further turn helps. A season that
   leans is a season whose origin or variation is not the 2025 one.

4. **Parse.** `eval/records.mjs` downloads what a manifest lists;
   `eval/releases.mjs` and `eval/panhandle.mjs` download and parse. Re-running
   the parser works from the cache without touching the network.

5. **Check placement before painting anything.** A season that places worse
   than 2025 produces tables about the record rather than about the layers, and
   §1 is the reason that distinction has to be made first.

6. **Keep seasons apart.** Each season's data, cache and painted days live in
   their own directory, the scorer reads one season at a time, and each
   season's tables go to their own `EVALUATION-YYYY.md`.

7. **Paint, on the EC2 box**, as `eval/README.md` describes.

### What to read off the result

- The in-county and elsewhere split from §1, per program per season. South
  Texas repeating near 65% across seasons is a district finding; South Texas
  moving is a 2025 record finding.
- The rejection breakdown from §2. Whether nine in ten rain-gate rejections
  landing in radar-watched air with no echo holds outside 2025.
- The lean from step 3, per radial program per season. The same variation
  placing both seasons is the replication of §1's Panhandle finding.
- Per-day spread rather than pooled percentages. Flares on one sortie share a
  storm and succeed and fail together, so more seasons of days is the sample
  that narrows the interval, not more flares.
