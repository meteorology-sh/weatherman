# Audit — what the evaluation is worth

A critical reading of `docs/EVALUATION.md`: what the numbers support, what
they do not, and what would have to be true before anyone flew on them.
Everything here is computed from the painted season in `eval/out/` and the
parsed reports in `eval/data/`.

---

## 1. The headline number is weaker than it looks

The seeding opportunity contains 81.8% of the season's flares while
painting 7.6% of the ground asked. Three things sit under that.

**There is no negative class.** This does not weaken the claim the
evaluation actually makes — whether Weatherman agrees with crews about
where the workable cloud is — which needs only the days they flew. It
bounds a second claim: how often the fill lights up over ground nobody
would work. 117 of 128 filed report-days were seeded,
and a day nobody filed a report for is not in the record at all. So the
evaluation scores the fill only over days and hours when a crew already
decided the sky was worth flying. It has never been asked to be quiet on
a day nobody flew. Painted area is the only stand-in for a false-positive
rate, and it is a poor one: it says how much ground lit up, not how often
the fill was wrong.

**The catch rate is bought with area.** Summed over every painted hour:

| Fill                | Flares inside | Ground painted | Catch per million km² |
| ------------------- | ------------: | -------------: | --------------------: |
| Radar, 20 dBZ       |     **60.2%** |  3,814,085 km² |              15.8 pts |
| Echo past freezing  |     **65.3%** |  5,881,419 km² |              11.1 pts |
| Seeding opportunity |     **81.8%** |  7,407,601 km² |              11.0 pts |

Plain radar reflectivity is the most efficient single fill in the product.
The seeding opportunity buys 21.6 points of catch for 94% more ground.
That may still be the right trade — a fill that only lit up inside heavy
rain would be useless for targeting the flank — but it has to be stated as
a trade rather than as a win.

**Much of the gain is dilation, not physics.** Rain and echo-past-freezing
are 8-connected neighborhood tests, so the fill extends a cell beyond the
measurements that switch it on. Of the 1,089 flares it catches, 297 are
outside the 20 dBZ contour entirely. Its area is 1.26× the raw
echo-past-freezing fill and 1.94× the radar fill. A useful null model to
beat is not "the empty map" but "the 20 dBZ mask, grown by one cell."

**The base test barely discriminates where the flares are.** Only 36 of
1,341 releases were rejected for a base above 18,000 ft MSL. The median
base at a release is 10,516 ft MSL and the 90th percentile is 14,471, so
the ceiling almost never binds on a real flare. It does real work over the
rest of the map, but nothing in this season validates where it should sit.

## 2. Two results that are not about crew agreement

Most of this evaluation asks whether Weatherman agrees with operators,
which is circular in one direction: crews fly at radar echoes and so does
the fill. Two results escape that.

**The modeled column is good.** Against the sounding tables the crews
brief on, over 104 ascents:

| Reading        |   Bias | Typical miss |
| -------------- | -----: | -----------: |
| Freezing level |  −29 m |     **40 m** |
| −15 °C height  |  −21 m |     **51 m** |
| CCL            | −287 m |        342 m |

Forty meters on the freezing level is about 130 feet. This is an
instrument-versus-model comparison with no crew judgement in it, and it is
the strongest thing in the repo. It is also the reason the echo-past-
freezing fill can be trusted as geometry: the height it is drawn against
is right.

**The supercooled liquid layer contradicts the operators.** At the cell
each flare was released into:

| Reading at the release cell    | Share |
| ------------------------------ | ----: |
| Any modeled supercooled liquid | 12.9% |
| Liquid verdict `noLiquid`      | 88.4% |
| Liquid verdict `candidate`     |  2.2% |

Median supercooled liquid water path at a release is zero. Either HRRR's
supercooled liquid is not usable at this scale, or Texas glaciogenic
flares are routinely released into cloud with no resolved supercooled
water in it. This season cannot tell those apart.

Nothing gates on it: supercooled liquid is a reference layer, the Texas
fills do not consult it, and no verdict in this evaluation turns on it.
The number is a model check rather than a finding against the product —
but it is the one place where Weatherman's physics and 1,341 operational
decisions disagree outright, and it should be labeled as unvalidated
wherever it is shown.

## 3. How close is this to flying a program?

Close as situational awareness, and the layers do paint the ground crews
actually fly. What is not established is whether they would have painted
it early enough, and whether the choice was a good one.

| What is missing       | Why it blocks flying on this                                                                                                                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Any outcome at all    | Nothing here says a flare made rain. Flying on this would mean flying on agreement with other crews, which is not evidence that they were right.                                                                                            |
| Operational lead time | Every layer is scored at the analysis nearest the release minute. HRRR posts about 50 minutes after the hour, so nobody had that analysis. The measured skill is hindcast skill.                                                            |
| Dispatch lead time    | A crew needs 30–60 minutes between a decision and a release. Nothing here tests whether the fill lit up over the same ground an hour earlier.                                                                                               |
| A measured cloud base | No free source measures cloud base. 20.5% of the bases under these flares came from the CCL, whose bias against the sondes is −287 m with 342 m of scatter — the worst-validated number in the product, standing under one release in five. |
| Flight safety         | 18,000 ft MSL is an airspace and oxygen bound, not a physical one. Icing, turbulence, lightning proximity and terrain clearance are not modeled anywhere.                                                                                   |
| A control design      | Deciding a program worked needs matched unseeded cases. That is a study design, not a map.                                                                                                                                                  |

The honest position: this is a good briefing and situational-awareness
tool that agrees with experienced crews about where the workable cloud is,
built on a model column validated to tens of meters. It is not a system
that has been shown to pick better targets than a radar display and a
trained forecaster, because nothing in it has been tested against that
baseline or against any outcome.

## 4. Why the programmes score differently

| Programme      | Seeding opportunity | Positions in the reports                   |
| -------------- | ------------------: | ------------------------------------------ |
| Trans Pecos    |               91.1% | coordinates, mostly four decimals          |
| West Texas     |               83.5% | coordinates, mostly four decimals          |
| Panhandle      |               72.5% | bearing and range from a point never named |
| Rolling Plains |               62.5% | coordinates to one or two decimals         |
| South Texas    |               54.9% | bearing and range from a point never named |

The ranking is the position-quality ranking. That is the first
explanation and it is measurable: overlap by printed precision is 83.1%
at four decimals, 79.7% at three, 65.2% at two. Before any meteorology is
invoked, a quarter of the season is located no better than the 3 km cell
it is being scored against.

Three further explanations, in descending order of how well this data
supports them:

**The payload is unknown for 391 flares.** West Texas and Trans-Pecos
print glaciogenic and hygroscopic counts; the Panhandle, South Texas and
Rolling Plains print none. The seeding opportunity encodes a glaciogenic
rule — echo top past freezing. South Texas has both the lowest overlap
and by far the lowest echo-past-freezing agreement (30.1%), which is what
scoring warm-cloud seeding by a cold-cloud rule would look like. This
data cannot confirm it, because the column that would is not in those
reports.

**The climates are not the same.** Gulf-fed South Texas convection, high
plains in the Panhandle, and high-terrain Trans Pecos storms do not share
a base height, a freezing level, or a warm-cloud depth. One fill with one
ceiling is a modeling choice, not a physical constant.

**The Panhandle's column is never validated.** It briefs on a NAM sounding
and is refused from the balloon table, so it is the one programme where
the modeled heights under the verdict have not been checked against an
instrument.

### Extending the app to judge them better

1. **Carry a position tolerance per flare**, from the programme and the
   printed precision, and report inside / within tolerance / outside.
   This is `docs/PLAN.md` item 1 and it matters most here — the radial
   programmes are currently penalized for their reports' formatting.
2. **Test the six-degree question directly.** `data/regions.json` records
   that about 6° of eastward rotation would raise county agreement in both
   radial programmes at once, which is what a magnetic bearing display
   looks like. Rescore the Panhandle and South Texas with and without it
   and report both. It is a one-parameter hypothesis with an independent
   check already in the repo.
3. **Score by payload where it is printed, and refuse to score where it is
   not** — or report those programmes separately rather than pooling them
   into a season figure that means something different for each.
4. **Build the hygroscopic rule as its own fill**: warm-cloud depth from
   base to freezing, base within the aircraft's reach, updraft flank. It
   is a different question from the glaciogenic one and it currently has
   no layer at all.
5. **Report per programme per day, with a spread**, not one pooled
   percentage over releases that arrive in clusters of eight.

## 5. How far the historical record can be trusted

The reports are operational logs. They record what a crew did, not what
was in the sky.

**What can be trusted.** The sounding tables — they are instrument
readings, taken at a fixed hour, by an agency with no stake in the
flight. The flare times and counts as a record of activity. The county
names, which are independent enough of the coordinates to have been used
to settle both unnamed origins.

**What cannot.** Position, to better than the tolerances above. The
absence of a report, which is not evidence that nothing happened. And any
claim about effect: nothing in these documents says whether it rained.

**Three biases worth naming.**

- _Selection._ Only filed days exist, and almost all of them were seeded.
  Every figure in the evaluation is conditional on a flight having
  happened.
- _Circularity._ The crews had radar and their own eyes. A fill built on
  radar agreeing with them is partly agreeing with the same instrument
  twice. The layers that are not radar-derived — the base, the liquid —
  are exactly the ones that agree least.
- _The flare is not the aircraft._ The report gives the aircraft's
  position at release. Ejectable flares fall and burn while they fall;
  wing-mounted flares burn on the aircraft and the plume advects. Where
  the material ended up is not recorded anywhere and is not the point the
  evaluation scores.

## 6. Other thoughts

- **Score against a null model, not against nothing.** Every change to the
  join should have to beat "the 20 dBZ mask grown by one cell" on catch
  and on area at once. Right now a change that paints more looks like a
  change that works.
- **Paint some days nobody flew.** Even a dozen would give the first real
  false-positive number in the project.
- **Make the headline a forecast, not a hindcast.** Re-run one programme
  with the layers valid at f01 and f02 rather than at the analysis, and
  report the skill an operator could actually have had.
- **The day is the sample.** 1,353 flares are 116 sorties; the pooled
  percentages claim more precision than the season contains.
- **Say which frame scored each flare.** The page draws one frame and the
  table scores another, and nothing on screen explains a disagreement.

## Sources

- `docs/EVALUATION.md` — the season tables this reads against
- `docs/PLAN.md` — the open work, in the order it should be done
- `eval/README.md` — how the season is painted and what each field means
- `docs/UNCERTAINTY.md` — drawing precision, the HRRR time delta, and the
  South Texas and Rolling Plains question
- `eval/data/regions.json` — the position provenance for each programme
