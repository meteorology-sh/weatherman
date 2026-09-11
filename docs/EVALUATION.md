# Evaluation — the 2025 Texas season

Every table here is printed by `node eval/score-season.mjs` from the painted
season in `eval/out/`. How to run the job is `eval/README.md`.

| The season                               |                         |
| ---------------------------------------- | ----------------------: |
| Flying days painted                      |                     116 |
| First / last                             | 2025-03-26 / 2025-10-24 |
| Located flares                           |                    1353 |
| Flares a click answered                  |                    1341 |
| Flares standing in a 20 dBZ storm object |                    1314 |
| Programs                                 |                       5 |
| Balloon ascents, band scored             |                     104 |
| Balloon ascents, CCL scored              |                     105 |

## Flare overlap with each layer

A layer with no frame for a release's hour drops that release from its
column.

| Program        | Releases |   Seeding opportunity |   Radar reflectivity |   Echo past freezing |           Cloud base | Supercooled liquid water |
| -------------- | -------: | --------------------: | -------------------: | -------------------: | -------------------: | -----------------------: |
| West Texas     |      497 |       420/497 (84.5%) |      302/497 (60.8%) |      325/497 (65.4%) |      326/497 (65.6%) |            31/497 (6.2%) |
| Trans Pecos    |      465 |       421/462 (91.1%) |      320/462 (69.3%) |      349/461 (75.7%) |      339/461 (73.5%) |            25/456 (5.5%) |
| Panhandle      |      255 |       186/255 (72.9%) |      132/255 (51.8%) |      149/255 (58.4%) |      143/255 (56.1%) |           27/248 (10.9%) |
| South Texas    |       83 |         40/71 (56.3%) |        24/83 (28.9%) |        24/83 (28.9%) |        25/71 (35.2%) |              3/76 (3.9%) |
| Rolling Plains |       53 |         33/48 (68.8%) |        21/48 (43.8%) |        22/48 (45.8%) |        20/48 (41.7%) |             6/53 (11.3%) |
| **Season**     | **1353** | **1100/1333 (82.5%)** | **799/1345 (59.4%)** | **869/1344 (64.7%)** | **853/1332 (64.0%)** |       **92/1330 (6.9%)** |

## The fly criteria at each release

Each release's own 3 km cell, as the click readout stored on the painted
flare answered it. The verdict charges a cell to the first test it fails —
base, then rain, then payload — so rain is scored only over cells whose base
passed. The two payload halves are asked of every cell. An ice flare is a
row the report logs as glaciogenic, a salt flare one it logs as
hygroscopic; a row logging both is in both columns.

| Criterion                                             |    Ice flares (935) |  Salt flares (106) | Type not logged (379) | All answered (1341) |
| ----------------------------------------------------- | ------------------: | -----------------: | --------------------: | ------------------: |
| 1. Cloud base under 18,000 ft MSL                     |     921/935 (98.5%) |    105/106 (99.1%) |       357/379 (94.2%) |   1305/1341 (97.3%) |
| 2. Rain at 20 dBZ within a cell, of those passing 1   |     814/921 (88.4%) |     93/105 (88.6%) |       266/357 (74.5%) |   1103/1305 (84.5%) |
| 3a. Echo top at or above freezing within a cell (ice) |     843/935 (90.2%) |     96/106 (90.6%) |       281/379 (74.1%) |   1147/1341 (85.5%) |
| 3b. Base below the freezing level (salt)              |     854/935 (91.3%) |     93/106 (87.7%) |       328/379 (86.5%) |   1207/1341 (90.0%) |
| FLY                                                   |     814/935 (87.1%) |     93/106 (87.7%) |       264/379 (69.7%) |   1101/1341 (82.1%) |
| **FLY, for the flare that was flown**                 | **808/935 (86.4%)** | **82/106 (77.4%)** |                     — |                   — |

## Flare overlap within tolerance

A release is within tolerance when it lands outside a layer but no further
from its edge than one cell of that layer plus the rounding of its printed
position. It is counted on its own and never added to inside. Nothing lowers
inside: a painted file stores no distance to the edge for a release that
landed in the layer.

| Program        | Releases | Printed as bearing and range | Position rounding, median | Position rounding, max |
| -------------- | -------: | ---------------------------: | ------------------------: | ---------------------: |
| West Texas     |      497 |                            0 |                   0.01 km |                0.73 km |
| Trans Pecos    |      465 |                            0 |                   0.01 km |                0.07 km |
| Panhandle      |      255 |                          255 |                   1.01 km |                1.59 km |
| South Texas    |       83 |                           78 |                   1.09 km |                1.36 km |
| Rolling Plains |       53 |                            0 |                   0.73 km |                0.73 km |

| Layer                    | Cell |            Inside | Within tolerance |      Inside or within |
| ------------------------ | ---: | ----------------: | ---------------: | --------------------: |
| Seeding opportunity      | 3 km | 1100/1333 (82.5%) |  100/1333 (7.5%) | **1200/1333 (90.0%)** |
| Radar reflectivity       | 1 km |  799/1345 (59.4%) | 209/1345 (15.5%) |     1008/1345 (74.9%) |
| Echo past freezing       | 3 km |  869/1344 (64.7%) | 262/1344 (19.5%) |     1131/1344 (84.2%) |
| Cloud base               | 3 km |  853/1332 (64.0%) | 285/1332 (21.4%) |     1138/1332 (85.4%) |
| Supercooled liquid water | 3 km |    92/1330 (6.9%) |   90/1330 (6.8%) |      182/1330 (13.7%) |

Each cell below is inside + within tolerance.

| Program        | Releases | Seeding opportunity |             Radar | Echo past freezing |        Cloud base |             SLW |
| -------------- | -------: | ------------------: | ----------------: | -----------------: | ----------------: | --------------: |
| West Texas     |      497 |        84.5% + 4.8% |     60.8% + 13.9% |      65.4% + 19.7% |     65.6% + 21.3% |     6.2% + 4.6% |
| Trans Pecos    |      465 |        91.1% + 4.3% |     69.3% + 15.2% |      75.7% + 15.2% |     73.5% + 17.8% |     5.5% + 4.6% |
| Panhandle      |      255 |       72.9% + 12.2% |     51.8% + 17.6% |      58.4% + 19.6% |     56.1% + 21.6% |   10.9% + 14.5% |
| South Texas    |       83 |       56.3% + 26.8% |     28.9% + 24.1% |      28.9% + 38.6% |     35.2% + 36.6% |     3.9% + 7.9% |
| Rolling Plains |       53 |       68.8% + 12.5% |     43.8% + 10.4% |      45.8% + 25.0% |     41.7% + 33.3% |    11.3% + 7.5% |
| **Season**     | **1353** |    **82.5% + 7.5%** | **59.4% + 15.5%** |  **64.7% + 19.5%** | **64.0% + 21.4%** | **6.9% + 6.8%** |

## Seeding opportunity, split by whether the report placed the flare

A release that missed the county its own row named is a release we cannot
place, not a release the layer missed.

| Program        | In its named county | Somewhere else | County not in the file |
| -------------- | ------------------: | -------------: | ---------------------: |
| West Texas     |     396/466 (85.0%) |  24/31 (77.4%) |                      0 |
| Trans Pecos    |     407/444 (91.7%) |  14/18 (77.8%) |                      0 |
| Panhandle      |     148/195 (75.9%) |  38/60 (63.3%) |                      0 |
| South Texas    |       28/53 (52.8%) |  12/18 (66.7%) |                      0 |
| Rolling Plains |       25/29 (86.2%) |   8/19 (42.1%) |                      0 |

## Ground each single-level fill painted

The median painted analysis hour per program, km². The season row adds the
programs' medians.

| Program        |   Hours |  Ground asked | Seeding opportunity | Echo past freezing |
| -------------- | ------: | ------------: | ------------------: | -----------------: |
| West Texas     |      82 |       892,872 |       54,344 (6.1%) |      39,964 (4.5%) |
| Trans Pecos    |      88 |       199,195 |       18,758 (9.4%) |      11,661 (5.9%) |
| Panhandle      |      51 |        51,430 |       8,269 (16.1%) |      6,205 (12.1%) |
| South Texas    |      22 |        78,429 |      13,714 (17.5%) |      9,605 (12.2%) |
| Rolling Plains |      10 |        65,362 |       8,687 (13.3%) |      7,383 (11.3%) |
| **Season**     | **253** | **1,287,288** |  **103,772 (8.1%)** |  **74,819 (5.8%)** |

## Flare overlap with each Texas selection feature

| Program        | Releases |               Upwind |            In 20 dBZ |       Nearer the edge | Echo top past freezing |
| -------------- | -------: | -------------------: | -------------------: | --------------------: | ---------------------: |
| West Texas     |      497 |      230/443 (51.9%) |      303/497 (61.0%) |       447/470 (95.1%) |        463/467 (99.1%) |
| Trans Pecos    |      465 |      167/421 (39.7%) |      310/465 (66.7%) |       429/458 (93.7%) |        453/454 (99.8%) |
| Panhandle      |      255 |      119/234 (50.9%) |      129/255 (50.6%) |       242/255 (94.9%) |        244/246 (99.2%) |
| South Texas    |       83 |        31/76 (40.8%) |        24/83 (28.9%) |        83/83 (100.0%) |          74/81 (91.4%) |
| Rolling Plains |       53 |        25/40 (62.5%) |        20/53 (37.7%) |         45/48 (93.8%) |          45/47 (95.7%) |
| **Season**     | **1353** | **572/1214 (47.1%)** | **786/1353 (58.1%)** | **1246/1314 (94.8%)** |  **1279/1295 (98.8%)** |

## The seeding band against the balloons

Each cell is bias / typical miss. The CCL column is scored over every ascent
that prints one, so its count can exceed the band's.

| Program        | Ascents | Freezing level | −15 °C height |            CCL | Band overlap | Cleared 90% |
| -------------- | ------: | -------------: | ------------: | -------------: | -----------: | ----------: |
| West Texas     |      67 |   −33 m / 43 m |  −23 m / 51 m | −325 m / 269 m |    **94.7%** |    60 of 67 |
| Trans Pecos    |      39 |   −24 m / 29 m |   −9 m / 48 m | −353 m / 378 m |    **95.5%** |    37 of 39 |
| South Texas    |      11 |   −12 m / 34 m |  −23 m / 42 m |  −31 m / 461 m |    **95.2%** |    11 of 11 |
| Rolling Plains |       7 |   −21 m / 24 m |  −66 m / 52 m | −300 m / 656 m |    **95.4%** |      5 of 7 |

| Distinct ascents        |                |
| ----------------------- | -------------: |
| Band scored             |            104 |
| Median band depth       |         2429 m |
| Mean band overlap       |      **95.0%** |
| Worst band overlap      |          77.2% |
| Cleared 80%             |     103 of 104 |
| CCL scored              |            105 |
| CCL bias / typical miss | −287 m / 342 m |
