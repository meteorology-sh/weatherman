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
| Flares standing in a 20 dBZ storm object |                    1314 |
| Programs                                 |                       5 |
| Balloon ascents, band scored             |                     104 |
| Balloon ascents, CCL scored              |                     105 |

## Flare overlap with each layer

| Program        | Releases |   Seeding opportunity |   Radar reflectivity |   Echo past freezing |           Cloud base | Supercooled liquid water |
| -------------- | -------: | --------------------: | -------------------: | -------------------: | -------------------: | -----------------------: |
| West Texas     |      497 |       420/497 (84.5%) |      302/497 (60.8%) |      325/497 (65.4%) |      326/497 (65.6%) |            31/497 (6.2%) |
| Trans Pecos    |      465 |       421/465 (90.5%) |      320/465 (68.8%) |      349/465 (75.1%) |      339/465 (72.9%) |            25/465 (5.4%) |
| Panhandle      |      255 |       186/255 (72.9%) |      132/255 (51.8%) |      149/255 (58.4%) |      143/255 (56.1%) |           27/255 (10.6%) |
| South Texas    |       83 |         46/83 (55.4%) |        24/83 (28.9%) |        24/83 (28.9%) |        29/83 (34.9%) |              3/83 (3.6%) |
| Rolling Plains |       53 |         33/53 (62.3%) |        21/53 (39.6%) |        22/53 (41.5%) |        20/53 (37.7%) |             6/53 (11.3%) |
| **Season**     | **1353** | **1106/1353 (81.7%)** | **799/1353 (59.1%)** | **869/1353 (64.2%)** | **857/1353 (63.3%)** |       **92/1353 (6.8%)** |

## The fly criteria at each release

Each release's own 3 km cell, as the click readout stored on the painted
flare answered it. The verdict charges a cell to the first test it fails —
base, then rain, then payload — so rain is only asked of a cell whose base
passed, and row 2 is the two together. The two payload halves are asked of
every cell. An ice flare is a row the report logs as glaciogenic, a salt
flare one it logs as hygroscopic; a row logging both is in both columns.

| Criterion                                             |    Ice flares (935) |  Salt flares (106) | Type not logged (391) | All flares (1353) |
| ----------------------------------------------------- | ------------------: | -----------------: | --------------------: | ----------------: |
| 1. Cloud base under 18,000 ft MSL                     |     921/935 (98.5%) |    105/106 (99.1%) |       369/391 (94.4%) | 1317/1353 (97.3%) |
| 2. Base passes and rain at 20 dBZ within a cell       |     814/935 (87.1%) |     93/106 (87.7%) |       271/391 (69.3%) | 1108/1353 (81.9%) |
| 3a. Echo top at or above freezing within a cell (ice) |     843/935 (90.2%) |     96/106 (90.6%) |       286/391 (73.1%) | 1152/1353 (85.1%) |
| 3b. Base below the freezing level (salt)              |     854/935 (91.3%) |     93/106 (87.7%) |       339/391 (86.7%) | 1218/1353 (90.0%) |
| FLY                                                   |     814/935 (87.1%) |     93/106 (87.7%) |       269/391 (68.8%) | 1106/1353 (81.7%) |
| **FLY, for the flare that was flown**                 | **808/935 (86.4%)** | **82/106 (77.4%)** |                     — |                 — |

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
| Seeding opportunity      | 3 km | 1106/1353 (81.7%) |  105/1353 (7.8%) | **1211/1353 (89.5%)** |
| Radar reflectivity       | 1 km |  799/1353 (59.1%) | 209/1353 (15.4%) |     1008/1353 (74.5%) |
| Echo past freezing       | 3 km |  869/1353 (64.2%) | 262/1353 (19.4%) |     1131/1353 (83.6%) |
| Cloud base               | 3 km |  857/1353 (63.3%) | 290/1353 (21.4%) |     1147/1353 (84.8%) |
| Supercooled liquid water | 3 km |    92/1353 (6.8%) |   90/1353 (6.7%) |      182/1353 (13.5%) |

Each cell below is inside + within tolerance.

| Program        | Releases | Seeding opportunity |             Radar | Echo past freezing |        Cloud base |             SLW |
| -------------- | -------: | ------------------: | ----------------: | -----------------: | ----------------: | --------------: |
| West Texas     |      497 |        84.5% + 4.8% |     60.8% + 13.9% |      65.4% + 19.7% |     65.6% + 21.3% |     6.2% + 4.6% |
| Trans Pecos    |      465 |        90.5% + 4.3% |     68.8% + 15.1% |      75.1% + 15.1% |     72.9% + 17.6% |     5.4% + 4.5% |
| Panhandle      |      255 |       72.9% + 12.2% |     51.8% + 17.6% |      58.4% + 19.6% |     56.1% + 21.6% |   10.6% + 14.1% |
| South Texas    |       83 |       55.4% + 28.9% |     28.9% + 24.1% |      28.9% + 38.6% |     34.9% + 37.3% |     3.6% + 7.2% |
| Rolling Plains |       53 |       62.3% + 11.3% |      39.6% + 9.4% |      41.5% + 22.6% |     37.7% + 30.2% |    11.3% + 7.5% |
| **Season**     | **1353** |    **81.7% + 7.8%** | **59.1% + 15.4%** |  **64.2% + 19.4%** | **63.3% + 21.4%** | **6.8% + 6.7%** |

## Seeding opportunity, split by whether the report placed the flare

A release that missed the county its own row named is a release we cannot
place, not a release the layer missed.

| Program        | In its named county | Somewhere else | County not in the file |
| -------------- | ------------------: | -------------: | ---------------------: |
| West Texas     |     396/466 (85.0%) |  24/31 (77.4%) |                      0 |
| Trans Pecos    |     407/447 (91.1%) |  14/18 (77.8%) |                      0 |
| Panhandle      |     148/195 (75.9%) |  38/60 (63.3%) |                      0 |
| South Texas    |       34/65 (52.3%) |  12/18 (66.7%) |                      0 |
| Rolling Plains |       25/31 (80.6%) |   8/22 (36.4%) |                      0 |

## Ground each single-level fill painted

The median painted analysis hour per program, km². The season row adds the
programs' medians.

| Program        |   Hours |  Ground asked | Seeding opportunity | Echo past freezing |
| -------------- | ------: | ------------: | ------------------: | -----------------: |
| West Texas     |      82 |       892,872 |       54,344 (6.1%) |      39,964 (4.5%) |
| Trans Pecos    |      88 |       199,195 |       18,758 (9.4%) |      11,661 (5.9%) |
| Panhandle      |      51 |        51,430 |       8,269 (16.1%) |      6,205 (12.1%) |
| South Texas    |      22 |        78,429 |      15,114 (19.3%) |      9,605 (12.2%) |
| Rolling Plains |      10 |        65,362 |       8,687 (13.3%) |      7,383 (11.3%) |
| **Season**     | **253** | **1,287,288** |  **105,172 (8.2%)** |  **74,819 (5.8%)** |

## Flare overlap with each Texas selection feature

A flare with no 20 dBZ storm object does not pass a feature.

| Program        | Releases |               Upwind |            In 20 dBZ |       Nearer the edge | Echo top past freezing |
| -------------- | -------: | -------------------: | -------------------: | --------------------: | ---------------------: |
| West Texas     |      497 |      230/497 (46.3%) |      303/497 (61.0%) |       447/497 (89.9%) |        463/497 (93.2%) |
| Trans Pecos    |      465 |      167/465 (35.9%) |      310/465 (66.7%) |       429/465 (92.3%) |        453/465 (97.4%) |
| Panhandle      |      255 |      119/255 (46.7%) |      129/255 (50.6%) |       242/255 (94.9%) |        244/255 (95.7%) |
| South Texas    |       83 |        31/83 (37.3%) |        24/83 (28.9%) |        83/83 (100.0%) |          74/83 (89.2%) |
| Rolling Plains |       53 |        25/53 (47.2%) |        20/53 (37.7%) |         45/53 (84.9%) |          45/53 (84.9%) |
| **Season**     | **1353** | **572/1353 (42.3%)** | **786/1353 (58.1%)** | **1246/1353 (92.1%)** |  **1279/1353 (94.5%)** |

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
