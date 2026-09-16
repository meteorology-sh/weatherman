# Evaluation — the 2025 Texas season

116 flying days across five programs. How to run the job is `eval/README.md`.

## The season at a glance

The reports print 1,362 flare rows. 8 have no usable position (the last table in
this section), which leaves 1,354 located flares. Every located flare is in
every denominator below.

| Season                          |   Flares |
| ------------------------------- | -------: |
| Rows in the reports             |     1362 |
| No usable position              |        8 |
| **Located**                     | **1354** |
| In the seeding opportunity: FLY |     1173 |
| Outside it: DON'T FLY           |      181 |

A flare is in the seeding opportunity when a click on the 3 km cell it landed in
says FLY. How a position finds its cell, and why the drawn outline can disagree
with the cells along its edge, is `docs/GEOMETRY.md`.

Rows with no usable position stay in the flight record and out of every
denominator.

| Program     | Releases not placed | Why                                 |
| ----------- | ------------------: | ----------------------------------- |
| West Texas  |                   2 | 21 August: 2 rows print no position |
| Trans Pecos |                   6 | 27 March: 6 rows print no position  |

## Flare overlap with each layer

The share of flares that landed inside each layer at the minute of release.
Seeding opportunity is the FLY cell a click answers; the other layers are their
drawn outlines. Counties flown is every county a program's releases name, and
its area. Seedable, typical flying day is the share of those counties inside the
seeding opportunity: each flying day is read at its median flown hour, and the
column is the median day. The season row is the median of every program's flying
days, over the counties any program flew.

| Program        | Releases |   Seeding opportunity |       Counties flown | Seedable, typical flying day |   Radar reflectivity |   Echo past freezing |           Cloud base | Supercooled liquid water |
| -------------- | -------: | --------------------: | -------------------: | ---------------------------: | -------------------: | -------------------: | -------------------: | -----------------------: |
| West Texas     |      497 |       424/497 (85.3%) |      13 · 54,887 km² |                         8.6% |      312/497 (62.8%) |      335/497 (67.4%) |      334/497 (67.2%) |            32/497 (6.4%) |
| Trans Pecos    |      466 |       428/466 (91.8%) |      11 · 73,593 km² |                        10.2% |      323/466 (69.3%) |      356/466 (76.4%) |      346/466 (74.2%) |            27/466 (5.8%) |
| Panhandle      |      255 |       232/255 (91.0%) |       8 · 18,999 km² |                        15.6% |      196/255 (76.9%) |      221/255 (86.7%) |      209/255 (82.0%) |           29/255 (11.4%) |
| South Texas    |       83 |         54/83 (65.1%) |       9 · 26,230 km² |                        21.0% |        22/83 (26.5%) |        25/83 (30.1%) |        27/83 (32.5%) |              5/83 (6.0%) |
| Rolling Plains |       53 |         35/53 (66.0%) |       8 · 18,765 km² |                        21.2% |        24/53 (45.3%) |        27/53 (50.9%) |        25/53 (47.2%) |             6/53 (11.3%) |
| **Season**     | **1354** | **1173/1354 (86.6%)** | **46 · 166,653 km²** |                    **10.7%** | **877/1354 (64.8%)** | **964/1354 (71.2%)** | **941/1354 (69.5%)** |       **99/1354 (7.3%)** |

## FLY or DON'T FLY at each release

What a click on the release's own 3 km cell answered: cloud base under 18,000 ft
MSL, 20 dBZ rain in the cell or its neighbours, and a payload the column
supports.

| Program        | Releases | Cloud base under 18,000 ft | … and rain within a cell |         Ice supported |        Salt supported |                   FLY |
| -------------- | -------: | -------------------------: | -----------------------: | --------------------: | --------------------: | --------------------: |
| West Texas     |      497 |            484/497 (97.4%) |          424/497 (85.3%) |       450/497 (90.5%) |       460/497 (92.6%) |       424/497 (85.3%) |
| Trans Pecos    |      466 |            460/466 (98.7%) |          428/466 (91.8%) |       437/466 (93.8%) |       415/466 (89.1%) |       428/466 (91.8%) |
| Panhandle      |      255 |            246/255 (96.5%) |          232/255 (91.0%) |       247/255 (96.9%) |       230/255 (90.2%) |       232/255 (91.0%) |
| South Texas    |       83 |             83/83 (100.0%) |            54/83 (65.1%) |         52/83 (62.7%) |         75/83 (90.4%) |         54/83 (65.1%) |
| Rolling Plains |       53 |              48/53 (90.6%) |            35/53 (66.0%) |         39/53 (73.6%) |         48/53 (90.6%) |         35/53 (66.0%) |
| **Season**     | **1354** |      **1321/1354 (97.6%)** |    **1173/1354 (86.6%)** | **1225/1354 (90.5%)** | **1228/1354 (90.7%)** | **1173/1354 (86.6%)** |

For each DON'T FLY, the first test its cell failed. No cell failed the payload
test.

| Program        | DON'T FLY | No cloud base under 18,000 ft | No 20 dBZ rain within a cell |
| -------------- | --------: | ----------------------------: | ---------------------------: |
| West Texas     |        73 |                            13 |                           60 |
| Trans Pecos    |        38 |                             6 |                           32 |
| Panhandle      |        23 |                             9 |                           14 |
| South Texas    |        29 |                             0 |                           29 |
| Rolling Plains |        18 |                             5 |                           13 |
| **Season**     |   **181** |                        **33** |                      **148** |

## Uncertainty

A flare within the margin of the seeding opportunity's edge could be on either
side of it. The margin is one 3 km grid cell plus how coarsely the report prints
the flare's position.

| Program        | Releases |   Seeding opportunity |    Within the margin |
| -------------- | -------: | --------------------: | -------------------: |
| West Texas     |      497 |       424/497 (85.3%) |      113/497 (22.7%) |
| Trans Pecos    |      466 |       428/466 (91.8%) |       76/466 (16.3%) |
| Panhandle      |      255 |       232/255 (91.0%) |       81/255 (31.8%) |
| South Texas    |       83 |         54/83 (65.1%) |        43/83 (51.8%) |
| Rolling Plains |       53 |         35/53 (66.0%) |        25/53 (47.2%) |
| **Season**     | **1354** | **1173/1354 (86.6%)** | **338/1354 (25.0%)** |

Within the margin counts every release close enough to the drawn edge to sit on
either side of it, whichever side it sits on now. It is not an error bar on the
seeding opportunity, because the releases in it do not all move the same way:
some are FLY and a tighter edge would lose them, and some are DON'T FLY and a
wider edge would gain them.

|           Lowest |          As drawn |           Highest | Spread |
| ---------------: | ----------------: | ----------------: | -----: |
| 934/1354 (69.0%) | 1173/1354 (86.6%) | 1272/1354 (93.9%) |    338 |

The season at both ends of the margin: lowest loses every FLY release inside it,
highest gains every DON'T FLY release inside it, and the spread between the two
is the margin count above. Neither end is likely. They are what the grid and the
reports together cannot rule out.

Where that uncertainty sits, by program. Seeding opportunity is the releases the
fill accepts as it is drawn; each column after it adds the DON'T FLY releases
whose own distance to the fill's edge is under that much, and which an edge
drawn that much wider would accept.

| Program        | Releases | Seeding opportunity | Within 1 km | Within 2 km | Within 3 km |
| -------------- | -------: | ------------------: | ----------: | ----------: | ----------: |
| West Texas     |      497 |                 424 |         436 |         446 |         455 |
| Trans Pecos    |      466 |                 428 |         437 |         444 |         449 |
| Panhandle      |      255 |                 232 |         245 |         248 |         251 |
| South Texas    |       83 |                  54 |          61 |          65 |          72 |
| Rolling Plains |       53 |                  35 |          40 |          42 |          43 |
| **Season**     | **1354** |            **1173** |    **1219** |    **1245** |    **1270** |

Refusals sit near the edge far more often than acceptances do: 97/181 (53.6%) of
the DON'T FLY releases are within 3 km of it, against 208/1173 (17.7%) of the
FLY ones. Most of what the fill refuses is a near miss at its boundary rather
than a column it rules out cleanly. A further three releases are outside this
table, with no measured distance to the edge.

| Program        | Position printed as |     Rounding | Margin | Lands in the county its row names |
| -------------- | ------------------- | -----------: | -----: | --------------------------------: |
| West Texas     | Coordinates         | under 0.1 km | 3.0 km |                   466/497 (93.8%) |
| Trans Pecos    | Coordinates         | under 0.1 km | 3.0 km |                   448/466 (96.1%) |
| Panhandle      | Bearing and range   |       1.0 km | 4.0 km |                   220/255 (86.3%) |
| South Texas    | Bearing and range   |       1.1 km | 4.1 km |                     75/83 (90.4%) |
| Rolling Plains | Coordinates         |       0.7 km | 3.7 km |                     31/53 (58.5%) |
| **Season**     |                     |              |        |             **1240/1354 (91.6%)** |

The margin leaves out what no report says: the point a bearing and range is
measured from, and whether a Rolling Plains coordinate is minutes. Where either
is wrong, the flare tends to miss the county its own row names, which is what
the last column shows.

## Report data that needs adjusting

**Transformed.** Two programs print a bearing from magnetic north and a range,
from an origin their reports never name. Before reads the bearing as true north.

| Program     | What the report prints               | Transformation                                                          |          Before |               After |
| ----------- | ------------------------------------ | ----------------------------------------------------------------------- | --------------: | ------------------: |
| Panhandle   | Bearing and range, all 255 releases  | Projected from the radar at Amarillo; bearing + 8°E variation of record | 191/255 (74.9%) | **232/255 (91.0%)** |
| South Texas | Bearing and range, 78 of 83 releases | Projected from Pleasanton; bearing + 6°E variation of record            |   49/83 (59.0%) |   **54/83 (65.1%)** |

**Retyped.** Trans Pecos on 30 June at 2038Z prints 31.0996 / -1033.7377, read
as 31.0996 / -103.7377. A position outside the program's window is read with one
doubled digit typed once when exactly one such reading lands inside it.

**Not adjusted.** Rolling Plains coordinates are sometimes decimal degrees and
sometimes minutes. They are read as decimal degrees: 31 of 53 land in the county
the row names, against 466 of 497 for West Texas.

## Radiosondes against the modeled column

Each 12Z ascent a report prints, against the HRRR column at that hour and site:
the average offset, then the typical miss. The season row counts each
site-morning once. The Panhandle Groundwater Conservation District briefs on a
NAM forecast rather than a balloon, and has no row.

**Freezing level to −15 °C**

| Program        | Ascents | Freezing level              | −15 °C height               | Layer overlap | Overlap above 90% |
| -------------- | ------: | --------------------------- | --------------------------- | ------------: | ----------------: |
| West Texas     |      67 | 33 m low · 43 m typical     | 23 m low · 51 m typical     |         94.7% |          60 of 67 |
| Trans Pecos    |      39 | 24 m low · 29 m typical     | 9 m low · 48 m typical      |         95.5% |          37 of 39 |
| South Texas    |      11 | 12 m low · 34 m typical     | 23 m low · 42 m typical     |         95.2% |          11 of 11 |
| Rolling Plains |       7 | 21 m low · 24 m typical     | 66 m low · 52 m typical     |         95.4% |            5 of 7 |
| **Season**     | **104** | **29 m low · 40 m typical** | **21 m low · 51 m typical** |     **95.0%** |     **95 of 104** |

**Convective condensation level**, the cloud-base layer's height where the model
has no cloud

| Program        | Ascents | CCL                           |
| -------------- | ------: | ----------------------------- |
| West Texas     |      67 | 325 m low · 269 m typical     |
| Trans Pecos    |      39 | 353 m low · 378 m typical     |
| South Texas    |      12 | 31 m low · 461 m typical      |
| Rolling Plains |       7 | 300 m low · 656 m typical     |
| **Season**     | **105** | **287 m low · 342 m typical** |
