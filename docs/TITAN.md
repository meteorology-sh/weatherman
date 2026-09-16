# TITAN — the radar software Texas seeds on, and what it leaves for us

TITAN is Thunderstorm Identification, Tracking, Analysis and Nowcasting: a
program that finds storms in three-dimensional radar data, tracks them from
one volume scan to the next, and extrapolates where they will be. It is the
tool the Texas programs select cells with, and the numbers in parentheses on
every flare row in their reports are the cell identifiers it assigns.
`PROXY.md` is the selection loop it sits inside.

It is not a NOAA product. It is maintained inside LROSE, the Lidar Radar Open
Software Environment, by the Department of Atmospheric Science at Colorado
State University and the Earth Observing Laboratory at NSF NCAR, and funded by
the National Science Foundation. MRMS, which this app reads, is the NOAA one.
The two systems come from different agencies and have never been plumbed into
each other.

---

## 1. What it measures

TITAN reads a radar volume in Cartesian coordinates, finds the contiguous
regions above a reflectivity threshold, and reports each one as an object:
volume, projected area, precipitation mass and flux, mass-weighted centroid,
maximum reflectivity, echo top and base, vertically integrated liquid, and an
ellipse fitted to the footprint. It then matches objects between consecutive
scans, which gives each storm an identifier that survives, a duration, and a
rate of change of volume. From the track it extrapolates the centroid and
trends the ellipse forward.

Three of those readings appear in the Texas reports as a triple, and `eval`
parses them: echo top in kilometers, vertically integrated liquid in kg/m²,
and reflectivity in dBZ. A row reads `16.5-17.5 km, 93-287 kg/m2, 63-72 dBZ`.

**It observes reflectivity and nothing else.** There is no temperature in it,
no cloud base, no phase, no liquid water. Radar cannot see supercooled liquid
water — 10 µm droplets are effectively invisible at these wavelengths — so the
variable seeding works on was never in the instrument. That is the same limit
`MEASUREMENTS.md` §5 states, and it is why a cell identifier and a seedability
verdict are different claims.

## 2. What feeds it, and why that is the fragile part

TITAN builds its own volumes from single-radar NEXRAD Level II: one radar's
full scan, every elevation angle, in the radar's own polar coordinates, a new
volume about every five minutes. The Texas programs read two radars, at
Midland and at San Angelo, named MAF and SJT in their reports.

MRMS is a different product built from the same radars. NOAA composites about
180 of them, with gauges, satellite and model data, onto a 1 km national grid
every 2 minutes, and applies quality control before publishing. NEXRAD Level II
is one farm's raw crop; MRMS is the national mill's flour.

**The difference that matters is who keeps the feed alive.** Streaming Level II
arrives over the Local Data Manager, a store-and-forward network that pushes
products down a long-lived connection. A push connection holds state. When it
wedges, or an upstream relay drops the subscriber, the data stops and nothing
upstream reports it. This app pulls MRMS from an S3 bucket over HTTPS instead:
every read is a fresh request, there is no session to wedge and no local store
of volumes to fill. NOAA runs the ingest, the quality control and the
compositing that the Texas desk runs itself.

Nothing prevents TITAN from reading MRMS. It takes gridded Cartesian volumes,
and MRMS publishes a three-dimensional reflectivity field — the same field this
app's 18 dBZ echo top is read from. TITAN is twenty years older than MRMS, and
these installations are older than it too.

## 3. What the 2025 reports record

West Texas and Trans-Pecos filed 84 daily reports between them. **Thirty of
those days record TITAN not working**: the feed not arriving, arriving late,
arriving intermittently, or the program being restarted. Six days record
restarting or rebooting it — 29 April, 22 June, 27 and 29 August, 5 September
and 13 September.

Each report names the cells it seeded. When TITAN is running, that line carries
its numeric identifiers. When it is not, the line reads `Cloud 1; Cloud 2 (no
TITAN IDs)` or `N/A`.

| Month     | Reports naming cells by identifier | Reports with no identifier |
| --------- | ---------------------------------: | -------------------------: |
| March     |                                  0 |                          0 |
| April     |                                  8 |                          3 |
| May       |                                 10 |                          2 |
| June      |                                 12 |                          4 |
| August    |                                 21 |                          2 |
| September |                                  2 |                         12 |
| October   |                                  0 |                          7 |

Fifty-one reports through August name their cells by identifier against eleven
that cannot. In September and October it is two against nineteen. One March
report words the line differently and is in neither column.

The cell readings fall with them. Counting the echo top, liquid and
reflectivity triples the two programs printed, over the days they seeded:

| Month     | Seeded days | Cell readings | Per seeded day |
| --------- | ----------: | ------------: | -------------: |
| March     |           1 |             0 |            0.0 |
| April     |           9 |            89 |            9.9 |
| May       |          10 |           103 |           10.3 |
| June      |          13 |           134 |           10.3 |
| August    |          21 |           246 |           11.7 |
| September |          12 |            18 |            1.5 |
| October   |           7 |            28 |            4.0 |

That is 572 readings over 54 seeded days through August, and 46 over 19 seeded
days in September and October.

The two programs share a desk and share narrative text on days both flew — the
27 and 29 August entries are identical in both reports — so these are thirty
report-days, not thirty independent observations.

## 4. What fails is the feed, not the tracking

No entry in any report describes a tracking error, a wrong merge or a bad
extrapolation. Every failure is the radar data not arriving. The reports say
so in those words:

- 22 June: "TITAN restarted as MAF data was not coming in."
- 27 August: "TITAN radar feed has not come in for about 12-15 minutes, may be
  related to hard drive getting full (currently at 80%). Restarted program."
  Two restarts later, "TITAN, after third restart, is having both radars come
  in for the time being."
- 29 August: "rebooted TITAN machine, radar data still not coming in," then
  "both radars are 15 & 20 mins behind. Will just let it run."
- 5 September: "restarted TITAN as SJT feed wasn't coming in," and twenty-three
  minutes later, "SJT feed coming in but MAF is not."
- 13 September: "have restarted TITAN twice now because radar feeds stopped
  coming in. MAF is coming back in but so far not SJT."
- 23 September: "TITAN still not getting radar feeds, have request for help
  out." The identifiers do not return for the rest of the season.

**The two radars fail separately and return separately.** One is out while the
other runs, then they swap. A full disk stops everything at once, so the disk
the 27 August entry names is not what the pattern describes, and rebooting the
machine on 29 August did not restore the data. The failure sits in the feed
path rather than on the desk.

The reports never name the display program, so what the meteorologist watches
TITAN through is not recorded.

Flights continued throughout. On 13 September the report reads cell tops,
liquid and reflectivity off RadarScope while TITAN is down, which returns
reflectivity but no tracked object, no identifier and no rate of change. The
selection rule those attributes exist to serve — a cell still growing, in the
first half of its lifetime — was being judged by eye on those days.

One further entry is about the site rather than the software: on 19 August,
"Power outage from storm here just after 2210Z. Had to get stuff back online."

## 5. What this settles about this app

**TITAN is better than this app at the thing it does.** It reports storm
volume, precipitation mass and flux from a three-dimensional scan, keeps an
identifier across scans through mergers and splits, and extrapolates position.
The storm objects in `server/src/lib/services/mrms/objects.ts` are contiguous
20 dBZ regions on a two-dimensional mosaic with an area, a maximum, a centroid,
an age floored at the scans on hand, a heading and a change in area. The header
of that file says it is not TITAN, and it is not.

**This app answers a question TITAN has no variable for.** Cloud base, freezing
level, the −15 °C height, the seeding band, warm-cloud depth, observed cloud-top
temperature and phase, modeled supercooled liquid water, and which flare the
column supports. A reflectivity core at or above the freezing level is the
whole of TITAN's contribution to that question.

**This app's radar source cannot fail the way theirs does.** There is no
subscription to lose, no volume store to fill and no machine at the desk. When
a source does fail, the notice board says so and the echo top falls back to
NOAA's archived copy with its age in minutes, which is the reading the 29
August entry was making by eye.

Two limits on how far that argument goes:

- The meteorologist works cells with identifiers that persist across scans and
  writes the flight log in them. This app has no identifier that survives a gap
  in the mosaic, so it cannot speak in the vocabulary the log is written in.
- A stalled feed is fixable where it stands, with supervision, an alarm on
  staleness and a second source. Anyone reading the thirty days as proof that
  the programs need different software should expect the cheaper fix as the
  reply. The durable statement is the one in §1: nothing TITAN reports, working
  or not, is about phase, cloud base, or which flare to carry.

## 6. What this does not settle

- **Why the feed stops.** The reports record the symptom at the desk. Whether
  the cause is the subscription, an upstream relay, the site's network or the
  machine is not in them.
- **What the programs pay or who supports them.** A request for help stayed
  open for over a month, which describes the support path and not a budget.
- **Whether the other three programs run TITAN this way.** The Panhandle
  mentions a TITAN cell once and South Texas and the Rolling Plains never name
  it, so the thirty days are West Texas and Trans-Pecos only.
- **Whether TITAN would track better on MRMS.** A 1 km composited grid and a
  full-resolution single-radar volume are different inputs, and no comparison
  here has been run.

---

### Sources

- [LROSE](https://ncar.github.io/lrose-docs/) · [lrose-core releases](https://github.com/NCAR/lrose-core/releases) · [NCAR/lrose-titan](https://github.com/NCAR/lrose-titan) · [LROSE wiki: Titan](http://wiki.lrose.net/index.php/Titan)
- [TITAN NEXRAD ingest, which names the Local Data Manager as required for streaming Level II](https://github.com/NCAR/lrose-titan/blob/master/projects/nexrad_multiple/README.md)
- Dixon and Wiener 1993, [TITAN: Thunderstorm Identification, Tracking, Analysis, and Nowcasting](https://journals.ametsoc.org/view/journals/atot/10/6/1520-0426_1993_010_0785_ttitaa_2_0_co_2.xml), _Journal of Atmospheric and Oceanic Technology_ 10(6)
- The 2025 daily reports in `eval/cache/2025/`, and the records `eval` parses
  from them in `eval/data/2025/`
