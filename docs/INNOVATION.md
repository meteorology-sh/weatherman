# Innovation — what this app is for Texas rain-enhancement

Weatherman is a decision-support overlay for licensed Texas rain-enhancement
programs. It does not replace TITAN. It does not pick quiet columns of
modeled liquid. It hangs the sounding, the satellite, and modeled
supercooled liquid on the **storm the meteorologist is already watching**.

`WEATHERMAN.md` says what each layer claims. `MEASUREMENTS.md` says what a
feed may claim. `EVALUATION.md` is the 2025 score. `PROXY.md` is how far
four radar flags go as a stand-in for how Texas selects. This file is the
product: the object on the map, what sits on that object, and what this
app will not become.

---

## The object is a storm

Texas programs select a convective cell on TITAN: still growing, first
half of its lifetime, cloud base under 12,000 ft above the ground, depth
past the freezing level, enough cloud-base inflow, not severe. They
release silver iodide at cloud base into that updraft. Rain in the core
is how they find the flank, not how they cross the cell off.

The map an operator flies is therefore a **radar storm**, not a
seeding-opportunity contour. Contiguous cells at 20 dBZ or more on the
national mosaic are one storm. A click names that storm: inside the rain
or outside it, nearer the edge or the heaviest rain, on the upwind side
or not. The 18 dBZ echo top against the freezing level, the raining
area's growth, how long that rain has been on the mosaic, modeled
liquid over the storm, and the GOES top, are readings on that object.

These mosaic storms are not TITAN cells. They have no TITAN identity.
They do not report volume, precipitation mass, or a lifetime percentile.
The log is written in TITAN IDs (`158/262`). This map does not invent
those IDs.

## What sits on the storm

TITAN already tracks the cell. The gap is everything the desk already
computes that never lands on the storm in view.

| On the storm | What it is | What it is not |
| --- | --- | --- |
| Cloud base, ft above the ground | Can the aircraft climb in, and does rain from this base reach the ground. Under 12,000 ft is the West Texas criterion. | A national height ramp used as a mask. |
| Freezing level and −15 °C | The morning sounding, on this column. Median overlap with the balloons they brief is 95.3–97.7%. | A forecast of where to fly in hours. |
| 18 dBZ echo top versus freezing | The glaciogenic cue, measured. | A second rain fill. |
| Upwind raining edge | The flank of the object they fly. Heading from the previous mosaic, not inflow. | Climb rate in ft/min. Pilots measure that with the aircraft. |
| Supercooled liquid in the seeding band | HRRR's opinion over this storm. | A test that hides the storm. |
| GOES top, whether it cooled, phase | Growth and glaciation at the top, observed. | A −5 °C fill at the aircraft. Crews seed at cloud base. |
| GLM flashes | Electrification over this storm, as points. | A contour. Lightning is too sparse. |

Silver iodide still only acts on supercooled liquid. Radar still cannot
see that liquid. Those sentences do not move. What moves is the thing
the operator is asked to look at.

Two products, not one verdict:

- **Target.** Which storm, which flank, is the base reachable, is the
  echo top past freezing. Drawn as SEEDING OPPORTUNITY: the fill of
  cells that pass those tests, and the click on that fill.
- **Liquid check.** Does the model put supercooled liquid in the band
  over that storm. A reading. Never the mask.

## What the map opens on

Radar on. Storm cores, heading, and the upwind flank on. SEEDING
OPPORTUNITY on: the Texas tests as a fill, so the operator can see
where to click. Cloud base off until asked for. Supercooled liquid,
freezing, −15 °C, CAPE, CIN, LCL, and warm-cloud depth are numbers on
the click.

Rain on a cell is not a reason to delete the storm.

A click leads with the answer: FLY or DON'T FLY, and the Texas tests on
that cell (base under the ceiling, echo top past freezing, rain in the
neighborhood) with the failed one named. The storm follows under Radar,
then the cloud over that 3 km cell, then the environment around it.
"The radar is watching this cell rain" is a fact about the storm, not a
veto.

## TITAN stays where it is

TITAN has been mandatory on Texas Weather Modification Association
projects since 1999. The 2025 reports still reboot it when the feed
drops. Annual evaluations match seeded cells to unseeded controls on
lifetime, area, volume, top, max reflectivity, precipitation flux and
mass. That archive is how Texas claims an effect. This app does not
score a season that way.

Three different moves get called "doing TITAN." Only the overlay is
this product.

**Clone.** Identify and track storms ourselves and hope the log matches.
A clone that draws the same cells worse is not a product. TITAN is built
on 3-D volume scans. We ingest a 1 km composite mosaic. Volume and
precipitation mass from that mosaic would be invention.

**Embed LROSE.** Run NCAR's tracker next to Express, convert radar to
MDV, read SPDB. Different stack, polar volumes we do not ingest, a
second catalogue of IDs the radio will not use. The daily report names
their cells, not ours.

**Wrap their TITAN.** Ingest the track file the program already
writes, and hang the table above on those IDs. That is the only wrap
that preserves the log. It needs a feed from their machine. There is no
public stream. Until a program exports Tstorms XML or the equivalent,
this app has mosaic storms, labeled as mosaic storms.

If that feed arrives, it is another source of the same object type. The
map does not care which tracker named the storm. The app is not an
LROSE host.

The closest published analogue is the 2004 hydrometeorological decision
support system that sat **next to** TITAN: reflectivity on
constant-temperature surfaces, time–height, rain estimates. It did not
swallow the tracker.

## What this is not

- A mountain-west snowfall product. Supercooled liquid over a barrier, for
  hours, with flow toward the crest, is a different environment. The
  band integral already follows temperature into a winter airmass; the
  targeting loop does not. Scope is Texas, rainy season.
- A retune of the opportunity contour onto 2025 flare locations. Flare
  positions are where crews flew. They are not ground truth of
  seedability.
- A new threshold because it raises overlap with flares. A threshold
  still needs a citation (`MEASUREMENTS.md`).
- Inflow in ft/min, drawn from the model. That is a pilot call.
- Hygroscopic targeting as a first-class field before warm-cloud depth
  is a produced layer. Salt is rare in the 2025 log.

## How we will know it worked

**Evaluate against the season** means: score every located 2025 flare
against Weatherman's own layers at that minute, re-score the 12Z balloons
against the modeled seeding band, and store JSON the eval app reads as
regional maps and tables. The job is `eval/README.md`.

The test is not "overlap with flares went up." Flares are a biased
sample of days someone already decided to fly.

| Claim | Test against 2025 |
| --- | --- |
| We select the same kind of storm | Share of flares that fall in or on the upwind raining edge of a live mosaic object |
| We are looking at the flank, not the core | Distance to the upwind edge versus to the heaviest rain |
| The glaciogenic cue is present | 18 dBZ echo top at or above freezing on that object |
| Liquid remains an open check | Supercooled-liquid-inside rate, still reported, no longer a ship gate |
| Rain is no longer a silent veto | The storm stays on the map; the join is a switch |

A change that raises flare overlap by drawing every echo in Texas, or by
dropping the liquid reading, has not worked. It has hidden the
disagreement the evaluation found.

Lifetime percentile and inflow in ft/min stay named as missing. The
mosaic look-back is about 18 minutes. TITAN has the lifetime. The
aircraft has the climb rate.
