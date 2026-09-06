// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  features,
  polygons,
  FINE_STYLE,
  MAP_STYLE,
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
    assert.ok(
      maxLon >= 13,
      `protrusion flattened: maxLon ${maxLon}`
    );
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
        1, 1, 10, 10, 1, 1, 10, 10, 0, 0, NaN, NaN, 0, 0, NaN, NaN,
      ]),
    };
    const geo: Geo = {
      nx: 4,
      ny: 4,
      lats: Float32Array.from([
        0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3,
      ]),
      lons: Float32Array.from([
        0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 3,
      ]),
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
    const majority = downsample(
      grid,
      geo,
      4,
      (v) => !Number.isFinite(v),
      true
    );
    assert.ok(Number.isNaN(majority.grid.values[0]));
  });
});
