# Hygroscopic — is a salt candidate its own layer?

Sixty-eight percent of seeded days in 2025 carried at least one salt flare,
so this is not a fringe payload. This file asks whether it is a second
targeting question or the same one, and answers it from the painted season
rather than from first principles.

**The short answer.** The two questions are independent — a deep warm layer
tells you nothing about whether the top glaciated — but they are not two
maps. One fill, with the click naming which flare the column supports.

---

## 1. What salt seeding needs

Hygroscopic flares release sub-micron salt into the inflow at or just below
cloud base. The particles broaden the droplet spectrum and speed up
collision-coalescence, so rain forms earlier and lower in the **warm** part
of the cloud. Nothing about ice is involved, which means the glaciogenic
rule's central test — an 18 dBZ echo top past freezing — is the one test
that does not belong.

What the column has to say for it:

1. A base the airplane can work at, under the same airspace bound the
   glaciogenic rule uses.
2. A base warmer than freezing, so the warm-rain process is the one
   operating.
3. A warm layer between the base and the freezing level deep enough for
   coalescence to run.
4. A growing cell, worked on its upwind flank where the inflow is.
5. Echo present but the cell not already raining itself out — the opposite
   sign from the glaciogenic fill, which counts rain nearby as a reason to
   fly.

The depth in 3 and the temperature in 2 are the numbers that decide the
rule, and neither is set here. They have to come from the programs' own
briefing material or the hygroscopic literature; taking them from the
season's own distributions would be fitting the rule to the data it is
about to be scored against.

## 2. The layers it would need

| Layer                                        | Status                                                                                                                                  |
| -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Merged cloud base, MSL and above ground      | built                                                                                                                                   |
| Freezing level                               | built                                                                                                                                   |
| Reflectivity and the 20 dBZ gate             | built                                                                                                                                   |
| Storm objects — flank, age, growth           | built                                                                                                                                   |
| **Warm-cloud depth** (freezing − base)       | **missing as a layer.** Both inputs are already on the same 3 km grid                                                                   |
| **Cloud-base temperature**                   | **missing.** Read the HRRR profile at the base height; nothing new is downloaded                                                        |
| Droplet spectrum / cloud condensation nuclei | **no free source measures it.** This is the precondition that makes hygroscopic seeding worth doing at all, and it is unobservable here |

The first two are cheap and are worth building whatever is decided about a
second fill: warm-cloud depth is already promised as a briefing field, and
base temperature is one interpolation on a profile the click already
returns.

## 3. How distinct is a salt candidate?

Over the 1,341 releases the click answered, taking warm-cloud depth as the
salt-side quantity and the measured echo top against freezing as the
ice-side one:

| Warm-cloud depth | Flares | Top past freezing | Top below freezing | No measured top |
| ---------------- | -----: | ----------------: | -----------------: | --------------: |
| under 3,000 ft   |    266 |         174 (65%) |             2 (1%) |        90 (34%) |
| 3,000–6,000 ft   |    461 |         289 (63%) |            12 (3%) |       160 (35%) |
| 6,000–9,000 ft   |    350 |         226 (65%) |            19 (5%) |       105 (30%) |
| over 9,000 ft    |    130 |          74 (57%) |             5 (4%) |        51 (39%) |

The share of clouds whose top got past freezing is about the same in every
depth bin. Correlation between the two quantities is **r = −0.07** over the
893 releases with a measured top.

**They are independent.** Knowing a cloud has a deep warm layer tells you
essentially nothing about whether it glaciated, and the reverse. That is
the strongest argument that this is a real second question: a single fill
built on one of them cannot express the other.

It splits the season into three populations rather than two:

| Regime                                                        | Flares | Share |
| ------------------------------------------------------------- | -----: | ----: |
| Both apply — deep warm layer **and** a top past freezing      |    300 | 22.4% |
| Ice only — thin warm layer, top past freezing                 |    261 | 19.5% |
| Salt only — deep warm layer, warm base, top not past freezing |    180 | 13.4% |

The remainder are cells where the echo top is not measured at all, which is
30–39% of every depth bin and the largest single gap in this analysis.

## 4. Is there a cloud that objectively needs salt?

Yes — 180 releases, 13.4% of the season, sat in a deep warm layer with a
warm base and no measured top past freezing. That is a cloud a
silver-iodide flare has little to work with and a salt flare does.

The seeding opportunity refuses 72 of them for a top below freezing, so
**about 5% of all 2025 releases are cells the app says don't fly and a
hygroscopic rule would say fly.** That is the size of the hole.

Two cautions against reading it as a recommendation:

- **The crews do not treat it that way.** In the two programs that print
  payload per flare, the releases in this regime were 102 glaciogenic
  against 3 hygroscopic. "Objectively needs salt" is our inference from the
  column, not their practice. The three programs that would test it hardest
  print only day totals, so their flares cannot be attributed at all.
- **No measured top is not a warm top.** A cell with no 18 dBZ echo top may
  be a warm-topped cloud or may be a cloud the radar is not seeing. This
  analysis counts them as "not past freezing," which is the generous
  reading for the salt side.

Where the regime lives:

| Program        | Warm-cloud depth (median) | Base temperature (median) | Flares with a 6,000 ft+ warm layer |
| -------------- | ------------------------: | ------------------------: | ---------------------------------: |
| South Texas    |              **9,850 ft** |               **16.8 °C** |                            **59%** |
| West Texas     |                  5,443 ft |                   10.8 °C |                                43% |
| Rolling Plains |                  5,048 ft |                   10.4 °C |                                47% |
| Trans Pecos    |                  4,671 ft |                    8.7 °C |                                25% |
| Panhandle      |                  3,938 ft |                    9.5 °C |                                33% |

South Texas is the salt regime by a wide margin — twice Trans-Pecos's warm
layer and eight degrees warmer at the base. It is also the program the
glaciogenic fill agrees with least, refusing 37% of its flares for a top
below freezing. The two facts are the same fact.

**Base temperature does no work in Texas.** Ninety percent of these cells
already have a base above freezing, median 9.9 °C. It is a test that sounds
necessary and never fires, and should be reported rather than gated on.

## 5. One fill, not two

The orthogonality argues for a second question. The map argues against a
second green shape: two candidate fills over the same storms, disagreeing
in a third of cells, is a picture an operator has to arbitrate mid-flight.

The resolution is to keep one **seeding opportunity** — the ground worth
flying to — and let the click say which flare the column supports:

| What the panel would say | When                                                      |
| ------------------------ | --------------------------------------------------------- |
| Ice                      | top past freezing, thin warm layer                        |
| Salt                     | deep warm layer, warm base, top not past freezing         |
| Both                     | deep warm layer and a top past freezing — 22.4% of flares |

That matches what crews already do: on 68% of seeded days they carry both
and drop salt at the base of the same cell they put ice into the top of. In
West Texas and Trans-Pecos, salt releases sit in the same clouds as ice
releases — base 10,786 ft against 10,508, warm depth 4,850 against 4,998 —
and the current fill already catches them at 85.2% against 87.1%. A
separate salt map would be drawing a second outline around mostly the same
storms.

The fill's own **rule** still has to change, though, or the salt regime
stays invisible: today a top below freezing is a refusal, and for a
hygroscopic release it is not a reason to stay home. The smallest honest
change is to make the top test a payload question rather than a gate — the
fill lights where either payload has something to work with, and the click
says which.

## 6. What this cannot settle

- **Per-flare payload for three programs.** The Panhandle, South Texas and
  Rolling Plains print day totals only, so no hygroscopic release in them
  can be scored on its own.
- **Whether salt seeding worked.** Nothing here is an outcome. This is
  about which clouds the payload is physically suited to.
- **The droplet spectrum.** The precondition that makes hygroscopic seeding
  worth doing is not observable from any free feed, so a salt rule built
  from this data is a rule about cloud geometry, not about microphysics.
- **The 30–39% of cells with no measured echo top.** They are counted on
  the salt side by default here, and a real rule has to decide what to do
  with them.
