# Uncertainty — how finely a layer and a report can place a flare

Two resolutions decide whether a flare is inside a layer: the grid cell the
layer is measured on, and how coarsely the report prints where the flare was.
The margin a flare is given is one of each added together. `EVALUATION.md`
prints the margin for every program.

## Layers

| Layer                    | Measured by                             | Grid cell  | New reading                         |
| ------------------------ | --------------------------------------- | ---------- | ----------------------------------- |
| Radar reflectivity       | MRMS radar mosaic                       | 1 km       | every 2 minutes                     |
| Cloud top and phase      | GOES-East satellite                     | about 2 km | every 5 minutes                     |
| Echo past freezing       | Radar echo top against the model        | 3 km       | radar every 2 minutes, model hourly |
| Cloud base               | Model base, gated on the radar echo top | 3 km       | radar every 2 minutes, model hourly |
| Supercooled liquid water | HRRR model                              | 3 km       | hourly                              |
| Seeding opportunity      | All of the above                        | 3 km       | radar every 2 minutes, model hourly |

A fill marks cells, not a coastline: its edge is where a cell stopped
qualifying, so the edge is known to one cell. A click reads the cell, and so
does the evaluation's seeding opportunity; the other layers are scored against
their drawn outlines. How an outline is drawn from the cells is `GEOMETRY.md`.

## Reports

| Program                 | Prints                                             | Rounding   |
| ----------------------- | -------------------------------------------------- | ---------- |
| West Texas, Trans-Pecos | Latitude and longitude to 0.0001°                  | about 0    |
| Rolling Plains          | Latitude and longitude to 0.01°                    | 0.7 km     |
| Panhandle, South Texas  | Whole-degree bearing and whole-nautical-mile range | about 1 km |

A printed position stands for anywhere that rounds to it: half the last digit of
a coordinate, or half a degree of bearing and half a mile of range. A bearing's
half degree grows with distance, about 0.6 km at 40 nautical miles.

## What no report says

Some error in a report is not rounding, and the margin cannot hold it.

**Where a bearing and range starts.** The Panhandle and South Texas print a
direction and a distance from a point they never name. `positions.mjs` infers
it as the point that puts the most flares in the county their own row names:
the Amarillo radar and Pleasanton. A wrong point moves every flare in the
program together.

**Which north.** Pilots measure bearings from magnetic north. The FAA's
variation of record for each starting point, 8°E at Amarillo and 6°E at
Pleasanton, is added to every bearing. Leaving it out turns a flare 39 nautical
miles out by about 10 km. `positions.mjs` checks it: against the wrong north,
the flares that miss their county all lean the same way around the starting
point.

**Degrees or minutes.** Some Rolling Plains rows appear to write the fraction as
minutes, but it is read as a decimal degree. Read the wrong way, a flare can land
tens of kilometres from where it was.

The share of flares landing in the county their own row names is the check on
all three.

## Time

Radar and satellite answer the minute of the release. The model answers the
hour. The evaluation uses the model hour nearest the release, never more than 30
minutes away. A layer drawn from the model alone is compared after moving the
flare with the storm to that hour. A layer with a radar or satellite edge is
compared where the flare was, and only the heights inside it are that old.

An operator sees an older model. HRRR posts about 50 minutes after its hour, so
the newest one available is 50 to 110 minutes old. Heights such as the freezing
level and cloud base change over hours, and the radiosonde tables in
`EVALUATION.md` measure how far they miss.
