# Geometry — how a layer is drawn, and how a flare is scored on it

Every layer is a grid of cells with one answer per cell. The map draws an
outline around the cells, and a click reads the cell. This is how the two
relate, and how the evaluation scores a flare against each layer.

## The grids

| Layer                    | Grid              | Cell |
| ------------------------ | ----------------- | ---- |
| Radar reflectivity       | MRMS radar mosaic | 1 km |
| Seeding opportunity      | HRRR model grid   | 3 km |
| Cloud base               | HRRR model grid   | 3 km |
| Echo past freezing       | HRRR model grid   | 3 km |
| Supercooled liquid water | HRRR model grid   | 3 km |

A 3 km layer that needs radar takes the 1 km radar reading under the centre of
each 3 km cell. Nothing is averaged, so a 3 km cell's rain is the rain at its
middle.

HRRR cells are squares in the model's own map projection. On a latitude and
longitude map they are slightly tilted.

## Which cell a point is in

A point is in the cell whose square contains it. That is not always the cell
whose centre is nearest: near the corner of a tilted square, a neighbour's
centre can be closer. A click and a flare find their cell the same way (`cellAt`
in `server/src/lib/services/shared/grid.ts`).

## What makes a cell FLY

| Test                           | Where it looks                   |
| ------------------------------ | -------------------------------- |
| Cloud base under 18,000 ft MSL | the cell                         |
| Rain at 20 dBZ                 | the cell and the eight around it |
| Echo top at or above freezing  | the cell and the eight around it |
| … or base below freezing       | the cell                         |

The cell and its eight neighbours make a block three cells, 9 km, across. A FLY
cell can hold no rain itself when a neighbour does. A neighbour no radar covers
counts as no rain.

## How the outline is drawn

The fill is not painted as squares. An outline is traced around the FLY cells
in four steps.

| Step              | What it does                                                                                                                  | What it does to the edge                                                         |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Trace             | The line runs along the middle of each edge between a FLY cell and a DON'T FLY one, and cuts straight across at every corner. | A corner of a FLY cell falls outside the line; a corner of a DON'T FLY cell, in. |
| Straighten        | Steps smaller than 0.4 of a cell become one straight line.                                                                    | The line can sit up to 0.4 of a cell off the cells.                              |
| Drop small pieces | Anything smaller than one cell's area is not drawn.                                                                           | A lone FLY cell traces to a diamond half a cell in area, so it is not drawn.     |
| Round             | Two smoothing passes take the corners off. The map only; the evaluation keeps the corners.                                    | A few hundred metres.                                                            |

A lone DON'T FLY cell inside a FLY area is dropped the same way, so the fill
runs over it.

**Zoomed out, the map draws blocks.** Past about 3 km to a screen pixel, the map
first averages each 4×4 block of cells, 12 km across, and draws a block where
more than half its cells are FLY. A program-sized view is finer than that and
traces the cells themselves. The radar fill on the map averages its 1 km cells
into 4 km blocks the same way.

**The evaluation stores the outline traced from the cells themselves**, 1 km for
radar and 3 km for the rest, with the corners kept. Each point is rounded to
three decimal places, about 110 m.

## How a flare is scored

A flare is the position and the minute its report prints.

**Seeding opportunity is scored on the cell.** A flare is in the seeding
opportunity when a click on the cell its position falls in, at the radar scan
of the release minute, says FLY. The outline plays no part.

**Every other layer is scored on its outline.** A flare is inside when its
position is inside that layer's outline. Otherwise its score is the distance to
the nearest edge.

| Layer                                              | Outline from                         | Flare position                             |
| -------------------------------------------------- | ------------------------------------ | ------------------------------------------ |
| Radar reflectivity, echo past freezing, cloud base | the radar scan at the release minute | as printed                                 |
| Supercooled liquid water                           | the model hour nearest the release   | moved with the storm's motion to that hour |

## Why the outline and the cell can disagree

Along the edge, the steps above put some DON'T FLY ground inside the outline and
some FLY ground outside it. A flare there can sit inside the drawn fill in a
DON'T FLY cell, or outside it in a FLY cell.

**The cell is the answer.** It is what a click says, and the coordinates in the
panel are what an operator acts on. The outline is a picture of the cells. On
the eval app's map, such a flare looks inside the fill and reads DON'T FLY.

## The margin

The painted files store outlines, not cell edges, so the Uncertainty table in
`EVALUATION.md` measures to the outline. A DON'T FLY flare within the margin of
the outline counts as +, and a FLY flare within it counts as −. The margin is
one layer cell plus the report's rounding (`UNCERTAINTY.md`).

## How much ground is seedable

A program's area is every county its releases name. The seedable share is the
part of those counties inside the seeding opportunity's outline.

It is measured along rows of latitude 0.01° apart, about 1.1 km. Each stretch of
a row inside both a county and the outline counts, times the row's height. A
county two programs fly counts once in the season.

Each flying day is read at its median hour, over the hours a release was scored
against. The typical flying day is the median of those days.

Like the margin, this measures the outline, not the FLY cells.
