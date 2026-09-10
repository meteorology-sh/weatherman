// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  bandFeatures,
  features,
  polygons,
  FINE_STYLE,
  MAP_STYLE,
  SMOOTH_STYLE,
  SIMPLIFY_CELL,
} from "../lib/services/shared/contour";
import { downsample, prepareDraw } from "../lib/services/shared/grid";
import type { Geo, Grid } from "../lib/services/shared/contour";

const NX = 20;
const NY = 20;

/** Identity geo: grid indices are the lon/lat. */
function fixture() {
  const values = new Float32Array(NX * NY);
  const lats = new Float32Array(NX * NY);
  const lons = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      lons[j * NX + i] = i;
      lats[j * NX + i] = j;
    }
  }
  return { values, lats, lons };
}

const fill = (
  values: Float32Array,
  i0: number,
  i1: number,
  j0: number,
  j1: number,
  v: number
) => {
  for (let j = j0; j <= j1; j++) {
    for (let i = i0; i <= i1; i++) values[j * NX + i] = v;
  }
};

const asGrid = (values: Float32Array): { grid: Grid; geo: Geo } => {
  const { lats, lons } = fixture();
  return {
    grid: { nx: NX, ny: NY, values },
    geo: { nx: NX, ny: NY, lats, lons },
  };
};

describe("polygons (simplify)", () => {
  it("collapses a rectangle's sides, leaving the chamfered octagon", () => {
    const { values } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    const { grid, geo } = asGrid(values);
    const out = polygons(grid, geo, 50, {
      epsilon: SIMPLIFY_CELL,
      minArea: 0,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].length, 1);
    // Marching squares cuts each corner, so a rectangle traces as an
    // octagon: four sides plus four chamfers, then the closing vertex.
    assert.equal(out[0][0].length, 9);
    assert.deepEqual(out[0][0][0], out[0][0][8]);
  });

  it("turns a staircase into a short diagonal", () => {
    const { values } = fixture();
    for (let i = 5; i <= 14; i++) values[i * NX + i] = 100;
    const { grid, geo } = asGrid(values);
    const out = polygons(grid, geo, 50, {
      epsilon: SIMPLIFY_CELL,
      minArea: 0,
    });
    assert.equal(out.length, 1);
    assert.ok(
      out[0][0].length < 20,
      `staircase still has ${out[0][0].length} vertices`
    );
  });

  it("keeps a one-cell protrusion at SIMPLIFY_CELL", () => {
    const { values } = fixture();
    fill(values, 5, 12, 5, 12, 100);
    values[8 * NX + 13] = 100;
    const { grid, geo } = asGrid(values);
    const out = polygons(grid, geo, 50, {
      epsilon: SIMPLIFY_CELL,
      minArea: 0,
    });
    const maxLon = Math.max(...out[0][0].map((p) => p[0]));
    assert.ok(maxLon >= 13, `protrusion flattened: maxLon ${maxLon}`);
  });

  it("drops that protrusion when epsilon is larger than a cell", () => {
    const { values } = fixture();
    fill(values, 5, 12, 5, 12, 100);
    values[8 * NX + 13] = 100;
    const { grid, geo } = asGrid(values);
    const out = polygons(grid, geo, 50, { epsilon: 1.5, minArea: 0 });
    const maxLon = Math.max(...out[0][0].map((p) => p[0]));
    assert.ok(maxLon < 13, `epsilon 1.5 still kept the bump: maxLon ${maxLon}`);
  });

  it("still nests a hole inside its exterior", () => {
    const { values } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    fill(values, 8, 11, 8, 11, 0);
    const { grid, geo } = asGrid(values);
    const out = polygons(grid, geo, 50, {
      epsilon: SIMPLIFY_CELL,
      minArea: 0,
    });
    assert.equal(out.length, 1);
    assert.equal(out[0].length, 2);
  });

  it("drops a one-cell island from the drawn frame", () => {
    const { values } = fixture();
    values[10 * NX + 10] = 100;
    const { grid, geo } = asGrid(values);
    const drawn = features(grid, geo, "v", [50]);
    assert.equal(drawn.length, 0);
    const kept = polygons(grid, geo, 50, {
      epsilon: SIMPLIFY_CELL,
      minArea: 0,
    });
    assert.equal(kept.length, 1);
  });
});

describe("MAP_STYLE", () => {
  it("rounds a rectangle past the chamfered octagon the fine ring keeps", () => {
    const { values } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    const { grid, geo } = asGrid(values);
    const fine = polygons(grid, geo, 50, FINE_STYLE);
    const map = polygons(grid, geo, 50, MAP_STYLE);
    assert.equal(fine.length, 1);
    assert.equal(map.length, 1);
    // Fine is the marching-squares octagon (8 corners + close). The map
    // ring is that shape after two Chaikin passes, so it has more
    // vertices and none of the octagon's 45° cuts.
    assert.equal(fine[0][0].length, 9);
    assert.ok(
      map[0][0].length > fine[0][0].length,
      `map ${map[0][0].length} verts, fine ${fine[0][0].length}`
    );
  });

  it("does not collapse a small blob to a triangle", () => {
    const { values } = fixture();
    fill(values, 8, 10, 8, 10, 100);
    const { grid, geo } = asGrid(values);
    const map = polygons(grid, geo, 50, MAP_STYLE);
    assert.equal(map.length, 1);
    const verts = map[0][0].length - 1;
    assert.ok(verts > 3, `map blob has ${verts} vertices`);
  });
});

describe("prepareDraw", () => {
  it("averages 4×4 blocks on the candidate map", () => {
    const grid: Grid = {
      nx: 8,
      ny: 8,
      values: new Float32Array(64).fill(10),
    };
    const geo: Geo = {
      nx: 8,
      ny: 8,
      lats: new Float32Array(64),
      lons: new Float32Array(64),
    };
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        geo.lats[j * 8 + i] = 30 + j * 0.01;
        geo.lons[j * 8 + i] = -100 + i * 0.01;
      }
    }
    const box = { west: -101, east: -99, south: 29, north: 31 };
    const map = prepareDraw(grid, geo, box, false);
    const fine = prepareDraw(grid, geo, box, true);
    assert.ok(map.grid.nx < fine.grid.nx);
    assert.equal(map.grid.nx, Math.floor(fine.grid.nx / 4));
  });

  it("leaves the native crop when evaluation asks for fine rings", () => {
    const grid: Grid = {
      nx: 8,
      ny: 8,
      values: new Float32Array(64).fill(10),
    };
    const geo: Geo = {
      nx: 8,
      ny: 8,
      lats: new Float32Array(64),
      lons: new Float32Array(64),
    };
    for (let j = 0; j < 8; j++) {
      for (let i = 0; i < 8; i++) {
        geo.lats[j * 8 + i] = 30 + j * 0.01;
        geo.lons[j * 8 + i] = -100 + i * 0.01;
      }
    }
    const box = { west: -101, east: -99, south: 29, north: 31 };
    const fine = prepareDraw(grid, geo, box, true);
    assert.equal(fine.grid.nx, 8);
    assert.equal(fine.grid.ny, 8);
  });
});

describe("downsample", () => {
  it("means each block and skips missing cells", () => {
    const grid: Grid = {
      nx: 4,
      ny: 4,
      values: Float32Array.from([
        1,
        1,
        10,
        10,
        1,
        1,
        10,
        10,
        0,
        0,
        NaN,
        NaN,
        0,
        0,
        NaN,
        NaN,
      ]),
    };
    const geo: Geo = {
      nx: 4,
      ny: 4,
      lats: Float32Array.from([0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3]),
      lons: Float32Array.from([0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3]),
    };
    const out = downsample(grid, geo, 2);
    assert.equal(out.grid.nx, 2);
    assert.equal(out.grid.ny, 2);
    assert.equal(out.grid.values[0], 1);
    assert.equal(out.grid.values[1], 10);
    assert.equal(out.grid.values[2], 0);
    assert.ok(Number.isNaN(out.grid.values[3]));
  });

  it("does not let a lone sampled cell paint the whole coarse block", () => {
    const values = new Float32Array(16).fill(Number.NaN);
    values[0] = 1;
    const grid: Grid = { nx: 4, ny: 4, values };
    const geo: Geo = {
      nx: 4,
      ny: 4,
      lats: new Float32Array(16),
      lons: new Float32Array(16),
    };
    const painted = downsample(grid, geo, 4);
    assert.equal(painted.grid.values[0], 1);
    const majority = downsample(grid, geo, 4, (v) => !Number.isFinite(v), true);
    assert.ok(Number.isNaN(majority.grid.values[0]));
  });
});

/** Whether a point falls inside a ring. Ray casting; the ring is closed. */
const inRing = (ring: number[][], x: number, y: number): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y) {
      const cut = ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (x < cut) inside = !inside;
    }
  }
  return inside;
};

/** Whether a band's MultiPolygon covers a point: in an exterior, in no hole. */
const covers = (
  feature: { geometry: { coordinates: number[][][][] } },
  x: number,
  y: number
): boolean =>
  feature.geometry.coordinates.some(
    ([exterior, ...holes]) =>
      inRing(exterior, x, y) && !holes.some((hole) => inRing(hole, x, y))
  );

describe("SMOOTH_STYLE", () => {
  // The whole reason the drawn ring is interpolated: a block average is the
  // only thing left of the model at 12 km, so a ring pinned to the cell edge
  // throws away the one number in the cell that says where the level is.
  it("sizes a blob by how far its cells clear the level", () => {
    const blob = (peak: number) => {
      const { values } = fixture();
      fill(values, 9, 10, 9, 10, peak);
      const { grid, geo } = asGrid(values);
      return polygons(grid, geo, 50, SMOOTH_STYLE);
    };
    const area = (rings: number[][][][]) =>
      rings.reduce((total, [ring]) => {
        let s = 0;
        for (let i = 0; i < ring.length - 1; i++) {
          s += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
        }
        return total + Math.abs(s / 2);
      }, 0);

    assert.ok(area(blob(100)) > area(blob(60)));
  });

  // A gate has no gradient, so every crossing would land on a corner and a
  // small feature would collapse. Those layers keep the midpoints, and this
  // is the guard that holds even if one of them is handed this style.
  it("keeps the cell-edge midpoints on a 0/1 mask", () => {
    const { values } = fixture();
    fill(values, 5, 14, 5, 14, 1);
    const { grid, geo } = asGrid(values);
    assert.deepEqual(
      polygons(grid, geo, 1, SMOOTH_STYLE),
      polygons(grid, geo, 1, MAP_STYLE)
    );
  });
});

describe("bandFeatures", () => {
  const EDGES = [0, 40, 80];

  /** A ramp across the grid, so all three bands exist and share boundaries. */
  const ramp = () => {
    const { values } = fixture();
    for (let j = 0; j < NY; j++) {
      for (let i = 0; i < NX; i++) values[j * NX + i] = i * 6 + j;
    }
    return asGrid(values);
  };

  // Bands used to be traced from a mask each, so neighbors thinned and
  // rounded the boundary they share separately and drifted apart on it: a
  // sliver of double fill on one side, bare basemap on the other. Sharing the
  // ring makes both impossible rather than rare.
  it("never paints one place with two bands", () => {
    const { grid, geo } = ramp();
    const bands = bandFeatures(grid, geo, "v", EDGES, SMOOTH_STYLE);
    assert.equal(bands.length, 3);

    for (let x = 0.5; x < NX - 1; x += 0.25) {
      for (let y = 0.5; y < NY - 1; y += 0.25) {
        const hits = bands.filter((band) => covers(band, x, y)).length;
        assert.ok(hits <= 1, `${hits} bands cover ${x},${y}`);
      }
    }
  });

  // The evaluation harness reads these frames and is checked against them, so
  // the ring it gets must not move. Nothing rounds or interpolates it, so
  // there is no drift for a shared trace to fix there either: it keeps tracing
  // each band's own mask, exactly as it always has.
  it("traces the unrounded band from its own mask", () => {
    const { grid, geo } = ramp();
    const mask = (lo: number, hi: number) => {
      const values = new Float32Array(grid.values.length);
      for (let k = 0; k < values.length; k++) {
        const v = grid.values[k];
        values[k] = v >= lo && v < hi ? 1 : 0;
      }
      return polygons({ ...grid, values }, geo, 1, FINE_STYLE);
    };

    assert.deepEqual(
      bandFeatures(grid, geo, "v", EDGES, FINE_STYLE).map(
        (f) => f.geometry.coordinates
      ),
      EDGES.map((lo, i) => mask(lo, EDGES[i + 1] ?? Infinity)).filter(
        (rings) => rings.length > 0
      )
    );
  });

  /**
   * A field that climbs a whole band inside one cell, ringed by nodata — the
   * shape a cloud base takes at the edge of a storm, and the one that used to
   * come out as a hole crossing the ring it was cut from.
   */
  const cliff = () => {
    const values = new Float32Array(NX * NY).fill(Number.NaN);
    for (let j = 3; j < NY - 3; j++) {
      for (let i = 3; i < NX - 3; i++) {
        const wobble = Math.sin(i * 0.9) * 1.5 + Math.cos(j * 0.7) * 1.5;
        if (i + wobble < 4 || i + wobble > NX - 5) continue;
        const low =
          Math.hypot(i - 10, j - 10) < 3.5 ||
          Math.hypot(i - 5, j - 15) < 2.5 ||
          Math.hypot(i - 15, j - 4) < 2.5;
        values[j * NX + i] = low ? 20 : 90 + wobble * 3;
      }
    }
    return asGrid(values);
  };

  /** Distance from a point to a ring, so "on it" can be told from "outside". */
  const distToRing = (ring: number[][], p: number[]) => {
    let best = Infinity;
    for (let i = 0; i < ring.length - 1; i++) {
      const [ax, ay] = ring[i];
      const [bx, by] = ring[i + 1];
      const dx = bx - ax;
      const dy = by - ay;
      const l2 = dx * dx + dy * dy;
      const t = l2
        ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2))
        : 0;
      best = Math.min(
        best,
        Math.hypot(p[0] - (ax + t * dx), p[1] - (ay + t * dy))
      );
    }
    return best;
  };

  // A hole that crosses the ring it is cut from is not a polygon, and the
  // tessellator's answer for one changes with the zoom: pieces of a band came
  // and went as the map zoomed out. Thinning and rounding were what walked the
  // inner ring across the outer one, so the ring a band is cut on keeps every
  // vertex the trace gave it.
  it("keeps every hole inside the ring it is cut from", () => {
    const { grid, geo } = cliff();
    const bands = bandFeatures(grid, geo, "v", EDGES, SMOOTH_STYLE);

    for (const band of bands) {
      for (const [exterior, ...holes] of band.geometry.coordinates) {
        for (const hole of holes) {
          // Past the grid the coordinates are rounded to. Two levels of one
          // field share a line wherever the higher one reaches the edge of the
          // data, and rounding each vertex of a shared line to the nearest
          // thousandth of a degree leaves it zigzagging across itself by half
          // a step. That much they are allowed; a crossing is kilometers.
          const escaped = hole.filter(
            (p) =>
              !inRing(exterior, p[0], p[1]) && distToRing(exterior, p) > 1.5e-3
          );

          assert.deepEqual(escaped, [], `band ${band.properties.v}`);
        }
      }
    }
  });

  // The other half of "exactly one band". Painting a cell twice doubles the
  // fill; leaving it bare is a hole in the map, and a hole lost to a coin toss
  // on a shared boundary is how one used to appear.
  it("leaves no drawn ground unpainted", () => {
    const { grid, geo } = cliff();
    const bands = bandFeatures(grid, geo, "v", EDGES, SMOOTH_STYLE);
    const drawn = (x: number, y: number) => {
      const i = Math.round(x);
      const j = Math.round(y);
      for (let dj = -1; dj <= 1; dj++) {
        for (let di = -1; di <= 1; di++) {
          if (!Number.isFinite(grid.values[(j + dj) * NX + (i + di)]))
            return false;
        }
      }
      return true;
    };

    for (let x = 4; x < NX - 4; x += 0.5) {
      for (let y = 4; y < NY - 4; y += 0.5) {
        if (!drawn(x, y)) continue;
        const hits = bands.filter((band) => covers(band, x, y)).length;

        assert.equal(hits, 1, `${hits} bands cover ${x},${y}`);
      }
    }
  });

  it("still puts a cell in exactly one band", () => {
    const { values } = fixture();
    fill(values, 0, NX - 1, 0, NY - 1, 50);
    const { grid, geo } = asGrid(values);
    assert.deepEqual(
      bandFeatures(grid, geo, "v", EDGES, SMOOTH_STYLE).map(
        (f) => f.properties.v
      ),
      [40]
    );
  });
});
