# Evaluation — the 2025 Texas season

Every table here is printed by `node eval/score-season.mjs` from the painted
season in `eval/out/`. How to run the job is `eval/README.md`.

Every located flare is in every denominator: 1353 for the season, the
program's releases for a program. A layer that painted nothing near a flare
counts as a miss.

| The season                               |                         |
| ---------------------------------------- | ----------------------: |
| Flying days painted                      |                     116 |
| First / last                             | 2025-03-26 / 2025-10-24 |
| Located flares                           |                    1353 |
| Flares a click answered                  |                    1353 |
| Flares standing in a 20 dBZ storm object |                    1335 |
| Programs                                 |                       5 |
| Balloon ascents, band scored             |                     104 |
| Balloon ascents, CCL scored              |                     105 |

## Flare overlap with each layer

Two programs print a position the record cannot pin down. The Rolling Plains
write a fraction that is sometimes a decimal degree and sometimes minutes and
never say which, and the two readings of one row lie tens of kilometres apart —
many cells of any layer here. South Texas and the Panhandle write a bearing and
a range from a point their reports never name. Every position is read exactly
as printed and nothing is rewritten, so where those three score low the row is
about the record as much as about the layer. `positions.mjs` prints how far
that goes.

| Program        | Releases |   Seeding opportunity |   Radar reflectivity |   Echo past freezing |           Cloud base | Supercooled liquid water |
| -------------- | -------: | --------------------: | -------------------: | -------------------: | -------------------: | -----------------------: |
| West Texas     |      497 |       427/497 (85.9%) |      312/497 (62.8%) |      335/497 (67.4%) |      334/497 (67.2%) |            32/497 (6.4%) |
| Trans Pecos    |      465 |       428/465 (92.0%) |      323/465 (69.5%) |      355/465 (76.3%) |      345/465 (74.2%) |            27/465 (5.8%) |
| Panhandle      |      255 |       186/255 (72.9%) |      132/255 (51.8%) |      149/255 (58.4%) |      143/255 (56.1%) |           27/255 (10.6%) |
| South Texas    |       83 |         48/83 (57.8%) |        24/83 (28.9%) |        24/83 (28.9%) |        29/83 (34.9%) |              3/83 (3.6%) |
| Rolling Plains |       53 |         37/53 (69.8%) |        24/53 (45.3%) |        27/53 (50.9%) |        25/53 (47.2%) |             6/53 (11.3%) |
| **Season**     | **1353** | **1126/1353 (83.2%)** | **815/1353 (60.2%)** | **890/1353 (65.8%)** | **876/1353 (64.7%)** |       **95/1353 (7.0%)** |

## The fly criteria at each release

Each release's own 3 km cell, as the click readout stored on the painted
flare answered it. The verdict charges a cell to the first test it fails —
base, then rain, then payload — so rain is only asked of a cell whose base
passed, and row 2 is the two together. The two payload halves are asked of
every cell. An ice flare is a row the report logs as glaciogenic, a salt
flare one it logs as hygroscopic; a row logging both is in both columns.

| Criterion                                             |    Ice flares (935) |  Salt flares (106) | Type not logged (391) | All flares (1353) |
| ----------------------------------------------------- | ------------------: | -----------------: | --------------------: | ----------------: |
| 1. Cloud base under 18,000 ft MSL                     |     917/935 (98.1%) |    104/106 (98.1%) |       369/391 (94.4%) | 1312/1353 (97.0%) |
| 2. Base passes and rain at 20 dBZ within a cell       |     827/935 (88.4%) |     96/106 (90.6%) |       277/391 (70.8%) | 1128/1353 (83.4%) |
| 3a. Echo top at or above freezing within a cell (ice) |     861/935 (92.1%) |    100/106 (94.3%) |       293/391 (74.9%) | 1179/1353 (87.1%) |
| 3b. Base below the freezing level (salt)              |     850/935 (90.9%) |     92/106 (86.8%) |       339/391 (86.7%) | 1213/1353 (89.7%) |
| FLY                                                   |     827/935 (88.4%) |     96/106 (90.6%) |       275/391 (70.3%) | 1126/1353 (83.2%) |
| **FLY, for the flare that was flown**                 | **821/935 (87.8%)** | **85/106 (80.2%)** |                     — |                 — |

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
| Seeding opportunity      | 3 km | 1126/1353 (83.2%) |  110/1353 (8.1%) | **1236/1353 (91.4%)** |
| Radar reflectivity       | 1 km |  815/1353 (60.2%) | 215/1353 (15.9%) |     1030/1353 (76.1%) |
| Echo past freezing       | 3 km |  890/1353 (65.8%) | 268/1353 (19.8%) |     1158/1353 (85.6%) |
| Cloud base               | 3 km |  876/1353 (64.7%) | 298/1353 (22.0%) |     1174/1353 (86.8%) |
| Supercooled liquid water | 3 km |    95/1353 (7.0%) |   92/1353 (6.8%) |      187/1353 (13.8%) |

Each cell below is inside + within tolerance.

| Program        | Releases | Seeding opportunity |             Radar | Echo past freezing |        Cloud base |             SLW |
| -------------- | -------: | ------------------: | ----------------: | -----------------: | ----------------: | --------------: |
| West Texas     |      497 |        85.9% + 5.6% |     62.8% + 14.3% |      67.4% + 20.1% |     67.2% + 22.1% |     6.4% + 4.6% |
| Trans Pecos    |      465 |        92.0% + 4.5% |     69.5% + 15.7% |      76.3% + 15.5% |     74.2% + 18.1% |     5.8% + 4.9% |
| Panhandle      |      255 |       72.9% + 12.2% |     51.8% + 17.6% |      58.4% + 19.6% |     56.1% + 21.6% |   10.6% + 14.1% |
| South Texas    |       83 |       57.8% + 28.9% |     28.9% + 24.1% |      28.9% + 41.0% |     34.9% + 39.8% |     3.6% + 7.2% |
| Rolling Plains |       53 |       69.8% + 11.3% |     45.3% + 11.3% |      50.9% + 22.6% |     47.2% + 30.2% |    11.3% + 7.5% |
| **Season**     | **1353** |    **83.2% + 8.1%** | **60.2% + 15.9%** |  **65.8% + 19.8%** | **64.7% + 22.0%** | **7.0% + 6.8%** |

## Seeding opportunity, split by whether the report placed the flare

A release that missed the county its own row named is a release we cannot
place, not a release the layer missed.

| Program        | In its named county | Somewhere else | County not in the file |
| -------------- | ------------------: | -------------: | ---------------------: |
| West Texas     |     403/466 (86.5%) |  24/31 (77.4%) |                      0 |
| Trans Pecos    |     414/447 (92.6%) |  14/18 (77.8%) |                      0 |
| Panhandle      |     148/195 (75.9%) |  38/60 (63.3%) |                      0 |
| South Texas    |       36/65 (55.4%) |  12/18 (66.7%) |                      0 |
| Rolling Plains |       27/31 (87.1%) |  10/22 (45.5%) |                      0 |

## Ground each single-level fill painted

The median painted analysis hour per program, km². The season row adds the
programs' medians.

| Program        |   Hours |  Ground asked | Seeding opportunity | Echo past freezing |
| -------------- | ------: | ------------: | ------------------: | -----------------: |
| West Texas     |      82 |       892,872 |       54,344 (6.1%) |      42,094 (4.7%) |
| Trans Pecos    |      88 |       199,195 |       18,230 (9.2%) |      11,304 (5.7%) |
| Panhandle      |      51 |        51,430 |       8,269 (16.1%) |      6,205 (12.1%) |
| South Texas    |      22 |        78,429 |      15,114 (19.3%) |      9,605 (12.2%) |
| Rolling Plains |      10 |        65,362 |       9,503 (14.5%) |      8,063 (12.3%) |
| **Season**     | **253** | **1,287,288** |  **105,460 (8.2%)** |  **77,270 (6.0%)** |

## Flare overlap with each Texas selection feature

A flare with no 20 dBZ storm object does not pass a feature.

| Program        | Releases |               Upwind |            In 20 dBZ |       Nearer the edge | Echo top past freezing |
| -------------- | -------: | -------------------: | -------------------: | --------------------: | ---------------------: |
| West Texas     |      497 |      230/497 (46.3%) |      312/497 (62.8%) |       458/497 (92.2%) |        475/497 (95.6%) |
| Trans Pecos    |      465 |      171/465 (36.8%) |      315/465 (67.7%) |       433/465 (93.1%) |        457/465 (98.3%) |
| Panhandle      |      255 |      119/255 (46.7%) |      129/255 (50.6%) |       242/255 (94.9%) |        244/255 (95.7%) |
| South Texas    |       83 |        33/83 (39.8%) |        24/83 (28.9%) |        83/83 (100.0%) |          76/83 (91.6%) |
| Rolling Plains |       53 |        28/53 (52.8%) |        23/53 (43.4%) |         50/53 (94.3%) |          50/53 (94.3%) |
| **Season**     | **1353** | **581/1353 (42.9%)** | **803/1353 (59.3%)** | **1266/1353 (93.6%)** |  **1302/1353 (96.2%)** |

## The sounding layer against the balloons

The freezing level and the −15 °C height are what the reports print, so they
are what can be scored. The seeding band's own edges, −5 and −18 °C, are not in
the record — this is a check on the column those heights are read off, not on
the band.

Each height cell reads: how far our height sits from the balloon's on average,
then the typical miss in either direction. "Low" means our height is below the
balloon's. The CCL column is scored over every ascent that prints one, so its
count can exceed the layer's.

| Program        | Ascents | Freezing level          | −15 °C height           | CCL                       | Layer overlap | Cleared 90% |
| -------------- | ------: | ----------------------- | ----------------------- | ------------------------- | ------------: | ----------: |
| West Texas     |      67 | 33 m low · 43 m typical | 23 m low · 51 m typical | 325 m low · 269 m typical |     **94.7%** |    60 of 67 |
| Trans Pecos    |      39 | 24 m low · 29 m typical | 9 m low · 48 m typical  | 353 m low · 378 m typical |     **95.5%** |    37 of 39 |
| South Texas    |      11 | 12 m low · 34 m typical | 23 m low · 42 m typical | 31 m low · 461 m typical  |     **95.2%** |    11 of 11 |
| Rolling Plains |       7 | 21 m low · 24 m typical | 66 m low · 52 m typical | 300 m low · 656 m typical |     **95.4%** |      5 of 7 |

| Distinct ascents    |            |
| ------------------- | ---------: |
| Layer scored        |        104 |
| Median layer depth  |     2429 m |
| Mean layer overlap  |  **95.0%** |
| Worst layer overlap |      77.2% |
| Cleared 80%         | 103 of 104 |
| CCL scored          |        105 |
| CCL, average offset |  287 m low |
| CCL, typical miss   |      342 m |
