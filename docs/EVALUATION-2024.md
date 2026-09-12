# Evaluation — the 2024 Texas season

Every table here is printed by `node eval/score-season.mjs --season=2024` from
the painted season in `eval/out/2024/`, except the radial placement table,
which is `node eval/positions.mjs --season=2024`. How to run the job is
`eval/README.md`; `EVALUATION.md` is 2025.

Every located flare is in every denominator: 336 for the season, the program's
releases for a program. A layer that painted nothing near a flare counts as a
miss.

| The season                               |                         |
| ---------------------------------------- | ----------------------: |
| Flying days painted                      |                      27 |
| First / last                             | 2024-03-07 / 2024-09-18 |
| Located flares                           |                     336 |
| Flares a click answered                  |                     336 |
| Flares standing in a 20 dBZ storm object |                     334 |
| Programs                                 |                       3 |
| Balloon ascents, band scored             |                      20 |
| Balloon ascents, CCL scored              |                      20 |

## What the season's record holds

2024 is a smaller and thinner record than 2025, and every table below has to be
read against what was posted.

- **West Texas** posted six daily reports, as Word documents, against the 24
  operating days its monthly reports list. Its flight table prints a bearing and
  a range and no flare count, so no release carries a payload type.
- **The Panhandle** posted mission reports for June through September. May has
  an operations report and no missions, and June's operations report is a
  legacy Word document, so June's days are not checked against a monthly total.
- **South Texas** posted sixteen days. Most of its rows print a bearing and a
  range from an origin no single point fits, and they are kept unlocated; the
  sixteen releases here are the rows printed as coordinates.
- **Trans-Pecos and the Rolling Plains** have no 2024 reports posted or
  archived, and are not scored.

## Where the radial programs were measured from

West Texas and the Panhandle print a bearing from magnetic north and a range.
Each is placed from the origin the reports name, with that facility's FAA
variation of record added to every bearing. A bearing read against the wrong
north turns every release by the same angle, so the releases that miss their
named county lean one way; read against the right one, the misses lean neither
way and no further turn places more.

| Program    | Origin, variation of record           | In its named county | Misses turning clockwise / counter | Sign test | Further turn placing the most |
| ---------- | ------------------------------------- | ------------------: | ---------------------------------: | --------: | ----------------------------: |
| West Texas | San Angelo Regional, 5°E (epoch 2020) |      92/103 (89.3%) |                              4 / 4 |       1.0 |                  +3° (94/103) |
| Panhandle  | Amarillo, 8°E (epoch 2000)            |     203/217 (93.5%) |                              4 / 9 |      0.27 |                 +1° (205/217) |

The Panhandle's variation is the one its 2025 record needs, and 2024 needs it
too: read with no variation, its misses lean clockwise 47 to 8. West Texas's
six days span counties wide enough that a turn of several degrees moves few
releases across a line, so its record agrees with the variation without being
able to single it out.

## Flare overlap with each layer

| Program     | Releases | Seeding opportunity | Radar reflectivity | Echo past freezing |      Cloud base | Supercooled liquid water |
| ----------- | -------: | ------------------: | -----------------: | -----------------: | --------------: | -----------------------: |
| West Texas  |      103 |      81/103 (78.6%) |     51/103 (49.5%) |     69/103 (67.0%) |  67/103 (65.0%) |           20/103 (19.4%) |
| Panhandle   |      217 |     182/217 (83.9%) |    127/217 (58.5%) |    133/217 (61.3%) | 131/217 (60.4%) |             6/217 (2.8%) |
| South Texas |       16 |        4/16 (25.0%) |        1/16 (6.3%) |        0/16 (0.0%) |     0/16 (0.0%) |              0/16 (0.0%) |
| Season      |      336 |     267/336 (79.5%) |    179/336 (53.3%) |    202/336 (60.1%) | 198/336 (58.9%) |            26/336 (7.7%) |

## The fly criteria at each release

Each release's own 3 km cell, as the click readout stored on the painted flare
answered it. The verdict charges a cell to the first test it fails — base, then
rain, then payload — so rain is only asked of a cell whose base passed, and row 2
is the two together. No 2024 release logs a payload type.

| Criterion                                             | Ice flares (0) | Salt flares (0) | Type not logged (336) | All flares (336) |
| ----------------------------------------------------- | -------------: | --------------: | --------------------: | ---------------: |
| 1. Cloud base under 18,000 ft MSL                     |              — |               — |       319/336 (94.9%) |  319/336 (94.9%) |
| 2. Base passes and rain at 20 dBZ within a cell       |              — |               — |       263/336 (78.3%) |  263/336 (78.3%) |
| 3a. Echo top at or above freezing within a cell (ice) |              — |               — |       296/336 (88.1%) |  296/336 (88.1%) |
| 3b. Base below the freezing level (salt)              |              — |               — |       285/336 (84.8%) |  285/336 (84.8%) |
| FLY                                                   |              — |               — |       263/336 (78.3%) |  263/336 (78.3%) |
| FLY, for the flare that was flown                     |              — |               — |                     — |                — |

## Flare overlap within tolerance

A release is within tolerance when it lands outside a layer but no further from
its edge than one cell of that layer plus the rounding of its printed position.
It is counted on its own and never added to inside.

| Program     | Releases | Printed as bearing and range | Position rounding, median | Position rounding, max |
| ----------- | -------: | ---------------------------: | ------------------------: | ---------------------: |
| West Texas  |      103 |                          103 |                   1.15 km |                1.56 km |
| Panhandle   |      217 |                          217 |                   1.07 km |                1.58 km |
| South Texas |       16 |                            0 |                   0.74 km |                0.74 km |

| Layer                    | Cell |          Inside | Within tolerance | Inside or within |
| ------------------------ | ---: | --------------: | ---------------: | ---------------: |
| Seeding opportunity      | 3 km | 267/336 (79.5%) |   42/336 (12.5%) |  309/336 (92.0%) |
| Radar reflectivity       | 1 km | 179/336 (53.3%) |   86/336 (25.6%) |  265/336 (78.9%) |
| Echo past freezing       | 3 km | 202/336 (60.1%) |  101/336 (30.1%) |  303/336 (90.2%) |
| Cloud base               | 3 km | 198/336 (58.9%) |  107/336 (31.8%) |  305/336 (90.8%) |
| Supercooled liquid water | 3 km |   26/336 (7.7%) |   46/336 (13.7%) |   72/336 (21.4%) |

Each cell below is inside + within tolerance.

| Program     | Releases | Seeding opportunity, inside + within | Radar reflectivity, inside + within | Echo past freezing, inside + within | Cloud base, inside + within | Supercooled liquid water, inside + within |
| ----------- | -------: | -----------------------------------: | ----------------------------------: | ----------------------------------: | --------------------------: | ----------------------------------------: |
| West Texas  |      103 |                        78.6% + 15.5% |                       49.5% + 29.1% |                       67.0% + 28.2% |               65.0% + 30.1% |                             19.4% + 18.4% |
| Panhandle   |      217 |                        83.9% + 11.1% |                       58.5% + 25.8% |                       61.3% + 30.9% |               60.4% + 32.7% |                              2.8% + 12.4% |
| South Texas |       16 |                        25.0% + 12.5% |                         6.3% + 0.0% |                        0.0% + 31.3% |                0.0% + 31.3% |                               0.0% + 0.0% |
| Season      |      336 |                        79.5% + 12.5% |                       53.3% + 25.6% |                       60.1% + 30.1% |               58.9% + 31.8% |                              7.7% + 13.7% |

## Seeding opportunity, split by whether the report placed the flare

A release that missed the county its own row named is a release we cannot place,
not a release the layer missed.

| Program     | In its named county | Somewhere else | County not in the file |
| ----------- | ------------------: | -------------: | ---------------------: |
| West Texas  |       74/92 (80.4%) |   7/11 (63.6%) |                      0 |
| Panhandle   |     171/203 (84.2%) |  11/14 (78.6%) |                      0 |
| South Texas |         3/5 (60.0%) |    1/11 (9.1%) |                      0 |

## Ground each single-level fill painted

The median painted analysis hour per program, km². The season row adds the
programs' medians.

| Program     | Hours | Ground asked | Seeding opportunity | Echo past freezing |
| ----------- | ----: | -----------: | ------------------: | -----------------: |
| West Texas  |    15 |      892,872 |       65,211 (7.3%) |      51,394 (5.8%) |
| Panhandle   |    40 |       51,430 |        5,082 (9.9%) |       2,938 (5.7%) |
| South Texas |     8 |       78,429 |       8,379 (10.7%) |       2,480 (3.2%) |
| Season      |    63 |    1,022,732 |       78,672 (7.7%) |      56,813 (5.6%) |

## Flare overlap with each Texas selection feature

A flare with no 20 dBZ storm object does not pass a feature.

| Program     | Releases |          Upwind |       In 20 dBZ | Nearer the edge | Echo top past freezing |
| ----------- | -------: | --------------: | --------------: | --------------: | ---------------------: |
| West Texas  |      103 |  38/103 (36.9%) |  53/103 (51.5%) |  99/103 (96.1%) |         97/103 (94.2%) |
| Panhandle   |      217 |  94/217 (43.3%) | 128/217 (59.0%) | 213/217 (98.2%) |        208/217 (95.9%) |
| South Texas |       16 |    3/16 (18.8%) |     1/16 (6.3%) |   14/16 (87.5%) |          13/16 (81.3%) |
| Season      |      336 | 135/336 (40.2%) | 182/336 (54.2%) | 326/336 (97.0%) |        318/336 (94.6%) |

## The sounding layer against the balloons

The freezing level and the −15 °C height are what the reports print, so they are
what can be scored. Each height cell reads: how far our height sits from the
balloon's on average, then the typical miss in either direction. The CCL column
is scored over every ascent that prints one.

West Texas's 2024 tables print the same freezing level to within six metres on
three days between March and May, and identical cloud base, cloud-base
temperature and warm-cloud depth on 10 and 14 May. Its row is a reading of those
tables as printed.

| Program     | Ascents |             Freezing level |              −15 °C height |                          CCL | Layer overlap | Cleared 90% |
| ----------- | ------: | -------------------------: | -------------------------: | ---------------------------: | ------------: | ----------: |
| West Texas  |       5 | 662 m high · 840 m typical | 612 m high · 407 m typical | 1320 m high · 1472 m typical |     **53.7%** |      0 of 5 |
| South Texas |      15 |  272 m high · 75 m typical |   35 m low · 117 m typical |     47 m low · 309 m typical |     **85.6%** |     9 of 15 |

20 distinct scored ascents · median depth 2470 m · mean overlap 77.6% · worst 28.2% · cleared 80% 13 of 20

CCL over 20 distinct ascents · 363 m high · 367 m typical · the cloud-base layer's fallback height, against the instrument
