// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  bearingDeg,
  destPoint,
  drawnStorms,
  foldTracks,
  identify,
  km,
  matchTracks,
  MERGE_STORM_KM,
  MIN_DRAWN_STORM_KM2,
  motionArrow,
  motionFrame,
  motionLengthKm,
  near,
  NEAR_LIMIT_KM,
  quietRing,
  stormStyle,
  upwindBoundary,
  upwindOf,
  upwindRing,
} from "../lib/services/mrms/objects";

// Types
import type { Grid, Geo } from "../lib/services/shared/contour";

/** A south-up regular grid. j = 0 is the southern row. */
function scene(
  rows: number[][],
  lat0 = 30,
  lon0 = -100,
  step = 0.01
): { grid: Grid; geo: Geo } {
  const ny = rows.length;
  const nx = rows[0].length;
  const values = new Float32Array(nx * ny);
  const lats = new Float32Array(nx * ny);
  const lons = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      values[k] = rows[j][i];
      lats[k] = lat0 + step * j;
      lons[k] = lon0 + step * i;
    }
  }
  return {
    grid: { nx, ny, values },
    geo: { nx, ny, lats, lons },
  };
}

const TIME = "2025-08-11T18:00:00.000Z";
const LATER = "2025-08-11T18:02:00.000Z";

describe("identify", () => {
  it("finds nothing on a quiet grid", () => {
    const { grid, geo } = scene([
      [0, 0],
      [0, 0],
    ]);
    assert.equal(identify(grid, geo, 20, TIME).length, 0);
  });

  it("treats a single echoing cell as one storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 41, 0],
      [0, 0, 0],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 1);
    assert.equal(storms[0].nCells, 1);
    assert.equal(storms[0].maxDbz, 41);
    assert.ok(Math.abs(storms[0].coreLon - -99.99) < 1e-4);
    assert.ok(Math.abs(storms[0].coreLat - 30.01) < 1e-4);
    assert.equal(storms[0].geometry.length, 0);
  });

  it("joins diagonal neighbors (8-connected)", () => {
    const { grid, geo } = scene([
      [30, 0, 0],
      [0, 30, 0],
      [0, 0, 30],
    ]);
    assert.equal(identify(grid, geo, 20, TIME).length, 1);
  });

  it("keeps two separated blobs as two storms", () => {
    const { grid, geo } = scene([
      [35, 0, 0, 40],
      [35, 0, 0, 40],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 2);
    const peaks = storms.map((s) => s.maxDbz).sort((a, b) => a - b);
    assert.deepEqual(peaks, [35, 40]);
  });

  it("does not wrap the west edge onto the east edge", () => {
    const { grid, geo } = scene([
      [45, 0, 0, 45],
      [45, 0, 0, 45],
    ]);
    assert.equal(identify(grid, geo, 20, TIME).length, 2);
  });

  it("puts the core on the strongest cell, not the centroid", () => {
    const { grid, geo } = scene([
      [20, 20, 55],
      [20, 20, 20],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    assert.equal(storm.maxDbz, 55);
    assert.ok(Math.abs(storm.coreLon - -99.98) < 1e-4);
    assert.ok(Math.abs(storm.coreLat - 30) < 1e-4);
    assert.ok(storm.centroidLon < storm.coreLon);
  });

  it("ignores no-echo sentinels the way a contour does", () => {
    const { grid, geo } = scene([
      [-99, -99, 33],
      [-999, 33, 33],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 1);
    assert.equal(storms[0].nCells, 3);
  });
});

describe("matchTracks", () => {
  it("keeps the id when the centroid has not jumped", () => {
    const first = scene([
      [0, 40, 0],
      [0, 0, 0],
    ]);
    const second = scene([
      [0, 0, 0],
      [0, 40, 0],
    ]);
    const prev = identify(first.grid, first.geo, 20, TIME);
    const next = identify(second.grid, second.geo, 20, LATER);
    const nextId = { value: 10 };
    const tracked = matchTracks(prev, next, TIME, LATER, nextId);
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0].id, prev[0].id);
    assert.equal(tracked[0].firstSeen, TIME);
    assert.equal(tracked[0].ageMin, 2);
    assert.equal(tracked[0].motionTowardDeg, 0);
    assert.ok((tracked[0].motionKmh ?? 0) > 0);
    assert.equal(tracked[0].areaDeltaKm2, 0);
  });

  it("records a growing raining area as a positive change", () => {
    const first = scene([[0, 40, 0]]);
    const second = scene([[40, 40, 40]]);
    const prev = identify(first.grid, first.geo, 20, TIME);
    const next = identify(second.grid, second.geo, 20, LATER);
    const tracked = matchTracks(prev, next, TIME, LATER, { value: 10 });
    assert.ok((tracked[0].areaDeltaKm2 ?? 0) > 0);
  });

  it("issues a new id when the jump is farther than a storm moves in two minutes", () => {
    const first = scene([[40, 0, 0, 0, 0, 0]], 30, -100, 0.1);
    const far = scene([[0, 0, 0, 0, 0, 40]], 30, -100, 0.1);
    const prev = identify(first.grid, first.geo, 20, TIME);
    const next = identify(far.grid, far.geo, 20, LATER);
    const nextId = { value: 10 };
    const tracked = matchTracks(prev, next, TIME, LATER, nextId);
    assert.equal(tracked[0].id, 10);
    assert.equal(tracked[0].ageMin, null);
    assert.equal(nextId.value, 11);
  });
});

describe("near", () => {
  const rows = Array.from({ length: 10 }, () => Array(10).fill(0));
  for (let j = 1; j <= 8; j++) {
    for (let i = 1; i <= 8; i++) rows[j][i] = 25;
  }
  rows[4][8] = 50;
  rows[4][9] = 25;
  const { grid, geo } = scene(rows);
  const storms = identify(grid, geo, 20, TIME);

  // A speck the map does not paint has no core to measure to, so a click near
  // one is answered the same way as a click near nothing.
  it("gives no storm for an echo too small to be drawn", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 22, 0],
      [0, 0, 0],
    ]);
    const specks = identify(grid, geo, 20, TIME);
    assert.equal(near(30.01, -99.99, specks, geo, TIME), null);
  });

  it("names the storm the click landed in", () => {
    const reading = near(30.04, -99.99, storms, geo, TIME);
    assert.ok(reading);
    assert.equal(reading.object.maxDbz, 50);
  });

  // The one figure the reading gives: how far the click is from the heaviest
  // rain in that storm, measured to the strongest cell itself.
  it("measures the distance to the storm's strongest cell", () => {
    const reading = near(30.04, -99.99, storms, geo, TIME);
    assert.ok(reading);
    assert.equal(
      Math.round(reading.coreKm * 100),
      Math.round(
        km(30.04, -99.99, reading.object.coreLat, reading.object.coreLon) * 100
      )
    );
  });

  it("is nought kilometers from the core when the click is on it", () => {
    const reading = near(
      storms[0].coreLat,
      storms[0].coreLon,
      storms,
      geo,
      TIME
    );
    assert.ok(reading);
    assert.equal(Math.round(reading.coreKm * 100), 0);
  });

  // The one thing the panel says about where on the storm the click landed:
  // how far it is from the ring the map draws, from either side of it.
  it("measures the distance to the drawn edge from inside the rain", () => {
    const reading = near(30.04, -99.99, storms, geo, TIME);
    assert.ok(reading);
    assert.equal(reading.inside, true);
    assert.ok(reading.edgeKm !== null);
    assert.ok(reading.edgeKm > 0);
    assert.ok(reading.edgeKm < reading.coreKm);
  });

  it("measures the same distance from outside the rain", () => {
    const reading = near(30.04, -100, storms, geo, TIME);
    assert.ok(reading);
    assert.equal(reading.inside, false);
    assert.ok(reading.edgeKm !== null);
    assert.ok(reading.edgeKm > 0);
  });

  // A click on the ring itself is on neither side of it by any margin the
  // panel prints, so the distance has to fall away to nothing there.
  it("is nought kilometers from the edge on the ring itself", () => {
    const [lon, lat] = storms[0].geometry[0][0][0];
    const reading = near(lat, lon, storms, geo, TIME);
    assert.ok(reading);
    assert.ok(reading.edgeKm !== null);
    assert.ok(reading.edgeKm < 0.001);
  });

  it("still names the storm from a quiet cell next to it", () => {
    const reading = near(30.04, -100, storms, geo, TIME);
    assert.ok(reading);
    assert.equal(reading.object.maxDbz, 50);
  });

  // A centroid is a point a long line of rain does not pass through, so
  // measuring to it hands a click on the flank of the line to a small round
  // storm sitting well away from it.
  it("picks the storm whose rain is nearest, not the nearest centroid", () => {
    const rows = Array.from({ length: 9 }, () => Array(9).fill(0));
    for (let j = 1; j <= 7; j++) rows[j][1] = 40; // a line, centroid far south
    rows[8][7] = 40; // a speck, its centroid nearer the click
    rows[8][6] = 40;
    const line = scene(rows, 30, -100, 0.05);
    const found = identify(line.grid, line.geo, 20, TIME);
    assert.equal(found.length, 2);
    const reading = near(30.35, -99.85, found, line.geo, TIME);
    assert.ok(reading);
    assert.equal(reading.object.nCells, 7);
  });

  // The panel says "none within 40 km" when this returns null, so the reading
  // has to hold to that rather than name whatever storm the window contains.
  it("gives no storm at all when the nearest rain is past the limit", () => {
    const far = scene(
      [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 40, 40, 0, 0, 0, 0, 0, 0, 0],
        [0, 40, 40, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      ],
      30,
      -100,
      0.1
    );
    const found = identify(far.grid, far.geo, 20, TIME);
    assert.equal(found.length, 1);
    const away = near(30.1, -99.1, found, far.geo, TIME);
    assert.ok(km(30.1, -99.1, 30.1, -99.9) > NEAR_LIMIT_KM);
    assert.equal(away, null);
    const close = near(30.1, -99.6, found, far.geo, TIME);
    assert.ok(km(30.1, -99.6, 30.1, -99.9) < NEAR_LIMIT_KM);
    assert.ok(close);
  });
});

describe("quietRing", () => {
  it("is the clear cells that touch the rain, not the raining cells", () => {
    const { grid, geo } = scene([
      [0, 0, 0, 0, 0],
      [0, 0, 30, 0, 0],
      [0, 30, 50, 30, 0],
      [0, 0, 30, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    const ring = quietRing(storm, grid, 20);
    assert.ok(ring.length > 0);
    for (const k of ring) {
      assert.ok(grid.values[k] < 20);
      assert.ok(!storm.cells.includes(k));
    }
  });

  it("does not treat uncovered ground as a place to fly", () => {
    const { grid, geo } = scene([
      [-999, -999, -999],
      [-999, 40, -999],
      [-999, -999, -999],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    assert.equal(quietRing(storm, grid, 20).length, 0);
  });
});

describe("upwindRing", () => {
  it("is empty when the storm has no motion", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 40, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    assert.equal(upwindRing(storm, grid, geo, 20).length, 0);
  });

  it("keeps only the quiet cells on the side the storm is moving away from", () => {
    const { grid, geo } = scene([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 40, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    storm.motionTowardDeg = 90;
    const ring = upwindRing(storm, grid, geo, 20);
    assert.ok(ring.length > 0);
    for (const k of ring) {
      assert.ok(grid.values[k] < 20);
      assert.ok(
        upwindOf(
          storm.coreLat,
          storm.coreLon,
          geo.lats[k],
          geo.lons[k],
          90
        )
      );
    }
  });
});

describe("upwindBoundary", () => {
  it("is raining cells on the upwind edge, not the quiet cells outside", () => {
    const { grid, geo } = scene([
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 40, 0, 0],
      [0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, TIME);
    storm.motionTowardDeg = 90;
    const edge = upwindBoundary(storm, grid, geo, 20);
    assert.ok(edge.length > 0);
    for (const k of edge) {
      assert.ok(grid.values[k] >= 20);
      assert.ok(storm.cells.includes(k));
    }
  });
});

describe("upwindOf", () => {
  it("reads west as upwind of a storm moving east", () => {
    assert.equal(upwindOf(30, -100, 30, -100.1, 90), true);
    assert.equal(upwindOf(30, -100, 30, -99.9, 90), false);
  });
});

describe("destPoint", () => {
  it("puts due north of a point at a higher latitude", () => {
    const [lon, lat] = destPoint(30, -100, 0, 11.132);
    assert.ok(Math.abs(lon - -100) < 1e-4);
    assert.ok(Math.abs(lat - 30.1) < 1e-3);
  });
});

describe("foldTracks", () => {
  it("keeps firstSeen from the oldest matching scan", () => {
    const t0 = "2025-08-11T18:00:00.000Z";
    const t1 = "2025-08-11T18:03:00.000Z";
    const t2 = "2025-08-11T18:06:00.000Z";
    const a = identify(
      scene([[0, 40, 0]]).grid,
      scene([[0, 40, 0]]).geo,
      20,
      t0
    );
    const b = identify(
      scene([[0, 0, 40]]).grid,
      scene([[0, 0, 40]]).geo,
      20,
      t1
    );
    const c = identify(
      scene([[0, 0, 40]]).grid,
      scene([[0, 0, 40]]).geo,
      20,
      t2
    );
    const tracked = foldTracks([
      { time: t0, storms: a },
      { time: t1, storms: b },
      { time: t2, storms: c },
    ]);
    assert.equal(tracked.length, 1);
    assert.equal(tracked[0].firstSeen, t0);
    assert.equal(tracked[0].ageMin, 6);
    assert.equal(tracked[0].ageFloor, true);
  });
});

describe("motionFrame", () => {
  it("draws a dart from the core along the heading", () => {
    const { grid, geo } = scene([[40]]);
    const [storm] = identify(grid, geo, 20, TIME);
    storm.motionTowardDeg = 90;
    storm.motionKmh = 40;
    const frame = motionFrame(TIME, [storm]);
    assert.equal(frame.features.length, 1);
    assert.equal(frame.features[0].geometry.type, "Polygon");
    const ring = frame.features[0].geometry.coordinates[0];
    assert.deepEqual(ring[0], ring[ring.length - 1]);
    const tip = ring.reduce((east, p) => (p[0] > east[0] ? p : east));
    assert.ok(tip[0] > storm.coreLon);
    assert.ok(Math.abs(tip[1] - storm.coreLat) < 0.02);
    assert.equal(frame.features[0].properties.motionKmh, 40);
  });

  it("varies length with speed and keeps width the same", () => {
    const short = motionArrow(30, -100, 90, 4);
    const long = motionArrow(30, -100, 90, 12);
    const width = (ring: [number, number][]) =>
      Math.max(...ring.map((p) => p[1])) - Math.min(...ring.map((p) => p[1]));
    const length = (ring: [number, number][]) =>
      Math.max(...ring.map((p) => p[0])) - Math.min(...ring.map((p) => p[0]));
    assert.ok(length(long) > length(short) * 2);
    assert.ok(Math.abs(width(long) - width(short)) < width(short) * 0.05);
  });

  it("draws the same tick as a line for the screen", () => {
    const { grid, geo } = scene([[40]]);
    const [storm] = identify(grid, geo, 20, TIME);
    storm.motionTowardDeg = 90;
    storm.motionKmh = 40;
    const frame = motionFrame(TIME, [storm], "line");
    assert.equal(frame.features.length, 1);
    const geometry = frame.features[0].geometry;
    assert.equal(geometry.type, "LineString");
    const line = geometry.coordinates as [number, number][];
    assert.equal(line.length, 2);
    assert.deepEqual(line[0], [storm.coreLon, storm.coreLat]);
    assert.ok(line[1][0] > storm.coreLon);
    assert.ok(Math.abs(line[1][1] - storm.coreLat) < 0.02);
  });

  it("draws nothing when the storm has no motion", () => {
    const { grid, geo } = scene([[40]]);
    const [storm] = identify(grid, geo, 20, TIME);
    assert.equal(motionFrame(TIME, [storm]).features.length, 0);
  });

  it("clamps a fast heading to 12 km", () => {
    assert.equal(motionLengthKm(200), 12);
    assert.equal(motionLengthKm(20), 3);
  });
});

describe("drawnStorms", () => {
  it("drops an isolated echo smaller than one 4 km cell", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 41, 0],
      [0, 0, 0],
    ]);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 1);
    assert.ok(storms[0].areaKm2 < MIN_DRAWN_STORM_KM2);
    assert.equal(drawnStorms(storms).length, 0);
  });

  it("keeps a raining area at least 16 km²", () => {
    const rows = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => 30)
    );
    const { grid, geo } = scene(rows);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 1);
    assert.ok(storms[0].areaKm2 >= MIN_DRAWN_STORM_KM2);
    const drawn = drawnStorms(storms);
    assert.equal(drawn.length, 1);
    assert.equal(drawn[0].nCells, 64);
  });

  it("absorbs a speck into a nearby larger echo", () => {
    // 6×6 blob on the west, one cell ~9 km east of its centroid.
    const rows = Array.from({ length: 6 }, () =>
      Array.from({ length: 14 }, () => 0)
    );
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 6; i++) rows[j][i] = 30;
    }
    rows[2][12] = 45;
    const { grid, geo } = scene(rows);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 2);
    const gap = km(
      storms[0].centroidLat,
      storms[0].centroidLon,
      storms[1].centroidLat,
      storms[1].centroidLon
    );
    assert.ok(gap <= MERGE_STORM_KM);
    const drawn = drawnStorms(storms);
    assert.equal(drawn.length, 1);
    assert.equal(drawn[0].nCells, 37);
    assert.equal(drawn[0].maxDbz, 45);
  });

  it("does not merge two storms that both clear the floor", () => {
    const rows = Array.from({ length: 6 }, () =>
      Array.from({ length: 14 }, () => 0)
    );
    for (let j = 0; j < 6; j++) {
      for (let i = 0; i < 6; i++) {
        rows[j][i] = 30;
        rows[j][i + 8] = 40;
      }
    }
    const { grid, geo } = scene(rows);
    const storms = identify(grid, geo, 20, TIME);
    assert.equal(storms.length, 2);
    assert.ok(storms.every((s) => s.areaKm2 >= MIN_DRAWN_STORM_KM2));
    const gap = km(
      storms[0].centroidLat,
      storms[0].centroidLon,
      storms[1].centroidLat,
      storms[1].centroidLon
    );
    assert.ok(gap <= MERGE_STORM_KM);
    assert.equal(drawnStorms(storms).length, 2);
  });
});

describe("km and bearing", () => {
  it("is about 1.1 km for 0.01 deg of latitude", () => {
    assert.ok(Math.abs(km(30, -100, 30.01, -100) - 1.113) < 0.01);
  });

  it("reads due east as 90", () => {
    assert.equal(Math.round(bearingDeg(30, -100, 30, -99.9)), 90);
  });
});
