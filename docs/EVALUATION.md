# Evaluation — the 2025 Texas season

Every located 2025 flare scored against Weatherman's own layers at the
minute and place it left the aircraft, and the 12Z balloons scored against
the modeled column. How to run the job is `eval/README.md`; this file is
the result.

| The season                               |                         |
| ---------------------------------------- | ----------------------: |
| Flying days painted                      |                     116 |
| First / last                             | 2025-03-26 / 2025-10-24 |
| Located flares                           |                   1,353 |
| Flares a click answered                  |                   1,341 |
| Flares standing in a 20 dBZ storm object |                   1,314 |
| Programs                                 |                       5 |
| Balloon ascents scored                   |                     105 |

Inside means inside the contour, measured against the clock that layer
answers to. A fill made of model alone is as old as its analysis, so the
release is carried to it on storm motion; a fill whose edge is placed by
radar or satellite valid at the release minute has already followed the
storm, and the release is scored where it happened. Denominators differ
per column: a flare whose layer had no frame that hour drops out of that
column, not out of the season.

## Flare overlap — the original layers

| Layer                        | Clock | Flares inside |    Season |
| ---------------------------- | ----- | ------------: | --------: |
| Cloud base                   | radar |      895/1332 | **67.2%** |
| Radar reflectivity           | radar |      810/1345 | **60.2%** |
| Supercooled liquid water     | model |       92/1330 |      6.9% |
| Candidate supercooled liquid | model |       30/1311 |      2.3% |
| Cloud tops                   | scene |       23/1331 |      1.7% |

| Program        | Releases | Cloud base | Cloud tops |     Radar |      SLW | Candidate SLW |
| -------------- | -------: | ---------: | ---------: | --------: | -------: | ------------: |
| West Texas     |      497 |      69.0% |       1.2% |     62.6% |     6.2% |          2.4% |
| Trans Pecos    |      465 |      76.6% |       2.2% |     69.3% |     5.5% |          1.4% |
| Panhandle      |      255 |      59.6% |       0.4% |     52.5% |    10.9% |          2.8% |
| South Texas    |       83 |      33.8% |       4.3% |     28.9% |     3.9% |          2.9% |
| Rolling Plains |       53 |      47.9% |       6.3% |     43.8% |    11.3% |          6.3% |
| **Season**     | **1353** |  **67.2%** |   **1.7%** | **60.2%** | **6.9%** |      **2.3%** |

## Flare overlap — the Texas fills

| Fill                | Clock | Flares inside |    Season |
| ------------------- | ----- | ------------: | --------: |
| Seeding opportunity | radar |     1089/1332 | **81.8%** |
| Echo past freezing  | radar |      877/1344 |     65.3% |
| Base window         | model |      876/1353 |     64.7% |

| Program        | Releases | Seeding opportunity | Base window | Echo past freezing |
| -------------- | -------: | ------------------: | ----------: | -----------------: |
| West Texas     |      497 |               83.5% |       61.8% |              66.2% |
| Trans Pecos    |      465 |               91.1% |       72.5% |              76.1% |
| Panhandle      |      255 |               72.5% |       60.0% |              58.8% |
| South Texas    |       83 |               54.9% |       53.0% |              30.1% |
| Rolling Plains |       53 |               62.5% |       66.0% |              45.8% |
| **Season**     | **1353** |           **81.8%** |   **64.7%** |          **65.3%** |

## Ground each Texas fill painted

Overlap without area is not a result — a fill covering everything catches
every flare. km² over 253 painted analysis hours.

| Fill                | Ground painted | Share of ground asked |
| ------------------- | -------------: | --------------------: |
| Ground asked        |      1,287,288 |                     — |
| Seeding opportunity |         97,976 |              **7.6%** |
| Base window         |        608,968 |                 47.3% |
| Echo past freezing  |         74,818 |                  5.8% |

The seeding opportunity catches **81.8%** of flares on **7.6%** of the
ground. Both figures are read with the limits below: the ground is a
rectangle rather than the counties a programme may fly, and a quarter of
the season's flares are located to no better than the cell the fills are
drawn on.

| Program        |   Hours |  Ground asked | Seeding opportunity | Base window | Echo past freezing |
| -------------- | ------: | ------------: | ------------------: | ----------: | -----------------: |
| West Texas     |      82 |       892,872 |                5.7% |       43.7% |               4.5% |
| Trans Pecos    |      88 |       199,195 |                8.9% |       54.6% |               5.9% |
| Panhandle      |      51 |        51,430 |               15.7% |       47.9% |              12.1% |
| South Texas    |      22 |        78,429 |               16.6% |       69.3% |              12.2% |
| Rolling Plains |      10 |        65,362 |               12.6% |       47.0% |              11.3% |
| **Season**     | **253** | **1,287,288** |            **7.6%** |   **47.3%** |           **5.8%** |

## Flare overlap — the Texas selection features

| Feature                       |    Flares |    Season |
| ----------------------------- | --------: | --------: |
| Echo top past freezing        | 1279/1295 | **98.8%** |
| Nearer the edge than the core | 1246/1314 | **94.8%** |
| In 20 dBZ                     |  786/1353 |     58.1% |
| On the upwind flank           |  572/1214 |     47.1% |

| Program        | Releases |    Upwind | In 20 dBZ | Nearer the edge | Echo top past freezing |
| -------------- | -------: | --------: | --------: | --------------: | ---------------------: |
| West Texas     |      497 |     51.9% |     61.0% |           95.1% |                  99.1% |
| Trans Pecos    |      465 |     39.7% |     66.7% |           93.7% |                  99.8% |
| Panhandle      |      255 |     50.9% |     50.6% |           94.9% |                  99.2% |
| South Texas    |       83 |     40.8% |     28.9% |          100.0% |                  91.4% |
| Rolling Plains |       53 |     62.5% |     37.7% |           93.8% |                  95.7% |
| **Season**     | **1353** | **47.1%** | **58.1%** |       **94.8%** |              **98.8%** |

## The modeled column against the balloons

Bias / typical miss, in meters, against the sounding table the crews brief
on. The 12Z ascent lands on an HRRR analysis hour, so neither side is
rounded to meet the other.

| Reading        | Ascents |   Bias | Typical miss |
| -------------- | ------: | -----: | -----------: |
| Freezing level |     104 |  −29 m |     **40 m** |
| −15 °C height  |     104 |  −21 m |     **51 m** |
| CCL            |     105 | −287 m |        342 m |

| Band overlap      |            |
| ----------------- | ---------: |
| Mean              |  **95.0%** |
| Worst             |      77.2% |
| Median band depth |    2,429 m |
| Cleared 90%       |  95 of 104 |
| Cleared 80%       | 103 of 104 |

| Program        | Ascents | Freezing level |   −15 °C |        CCL | Band overlap | Cleared 90% |
| -------------- | ------: | -------------: | -------: | ---------: | -----------: | ----------: |
| West Texas     |      67 |       −33 / 43 | −23 / 51 | −325 / 269 |    **94.7%** |    60 of 67 |
| Trans Pecos    |      39 |       −24 / 29 |  −9 / 48 | −353 / 378 |    **95.5%** |    37 of 39 |
| South Texas    |      11 |       −12 / 34 | −23 / 42 |  −31 / 461 |    **95.2%** |    11 of 11 |
| Rolling Plains |       7 |       −21 / 24 | −66 / 52 | −300 / 656 |    **95.4%** |      5 of 7 |

The CCL is scored over every ascent that prints one, so its count exceeds
the band's. It is the height the cloud-base layer falls back to wherever
HRRR diagnoses no cloud, which is about half the domain.

## Limits

|                                     |                                                                                                                                                                                                              |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Targeting, not outcome              | Nothing here says a flare made rain. These are agreement tests against where crews flew.                                                                                                                     |
| Flares are not a control            | Crews fly where they judge it worth flying. A layer agreeing with them is not the layer being right.                                                                                                         |
| Model on one side                   | Cloud base, CCL, freezing level and liquid are HRRR. Reflectivity, echo top, cloud-top temperature and phase are measured.                                                                                   |
| Clocks differ                       | HRRR rounds to the analysis hour; radar and satellite keep the minute. A flare is drifted to the clock that places the layer's edge, and to nothing where that edge is already current.                      |
| Positions are not all GPS           | West Texas and Trans-Pecos print coordinates. The Panhandle and South Texas print a bearing and a range from a point their reports never name, and Rolling Plains prints coordinates to a tenth of a degree. |
| Inside is decided under the cell    | The fills are drawn on 3 km cells. 98 of the 243 flares outside the seeding opportunity are within one cell of it, and 137 within two.                                                                       |
| Ground asked is a rectangle         | Selectivity is measured over each programme's window, not over the counties it may fly, and a contour crossing that window is counted whole.                                                                 |
| Cloud tops is not a targeting layer | 1.7% is expected — it is a temperature ramp over all cloud, not a selection.                                                                                                                                 |
| Panhandle has no balloon            | It briefs on a NAM column, so it is refused from the sounding table rather than scored and caveated.                                                                                                         |

## Reproducing this

The season runs on an EC2 box in us-east-1: one Weatherman API per painter,
one `paint.mjs` per flying day in parallel, then `balloons.mjs` across the
same APIs. `eval/README.md` is the job.

```bash
node eval/verify.mjs        # is this tree a complete season?
node eval/score-season.mjs  # reprint the tables above
```

The eval app at `/<program>` lists the flare tables and RADIOSONDE. It
reads what a painter stored, so its distances are the season's until the
season is painted again.

## Sources

- [WTWMA 2025 operations, with the per-day reports](https://westtxwxmod.com/?page_id=23)
- [TDLR — rain enhancement operations in Texas](https://www.tdlr.texas.gov/weather/summary.htm)
- [Census TIGERweb State_County service](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer)
- Friedrich et al. (2020), _Quantifying snowfall from orographic cloud seeding_,
  PNAS 117(10) 5190–5195 — [PMC7071876](https://pmc.ncbi.nlm.nih.gov/articles/PMC7071876/)
- Buckets: `noaa-hrrr-bdp-pds`, `noaa-goes16`, `noaa-goes19`, `noaa-mrms-pds`
