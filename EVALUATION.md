# Evaluation — does the map agree with what Texas actually flies

Two questions, in order.

1. **Is the seeding band in the right place?** Check it against the weather
   balloons the operator briefs on every morning.
2. **Do the flares fall inside what we paint?** Paint the liquid at both model
   hours a flare sits between, then see whether the release point is inside.

The first is answered and the answer is yes. The second is answered and the
answer is almost never — for a reason worth knowing.

`WEATHERMAN.md` says what the app claims. `MEASUREMENTS.md` says what the free
feeds can answer. This file says what happened when we checked.

---

## The ground truth

The West Texas Weather Modification Association publishes a report for every day
it flies. Each report carries:

- **every flare** — position, UTC minute, aircraft, and whether it was silver
  iodide or salt
- **a sounding table** for Midland and Del Rio, nine readings each
- **the pilots' radio calls**, timed to the minute
- **radar cell readings** — echo top, liquid content, reflectivity

`eval/releases.mjs` downloads the PDFs and writes `eval/data/releases-2025.json`.
**34 flying days, 497 flares with a position, no parse failures.** Each report
states its flare count three times and the parser checks all three against each
other, so a dropped row cannot pass as a quiet day.

Two flares in the season have a time and a county but no coordinates. They stay
in the totals and out of the point results.

---

## Finding 1 — the seeding band is where the balloons put it

The seeding band is the layer of cloud cold enough for silver iodide to work:
from the freezing level up to about −15 °C. Everything the product does depends
on drawing that layer in the right part of the sky.

The National Weather Service flies a balloon from Midland and from Del Rio twice
a day. It carries a thermometer through that exact layer. The operator reads
those two ascents every morning and decides whether to fly on them.

The 12Z ascent lands on a model analysis hour, so both sides can be compared
without rounding either. **68 pairs attempted over the season, 64 scored.**

| Reading               | Balloons | Our bias | Typical miss |     Worst |
| --------------------- | -------: | -------: | -----------: | --------: |
| Freezing level        |       64 |    −31 m |     **45 m** |     286 m |
| −15 °C height         |       64 |    −26 m |     **57 m** |     324 m |
| Temperature at 700 mb |       63 |  −0.3 °C |   **0.4 °C** |    2.8 °C |
| Surface instability   |       64 |     +238 |          240 | 2953 J/kg |

Taken as a layer rather than as two edges, **the band we draw overlaps the band
the balloon measured by a median of 95.7%.** The layer is about 2,500 m deep.
All 64 ascents overlap by more than 80%, and 56 of them by more than 90%.

Bias sits near zero on both edges, so the misses are scatter rather than a
standing offset. There is nothing to correct for.

**This is agreement with the instrument the crews are actually briefed on** —
not with an outside yardstick. The rows the operator prints are the seeding
decision: the freezing level and the −15 °C height bound the window where silver
iodide does anything.

Instability is wide and nothing in the product leans on it.

---

## Finding 2 — the flares almost never fall inside what we paint

The model publishes once an hour. Aircraft do not wait for it. A flare released
at 1843Z is 17 minutes from one reading and 43 from the other, and picking
either one reports a coin toss as though it were a measurement.

So we ask both. Paint the liquid at the hour below and the hour above. If a
place has liquid in both, it had liquid across the whole gap, and which hour you
pick stops mattering.

**All 497 releases of the season. 492 got an answer at both ends.**

| What we asked                          | Held in both | One only | Neither |
| -------------------------------------- | -----------: | -------: | ------: |
| Was there liquid in the seeding band?  |    17 (3.5%) |      120 |     355 |
| Was the cloud seedable, ignoring rain? |    17 (3.5%) |      115 |     360 |
| Was the cloud seedable, rain included? | **0 (0.0%)** |       16 |     476 |

Three things come out of that table.

**Not one flare in the season landed in a place we called seedable at both
hours.** Zero out of 492.

**The first two rows are the same number.** Every place that had liquid also
passed every other test — cloud base, band position, cloud seen, top temperature
— every time. Those four tests never rejected anything all season. In practice
the product is not six tests. It is liquid, and then rain.

**A quarter of flares flip.** 120 of 492 had liquid at one hour and none at the
other. For those, the hour you pick _is_ the answer. This is the timing problem
measured rather than argued about, and it is why single-hour numbers should not
be quoted.

The 17 that held are not spread out. Five days carry all of them — 19 April
(7 of 13), 22 May (5 of 23), 29 August (3 of 25), 11 August (1 of 46), and
24 October (1 of 17). **The other 29 days contribute nothing.** Whatever the
disagreement is, it is not an even error rate, which means it can be diagnosed.

### Why: we rule out rain, and they seed rain on purpose

**All 17 flares that held liquid were rejected for rain**, at one hour or both.
That single test is the entire distance between the second row of the table and
the third.

Across those readings the measured reflectivity runs 15 to 49 dBZ with a median
of 35. The product rules a cloud out at 20. These are not cells that crept over
a line — they are raining hard, and the product is right that they are.

The operators seed them anyway, deliberately. They work the growing turret on
the flank of a storm whose core is already dumping rain. **A 12 km cell cannot
tell those two apart.** The release point and the mature core 8 km away land in
the same cell, and the averaged reflectivity is dominated by the core — the part
of the storm the crew is deliberately avoiding.

So the test asks a fair question — has this cloud already spent its liquid — at
a resolution that cannot answer it. Moving the threshold does not help when the
typical cell sits at 35 dBZ.

**This is a finding about the product, not about the operators.**

### What it argues for

Report rain instead of disqualifying on it. Two answers, not one: is this cloud
worth seeding, and has it already spent its liquid. The second is worth showing
and should not silently suppress the first. That is also what the operator does
— they see the echo and fly it anyway.

`eval/bracket.mjs` already computes this as its own test, so both numbers exist
today with no re-run.

---

## What nothing can check

| Layer                          | What could check it         | Verdict          |
| ------------------------------ | --------------------------- | ---------------- |
| Seeding band geometry          | The balloons                | **Checked**      |
| Temperature profile            | The balloons                | **Checked**      |
| Reflectivity                   | Reported cell readings      | **Checked**      |
| Supercooled liquid in the band | Nothing measures it         | **Unverifiable** |
| Cloud-top phase                | Nothing measures it         | **Unverifiable** |
| Cloud base                     | Pilot calls, twice a season | Anecdote         |
| Warm cloud depth               | In their briefing, not ours | Not produced     |

**The band is right and the liquid inside it is unchecked.** Those two sentences
carry the whole evaluation. The band decides _where_ the liquid is measured; the
liquid itself decides 78.5% of all answers, and nothing in the Texas record can
confirm or deny it.

Salt-flare work is out of scope entirely. The product models the silver-iodide
process only, and warm cloud depth — the reading that decides a salt flare — is
in the operator's briefing and absent from ours.

---

## How to rerun any of it

Everything needs a running server and nothing else. No install, no key.

```bash
docker-compose up                      # or cd server && yarn dev
node eval/releases.mjs                 # the PDFs  → data/releases-2025.json
node eval/reconcile.mjs                # finding 1 → out/reconcile-2025.json
node eval/reconcile.mjs --score        # finding 1 again, instantly, no fetching
node eval/bracket.mjs                  # finding 2 → out/bracket-2025.json
node eval/held.mjs 2025-04-19          # one day painted → out/held-<date>.json
```

**Cost is downloads, not minutes.** Reading one hour out of the archive takes
30–60 seconds; every later question about that same hour is instant. `bracket.mjs`
asks 994 questions but downloads 125 hours, because flares cluster.

`--resume` continues a run that was interrupted. `eval/README.md` has the rest.

---

## Limits to quote alongside the results

**The balloon is close in time, not simultaneous.** It is released about 45
minutes before its nominal hour and reaches the seeding band minutes into the
flight, so the gap is 20–30 minutes. That is survivable here and would not be for
a flare: a temperature profile at 4–7 km moves tens of metres in an hour, while a
growing storm swings 40 dBZ in the same span.

**The sounding numbers are the operator's reading**, lifted from their report
rather than from raw balloon data, so they carry that reading's mistakes. One Del
Rio row states a freezing level below sea level; impossible values are dropped
when scored.

**Two sites, one hour.** Midland and Del Rio bracket the target counties without
sitting inside most of them, and 12Z is morning while seeding flies in the
afternoon.

**A 12 km cell is the resolution limit of the whole test**, and it is what
defeats the rain question above.

**This measures the atmosphere, not what a forecaster could have had.** Each
release is scored against the reading nearest it in time. The model publishes
about 50 minutes after the hour, so nobody actually held the 19Z reading at
1843Z. That is a limit on operating from this platform, not on measuring against
it, and the two must not be quoted as one number.

**Rainfall is not measured and no claim is made about it.** Attribution needs a
randomised or target/control design over seasons, not a season of flare
positions.

**How far back this can go at all:** the model reaches 2014-07-30, radar
2020-10-14, and satellite cloud top only 2023-03-23. The satellite binds.

---

## Sources

- [WTWMA 2025 operations, with the per-day reports](https://westtxwxmod.com/?page_id=23)
- [TDLR — rain enhancement operations in Texas](https://www.tdlr.texas.gov/weather/summary.htm)
- [Census TIGERweb State_County service](https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/State_County/MapServer)
- Friedrich et al. (2020), _Quantifying snowfall from orographic cloud seeding_,
  PNAS 117(10) 5190–5195 — [PMC7071876](https://pmc.ncbi.nlm.nih.gov/articles/PMC7071876/)
- Buckets: `noaa-hrrr-bdp-pds`, `noaa-goes16`, `noaa-goes19`, `noaa-mrms-pds`
