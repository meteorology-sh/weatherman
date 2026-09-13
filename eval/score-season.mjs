/**
 * One season's evaluation, as the markdown document it is published as.
 *
 * `node eval/score-season.mjs [--season=2025] > docs/EVALUATION.md` — no
 * server, no network. 2025 is `docs/EVALUATION.md`; any other season is
 * `docs/EVALUATION-<season>.md`. Tables are aligned and prose is wrapped here,
 * so what it prints is the document as committed.
 *
 * Layer overlap, the fly verdicts, tolerance and seedable ground come from the
 * painted days in `out/<season>/`, and the counties flown from the boundary file. The before column of a radial program comes
 * from the same days painted with its bearings read as true north, in
 * `out/<season>/as-printed/`. Releases the record cannot place come from the
 * flight records in `data/<season>/`. The radiosonde tables come from the
 * balloon files, with a Midland or Del Rio morning two programs share counted
 * once in the season row.
 */

// Node
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

// Local
import { bandOverlap, spread, summarizeOverlaps } from "./lib/band-score.mjs";
import { inFeature, rowGrid, sharedAreaKm2, spansByRow } from "./lib/geo.mjs";
import { COUNTIES, regionsOf, seasonDirs, seasonOf } from "./lib/season.mjs";
import { positionBoundKm, radialOf } from "./lib/tolerance.mjs";

const SEASON = seasonOf();
const { data: DATA, out: OUT } = seasonDirs(SEASON);

/** The layers Weatherman draws, in the panel's order, and a short label. */
const LAYERS = [
  ["target", "Seeding opportunity", "Seeding opportunity"],
  ["radar", "Radar reflectivity", "Radar"],
  ["echoFreeze", "Echo past freezing", "Echo past freezing"],
  ["cloudBase", "Cloud base", "Cloud base"],
  ["liquid", "Supercooled liquid water", "SLW"],
];

/**
 * A program whose report data needs a transformation nobody has made, and
 * what the record does instead. The share of its releases landing in the
 * county their own row names is printed beside it, against the largest program
 * that prints coordinates it can be read against.
 */
const NOT_ADJUSTED = {
  plains:
    "coordinates are sometimes decimal degrees and sometimes minutes. They are read as decimal degrees",
};

/**
 * Layers whose edge is placed by an observation valid at the release minute.
 *
 * These fills have already followed the storm before anything is carried to
 * meet them, so the release is scored where it happened. `paint.mjs` records
 * this on each flare as `near.<layer>.clock`; a flare without it was drifted to
 * the model hour, and for these layers its undrifted distance is the answer.
 */
const MEASURED_EDGE = new Set(["cloudBase", "radar", "target", "echoFreeze"]);

function insideByClock(near, key) {
  if (near.clock) return near.inside;
  if (!MEASURED_EDGE.has(key)) return near.inside;
  return near.kmAtRelease === 0;
}

/** Distance to the nearest edge from either side, at the same clock. */
function edgeByClock(near, key) {
  if (near.clock || !MEASURED_EDGE.has(key)) return near.edgeKm ?? null;
  return near.edgeKmAtRelease ?? null;
}

function kmByClock(near, key) {
  if (near.clock) return near.km;
  if (!MEASURED_EDGE.has(key)) return near.km;
  return near.kmAtRelease;
}

/**
 * Whether a release has an answer for this layer.
 *
 * A layer that painted nothing in the window is an answer — the release is
 * outside it — so `empty` counts. A null is a route that failed, and a failed
 * route is not a miss; `verify.mjs` refuses a season that has one.
 */
function scorable(near) {
  return Boolean(near) && (near.km != null || near.empty === true);
}

/** The click readout's verdict, charged to the first test the cell failed. */
const BASE_FAILS = new Set(["noCloudBase", "baseTooHigh"]);
const flies = (flare) => flare.cell?.target === "target";
const baseOk = (flare) =>
  Boolean(flare.cell) && !BASE_FAILS.has(flare.cell.target);
const rainOk = (flare) => baseOk(flare) && flare.cell.target !== "noStorm";
const supportsIce = (flare) => ["ice", "both"].includes(flare.cell?.payload);
const supportsSalt = (flare) => ["salt", "both"].includes(flare.cell?.payload);

/**
 * Whether a release has an answer for a layer, and whether it is inside.
 *
 * **The seeding opportunity is scored on the cell, not the outline.** A release
 * is in it when a click on the 3 km cell it landed in says FLY. The stored
 * outline is smoothed and can disagree with the cells along its edge
 * (`docs/GEOMETRY.md`); every other layer is scored against its outline.
 */
const answered = (flare, key) =>
  key === "target" ? Boolean(flare.cell) : scorable(flare.near?.[key]);
const inLayer = (flare, key) =>
  key === "target"
    ? flies(flare)
    : scorable(flare.near?.[key]) && insideByClock(flare.near[key], key);

/** Distance to the drawn outline's edge, from whichever side the release is. */
function outlineEdgeKm(near, key) {
  if (!scorable(near)) return null;
  return insideByClock(near, key)
    ? edgeByClock(near, key)
    : kmByClock(near, key);
}

const regions = await regionsOf(SEASON);
const evaluable = regions.filter((region) => region.releases);

const counties = new Map(
  JSON.parse(await readFile(COUNTIES, "utf8")).features.map((feature) => [
    feature.properties.BASENAME,
    feature,
  ])
);

/** Null where the row names no county, or one outside the boundary file. */
function inNamedCounty(flare) {
  const shape = counties.get(flare.county);
  if (!shape) return null;
  return inFeature(shape, flare.lon, flare.lat);
}

/**
 * The ground of the counties a set of releases name, measured along rows.
 *
 * A program's area is every county one of its located releases names. The
 * counties overlap between programs, and the rows union them, so a county two
 * programs fly counts once in the season.
 */
function flownGround(flares) {
  const names = new Set(
    flares.map((flare) => flare.county).filter((name) => counties.has(name))
  );
  const polygons = [...names].flatMap((name) => {
    const { type, coordinates } = counties.get(name).geometry;
    return type === "Polygon" ? [coordinates] : coordinates;
  });
  const grid = rowGrid(polygons);
  const rows = spansByRow(polygons, grid);
  return {
    counties: names.size,
    grid,
    rows,
    km2: sharedAreaKm2(rows, rows, grid),
  };
}

/**
 * How much of that ground the seeding opportunity covered at one hour, km².
 * Null where the frame failed.
 */
function seedableKm2(frame, ground) {
  const levels = frame.target?.levels;
  if (!levels) return null;
  const outline = spansByRow(
    levels.flatMap((level) => level.polygons ?? []),
    ground.grid
  );
  return sharedAreaKm2(ground.rows, outline, ground.grid);
}

/* ---------- reading ---------- */

/** Every painted day in a directory, by region. A missing directory is none. */
async function paintedDays(dir) {
  let names = [];
  try {
    names = await readdir(dir);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const days = new Map();
  for (const name of names.filter(
    (entry) => entry.startsWith("painted-") && entry.endsWith(".json")
  )) {
    const painted = JSON.parse(await readFile(join(dir, name), "utf8"));
    if (!days.has(painted.region)) days.set(painted.region, []);
    days.get(painted.region).push(painted);
  }
  return days;
}

const painted = await paintedDays(OUT);
const asPrinted = await paintedDays(join(OUT, "as-printed"));

const flaresOf = (days) =>
  (days ?? []).flatMap((day) => (day.analyses ?? []).flatMap((a) => a.flares));

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const half = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[half]
    : (sorted[half - 1] + sorted[half]) / 2;
}

const stats = new Map();
for (const region of evaluable) {
  const days = painted.get(region.id) ?? [];
  const flares = flaresOf(days);
  const row = {
    region,
    days: days.length,
    flares,
    layers: Object.fromEntries(
      LAYERS.map(([key]) => [key, { inside: 0, within: 0, atEdge: 0 }])
    ),
    positionKm: [],
    cellKm: Object.fromEntries(LAYERS.map(([key]) => [key, []])),
    radial: 0,
    placed: 0,
    ground: flownGround(flares),
    // One share per flying day: the counties' seedable ground at the day's
    // median flown hour.
    seedableShares: [],
  };
  for (const day of days) {
    for (const [key] of LAYERS) {
      if (day.cellKm?.[key] != null) row.cellKm[key].push(day.cellKm[key]);
    }
    const hourly = Object.values(day.frames ?? {})
      .map((frame) => seedableKm2(frame, row.ground))
      .filter((km2) => km2 !== null);
    if (hourly.length && row.ground.km2) {
      row.seedableShares.push(median(hourly) / row.ground.km2);
    }
    for (const flare of (day.analyses ?? []).flatMap((a) => a.flares)) {
      const positionKm = positionBoundKm(flare, region.origin);
      row.positionKm.push(positionKm);
      if (radialOf(flare, region.origin)) row.radial += 1;
      if (inNamedCounty(flare)) row.placed += 1;
      for (const [key] of LAYERS) {
        if (!answered(flare, key)) continue;
        const marginKm = (day.cellKm?.[key] ?? NaN) + positionKm;
        const edgeKm = outlineEdgeKm(flare.near?.[key], key);
        const nearEdge = edgeKm != null && edgeKm <= marginKm;
        if (inLayer(flare, key)) {
          row.layers[key].inside += 1;
          if (nearEdge) row.layers[key].atEdge += 1;
        } else if (nearEdge) {
          row.layers[key].within += 1;
        }
      }
    }
  }
  stats.set(region.id, row);
}

const rows = [...stats.values()].filter((row) => row.flares.length);
const seasonFlares = rows.flatMap((row) => row.flares);
const seasonDays = rows.reduce((sum, row) => sum + row.days, 0);

/* ---------- writing ---------- */

const doc = [];

const WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven"];
const counted = (n) => WORDS[n] ?? String(n);
const thousands = (n) => n.toLocaleString("en-US");
const pct = (n, d) => (d ? `${((100 * n) / d).toFixed(1)}%` : "—");
const share = (n, d) => (d ? `${n}/${d} (${pct(n, d)})` : "—");
const bold = (text) => `**${text}**`;

/** A paragraph, wrapped at 80 columns. */
function say(text) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    if (line && `${line} ${word}`.length > 80) {
      lines.push(line);
      line = word;
    } else {
      line = line ? `${line} ${word}` : word;
    }
  }
  if (line) lines.push(line);
  doc.push(lines.join("\n"), "");
}

const heading = (text) => doc.push(`## ${text}`, "");

/**
 * A table, padded the way the repository's formatter pads one: each column as
 * wide as its widest cell, numbers right-aligned under a `---:` rule.
 */
function table(columns, body) {
  const widths = columns.map(([label], i) =>
    Math.max(3, label.length, ...body.map((cells) => cells[i].length))
  );
  const right = columns.map(([, align]) => align === "right");
  const line = (cells) =>
    `| ${cells
      .map((text, i) =>
        right[i] ? text.padStart(widths[i]) : text.padEnd(widths[i])
      )
      .join(" | ")} |`;
  doc.push(
    line(columns.map(([label]) => label)),
    `| ${widths
      .map((width, i) =>
        right[i] ? `${"-".repeat(width - 1)}:` : "-".repeat(width)
      )
      .join(" | ")} |`,
    ...body.map(line),
    ""
  );
}

const L = "left";
const R = "right";

doc.push(`# Evaluation — the ${SEASON} Texas season`, "");
say(
  `${seasonDays} flying days across ${counted(rows.length)} programs. How to ` +
    "run the job is `eval/README.md`."
);

/* The season at a glance */

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const dayName = (date) =>
  `${Number(date.slice(8))} ${MONTH_NAMES[Number(date.slice(5, 7)) - 1]}`;

const unplaced = [];
/** Releases whose printed position had one digit typed twice. */
const retyped = [];
for (const region of evaluable) {
  const { days } = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );
  const why = [];
  let total = 0;
  for (const day of days.filter((entry) => entry.seeded)) {
    const missed = day.releases.filter((release) => !release.located);
    if (!missed.length) continue;
    total += missed.length;
    const blank = missed.filter((release) => release.lat == null);
    const parts = [];
    if (blank.length) {
      parts.push(
        `${blank.length} ${blank.length === 1 ? "row prints" : "rows print"} no position`
      );
    }
    for (const release of missed.filter((entry) => entry.lat != null)) {
      parts.push(
        `${release.lat} / ${release.lon} is outside the program's window`
      );
    }
    why.push(`${dayName(day.date)}: ${parts.join("; ")}`);
  }
  if (total) unplaced.push([region.short, String(total), why.join("; ")]);
  for (const day of days.filter((entry) => entry.seeded)) {
    for (const release of day.releases) {
      if (release.printedLat == null && release.printedLon == null) continue;
      const printed = `${release.printedLat ?? release.lat} / ${release.printedLon ?? release.lon}`;
      retyped.push(
        `${region.short} on ${dayName(day.date)} at ${release.timeZ}Z prints ` +
          `${printed}, read as ${release.lat} / ${release.lon}`
      );
    }
  }
}
const unplacedCount = unplaced.reduce(
  (sum, [, total]) => sum + Number(total),
  0
);

heading("The season at a glance");
say(
  `The reports print ${thousands(seasonFlares.length + unplacedCount)} flare ` +
    `rows. ${unplacedCount ? `${thousands(unplacedCount)} have no usable position (the last table in this section), which leaves` : "Every one has a usable position:"} ` +
    `${thousands(seasonFlares.length)} located flares. Every located flare is ` +
    "in every denominator below."
);

const seedable = seasonFlares.filter((flare) => inLayer(flare, "target"));
table(
  [
    ["Season", L],
    ["Flares", R],
  ],
  [
    ["Rows in the reports", String(seasonFlares.length + unplacedCount)],
    ["No usable position", String(unplacedCount)],
    [bold("Located"), bold(seasonFlares.length)],
    ["In the seeding opportunity: FLY", String(seedable.length)],
    ["Outside it: DON'T FLY", String(seasonFlares.length - seedable.length)],
  ]
);
say(
  "A flare is in the seeding opportunity when a click on the 3 km cell it " +
    "landed in says FLY. How a position finds its cell, and why the drawn " +
    "outline can disagree with the cells along its edge, is `docs/GEOMETRY.md`."
);

if (unplaced.length) {
  say(
    "Rows with no usable position stay in the flight record and out of every " +
      "denominator."
  );
  table(
    [
      ["Program", L],
      ["Releases not placed", R],
      ["Why", L],
    ],
    unplaced
  );
}

/* Flare overlap with each layer */

heading("Flare overlap with each layer");
say(
  "The share of flares that landed inside each layer at the minute of " +
    "release. Seeding opportunity is the FLY cell a click answers; the other " +
    "layers are their drawn outlines. Counties flown is every county a " +
    "program's releases name, and its area. Seedable, typical flying day is " +
    "the share of those counties inside the seeding opportunity: each flying " +
    "day is read at its median flown hour, and the column is the median day. " +
    "The season row is the median of every program's flying days, over the " +
    "counties any program flew."
);

const km2 = (n) => `${thousands(Math.round(n))} km²`;
const layerCount = (flares, key) =>
  flares.filter((flare) => inLayer(flare, key)).length;

const seasonGround = flownGround(seasonFlares);
const countiesCell = (ground) => `${ground.counties} · ${km2(ground.km2)}`;
const seedableCell = (shares) => {
  const typical = median(shares);
  return typical == null ? "—" : `${(100 * typical).toFixed(1)}%`;
};

table(
  [
    ["Program", L],
    ["Releases", R],
    [LAYERS[0][1], R],
    ["Counties flown", R],
    ["Seedable, typical flying day", R],
    ...LAYERS.slice(1).map(([, label]) => [label, R]),
  ],
  [
    ...rows.map((row) => [
      row.region.short,
      String(row.flares.length),
      share(row.layers.target.inside, row.flares.length),
      countiesCell(row.ground),
      seedableCell(row.seedableShares),
      ...LAYERS.slice(1).map(([key]) =>
        share(row.layers[key].inside, row.flares.length)
      ),
    ]),
    [
      bold("Season"),
      bold(seasonFlares.length),
      bold(share(layerCount(seasonFlares, "target"), seasonFlares.length)),
      bold(countiesCell(seasonGround)),
      bold(seedableCell(rows.flatMap((row) => row.seedableShares))),
      ...LAYERS.slice(1).map(([key]) =>
        bold(share(layerCount(seasonFlares, key), seasonFlares.length))
      ),
    ],
  ]
);

/* FLY or DON'T FLY */

heading("FLY or DON'T FLY at each release");
say(
  "What a click on the release's own 3 km cell answered: cloud base under " +
    "18,000 ft MSL, 20 dBZ rain in the cell or its neighbours, and a payload " +
    "the column supports."
);

const CRITERIA = [
  ["Cloud base under 18,000 ft", baseOk],
  ["… and rain within a cell", rainOk],
  ["Ice supported", supportsIce],
  ["Salt supported", supportsSalt],
  ["FLY", flies],
];
const criteriaRow = (label, flares, wrap = (text) => text) => [
  wrap(label),
  wrap(String(flares.length)),
  ...CRITERIA.map(([, passes]) =>
    wrap(share(flares.filter(passes).length, flares.length))
  ),
];
table(
  [["Program", L], ["Releases", R], ...CRITERIA.map(([label]) => [label, R])],
  [
    ...rows.map((row) => criteriaRow(row.region.short, row.flares)),
    criteriaRow("Season", seasonFlares, bold),
  ]
);

const REFUSALS = [
  ["No cloud base under 18,000 ft", (flare) => !baseOk(flare)],
  ["No 20 dBZ rain within a cell", (flare) => baseOk(flare) && !rainOk(flare)],
  ["No payload supported", (flare) => rainOk(flare) && !flies(flare)],
];
const refused = (flares) =>
  flares.filter((flare) => flare.cell && !flies(flare));
const payloadRefusals = REFUSALS[2][1];
const shownRefusals = refused(seasonFlares).some(payloadRefusals)
  ? REFUSALS
  : REFUSALS.slice(0, 2);
say(
  "For each DON'T FLY, the first test its cell failed." +
    (shownRefusals.length < REFUSALS.length
      ? " No cell failed the payload test."
      : "")
);
const refusalRow = (label, flares, wrap = (text) => text) => {
  const dont = refused(flares);
  return [
    wrap(label),
    wrap(String(dont.length)),
    ...shownRefusals.map(([, test]) => wrap(String(dont.filter(test).length))),
  ];
};
table(
  [
    ["Program", L],
    ["DON'T FLY", R],
    ...shownRefusals.map(([label]) => [label, R]),
  ],
  [
    ...rows.map((row) => refusalRow(row.region.short, row.flares)),
    refusalRow("Season", seasonFlares, bold),
  ]
);

/* Uncertainty */

heading("Uncertainty");
say(
  "A flare within the margin of the seeding opportunity's edge could be on " +
    "either side of it. The margin is one 3 km grid cell plus how coarsely " +
    "the report prints the flare's position."
);

const signed = ({ within, atEdge }) => `+${within} / −${atEdge}`;
const points = (n, d) => ((100 * n) / d).toFixed(1);
const plusMinus = ({ inside, within, atEdge }, n) =>
  `${pct(inside, n)} +${points(within, n)} / −${points(atEdge, n)}`;
const seasonTarget = rows.reduce(
  (sum, row) => ({
    inside: sum.inside + row.layers.target.inside,
    within: sum.within + row.layers.target.within,
    atEdge: sum.atEdge + row.layers.target.atEdge,
  }),
  { inside: 0, within: 0, atEdge: 0 }
);
table(
  [
    ["Program", L],
    ["Releases", R],
    ["Seeding opportunity", R],
    ["Within the margin", R],
    ["Share", R],
  ],
  [
    ...rows.map((row) => [
      row.region.short,
      String(row.flares.length),
      String(row.layers.target.inside),
      signed(row.layers.target),
      plusMinus(row.layers.target, row.flares.length),
    ]),
    [
      bold("Season"),
      bold(seasonFlares.length),
      bold(seasonTarget.inside),
      bold(signed(seasonTarget)),
      bold(plusMinus(seasonTarget, seasonFlares.length)),
    ],
  ]
);
say(
  "Within the margin counts the DON'T FLY flares within the margin of the " +
    "seeding opportunity's drawn edge (+), and the FLY flares within it (−). " +
    "Share is each count over releases."
);

const targetCellKm = median(rows.flatMap((row) => row.cellKm.target));
const km1 = (n) => (n < 0.05 ? "under 0.1 km" : `${n.toFixed(1)} km`);
const printedAs = (row) =>
  row.radial > row.flares.length / 2 ? "Bearing and range" : "Coordinates";
table(
  [
    ["Program", L],
    ["Position printed as", L],
    ["Rounding", R],
    ["Margin", R],
    ["Lands in the county its row names", R],
  ],
  [
    ...rows.map((row) => {
      const rounding = median(row.positionKm);
      return [
        row.region.short,
        printedAs(row),
        km1(rounding),
        km1(targetCellKm + rounding),
        share(row.placed, row.flares.length),
      ];
    }),
    [
      bold("Season"),
      "",
      "",
      "",
      bold(
        share(
          rows.reduce((sum, row) => sum + row.placed, 0),
          seasonFlares.length
        )
      ),
    ],
  ]
);

say(
  "The margin leaves out what no report says: the point a bearing and range " +
    "is measured from, and whether a Rolling Plains coordinate is minutes. " +
    "Where either is wrong, the flare tends to miss the county its own row " +
    "names, which is what the last column shows."
);

/* Report data that needs adjusting */

heading("Report data that needs adjusting");

const transformed = rows.filter(
  (row) => row.region.origin?.magneticVariationDeg != null
);
if (transformed.length) {
  say(
    `**Transformed.** ${counted(transformed.length).replace(/^./, (c) => c.toUpperCase())} ` +
      `${transformed.length === 1 ? "program prints" : "programs print"} a ` +
      "bearing from magnetic north and a range, from an origin their reports " +
      "never name. Before reads the bearing as true north."
  );
  const variation = (deg) => `${Math.abs(deg)}°${deg >= 0 ? "E" : "W"}`;
  table(
    [
      ["Program", L],
      ["What the report prints", L],
      ["Transformation", L],
      ["Before", R],
      ["After", R],
    ],
    transformed.map((row) => {
      const { origin } = row.region;
      const before = flaresOf(asPrinted.get(row.region.id));
      return [
        row.region.short,
        row.radial === row.flares.length
          ? `Bearing and range, all ${row.flares.length} releases`
          : `Bearing and range, ${row.radial} of ${row.flares.length} releases`,
        `Projected from ${origin.name}; bearing + ` +
          `${variation(origin.magneticVariationDeg)} variation of record`,
        before.length
          ? share(
              before.filter((flare) => inLayer(flare, "target")).length,
              before.length
            )
          : "—",
        bold(share(row.layers.target.inside, row.flares.length)),
      ];
    })
  );
}

if (retyped.length) {
  say(
    `**Retyped.** ${retyped.join("; ")}. A position outside the program's ` +
      "window is read with one doubled digit typed once when exactly one " +
      "such reading lands inside it."
  );
}

const reference = rows
  .filter((row) => !row.region.origin && !NOT_ADJUSTED[row.region.id])
  .sort((a, b) => b.flares.length - a.flares.length)[0];
for (const row of rows.filter((entry) => NOT_ADJUSTED[entry.region.id])) {
  say(
    `**Not adjusted.** ${row.region.short} ${NOT_ADJUSTED[row.region.id]}: ` +
      `${row.placed} of ${row.flares.length} land in the county the row names` +
      (reference
        ? `, against ${reference.placed} of ${reference.flares.length} for ${reference.region.short}.`
        : ".")
  );
}

/* Radiosondes */

heading("Radiosondes against the modeled column");

function bandRow(balloonRows) {
  const summary = summarizeOverlaps(
    balloonRows.map(bandOverlap).filter(Boolean)
  );
  const freeze = [];
  const top = [];
  // The CCL is scored over every ascent that prints one: it is the cloud-base
  // layer's fallback height, not a band edge, so an ascent whose band is
  // unusable can still say whether the fallback was right.
  const ccl = [];
  for (const row of balloonRows) {
    if (row.compared?.ccl?.error != null) ccl.push(row.compared.ccl.error);
    if (!bandOverlap(row)) continue;
    if (row.compared?.freezingLevel?.error != null) {
      freeze.push(row.compared.freezingLevel.error);
    }
    if (row.compared?.minus15Height?.error != null) {
      top.push(row.compared.minus15Height.error);
    }
  }
  return {
    summary,
    freeze: spread(freeze),
    top: spread(top),
    ccl: spread(ccl),
    cclN: ccl.length,
  };
}

/** How far our height sits from the balloon's on average, then the typical miss. */
function edge(s) {
  if (!s) return "—";
  const bias = Math.round(s.bias);
  const offset =
    bias === 0 ? "level" : `${Math.abs(bias)} m ${bias > 0 ? "high" : "low"}`;
  return `${offset} · ${Math.round(s.typical)} m typical`;
}

const sonde = [];
const byMorning = new Map();
for (const row of rows) {
  const name = row.region.runs?.balloons;
  if (!name) continue;
  let data;
  try {
    data = JSON.parse(await readFile(join(OUT, name), "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") continue;
    throw error;
  }
  sonde.push([row.region.short, bandRow(data.rows ?? [])]);
  for (const ascent of data.rows ?? []) {
    const key = `${ascent.date} ${ascent.site}`;
    if (!byMorning.has(key)) byMorning.set(key, ascent);
  }
}
const seasonSonde = bandRow([...byMorning.values()]);

const noSonde = rows
  .filter((row) => !row.region.runs?.balloons)
  .map((row) =>
    row.region.sounding?.includes("NAM")
      ? `The ${row.region.name} briefs on a NAM forecast rather than a balloon, and has no row.`
      : `The ${row.region.name} prints no radiosonde, and has no row.`
  );
say(
  "Each 12Z ascent a report prints, against the HRRR column at that hour and " +
    "site: the average offset, then the typical miss. The season row counts " +
    `each site-morning once. ${noSonde.join(" ")}`
);

const overlap = (s) => (s ? `${(s.mean * 100).toFixed(1)}%` : "—");
const over90 = (s) => (s ? `${s.over90} of ${s.n}` : "—");
doc.push("**Freezing level to −15 °C**", "");
table(
  [
    ["Program", L],
    ["Ascents", R],
    ["Freezing level", L],
    ["−15 °C height", L],
    ["Layer overlap", R],
    ["Overlap above 90%", R],
  ],
  [
    ...sonde.map(([short, band]) => [
      short,
      String(band.summary?.n ?? 0),
      edge(band.freeze),
      edge(band.top),
      overlap(band.summary),
      over90(band.summary),
    ]),
    [
      bold("Season"),
      bold(seasonSonde.summary?.n ?? 0),
      bold(edge(seasonSonde.freeze)),
      bold(edge(seasonSonde.top)),
      bold(overlap(seasonSonde.summary)),
      bold(over90(seasonSonde.summary)),
    ],
  ]
);

say(
  "**Convective condensation level**, the cloud-base layer's height where the " +
    "model has no cloud"
);
table(
  [
    ["Program", L],
    ["Ascents", R],
    ["CCL", L],
  ],
  [
    ...sonde.map(([short, band]) => [short, String(band.cclN), edge(band.ccl)]),
    [bold("Season"), bold(seasonSonde.cclN), bold(edge(seasonSonde.ccl))],
  ]
);

process.stdout.write(`${doc.join("\n").trimEnd()}\n`);
