// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { FINE_STYLE, features } from "../lib/services/shared/contour";
import { cellAt, nearestCell } from "../lib/services/shared/grid";

// Types
import type { Geo, Grid } from "../lib/services/shared/contour";

/**
 * How far a drawn band and the cell a point reads can come apart, and which
 * half of that a lookup can close.
 *
 * **Two halves, and only one is fixable.** The lookup half is asking the wrong
 * question — the nearest cell *centre* in latitude and longitude, where the
 * contour was traced in the grid's own rows and columns. On a grid whose rows
 * lean away from the meridian those are different cells near a boundary, and
 * `cellAt` closes it.
 *
 * The drawing half cannot be closed by any lookup. Marching squares cuts across
 * a corner rather than following the cell's edge, so at a concave boundary the
 * band bulges into ground belonging to a cell it excludes. There is no cell
 * lookup that makes a point there read as included, because it genuinely is not
 * — the band's edge is smoothed, not cell-exact.
 *
 * These drive the real contourer and the real lookup so both halves stay
 * measured rather than argued about.
 */

/** Cells across the toy grid, and degrees per cell — big, so nothing is subtle. */
const N = 13;

/** A square grid turned like a Lambert grid's rows away from its meridian. */
function turned(turnDeg: number): Geo {
  const turn = (turnDeg * Math.PI) / 180;
  const lats = new Float32Array(N * N);
  const lons = new Float32Array(N * N);
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      lons[j * N + i] = -100 + (i * Math.cos(turn) - j * Math.sin(turn));
      lats[j * N + i] = 38 + (i * Math.sin(turn) + j * Math.cos(turn));
    }
  }
  return { nx: N, ny: N, lats, lons };
}

function grid(mark: (set: (i: number, j: number) => void) => void): Grid {
  const values = new Float32Array(N * N);
  mark((i, j) => (values[j * N + i] = 5));
  return { nx: N, ny: N, values };
}

const solid = grid((set) => {
  for (let j = 2; j <= 6; j++) for (let i = 2; i <= 6; i++) set(i, j);
});

/** The same blob with its north-east quarter missing: one concave corner. */
const concave = grid((set) => {
  for (let j = 2; j <= 6; j++) {
    for (let i = 2; i <= 6; i++) if (!(i > 4 && j > 4)) set(i, j);
  }
});

function inRing(ring: number[][], x: number, y: number): boolean {
  let odd = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      odd = !odd;
    }
  }
  return odd;
}

/** Exterior minus holes — a donut's middle is not inside it. */
function inPolygon(polygon: number[][][], x: number, y: number): boolean {
  if (!inRing(polygon[0], x, y)) return false;
  for (let k = 1; k < polygon.length; k++) {
    if (inRing(polygon[k], x, y)) return false;
  }
  return true;
}

/**
 * Sweep the whole grid and count the points that fall inside the drawn band but
 * read a cell the band excluded.
 *
 * The sweep is deliberately offset off the half-degrees: a point exactly on a
 * boundary belongs to neither cell, and counting those would measure the
 * rounding rule rather than the geometry.
 */
function stray(
  geo: Geo,
  field: Grid,
  lookup: (geo: Geo, lat: number, lon: number) => number
): { inside: number; stray: number } {
  // The lookup half is about marching-squares chamfers, not the map's
  // rounded ring.
  const drawn = features(field, geo, "v", [1], FINE_STYLE);
  const polygons = (
    drawn[0].geometry as unknown as { coordinates: number[][][][] }
  ).coordinates;

  let inside = 0;
  let wrong = 0;
  for (let a = 0; a < 260; a++) {
    for (let b = 0; b < 260; b++) {
      const lat = 36.037 + (a / 260) * 18;
      const lon = -101.973 + (b / 260) * 18;
      if (!polygons.some((p) => inPolygon(p, lon, lat))) continue;
      inside++;
      if (field.values[lookup(geo, lat, lon)] < 1) wrong++;
    }
  }
  return { inside, stray: wrong };
}

describe("the cell a point inside a drawn band reads", () => {
  // The control. With rows along a parallel the nearest centre and the
  // containing footprint are the same cell, so the lookup half does not exist.
  it("is the band's own cell either way while the grid is not turned", () => {
    const geo = turned(0);

    assert.equal(stray(geo, solid, cellAt).stray, 0);
    assert.equal(stray(geo, solid, nearestCell).stray, 0);
  });

  // The bug. Turning the grid separates the two questions, and the nearest
  // centre starts answering with cells the band excluded.
  it("is a cell outside the band for the nearest centre once it is turned", () => {
    const geo = turned(20);

    assert.ok(
      stray(geo, solid, nearestCell).stray > 0,
      "expected the nearest centre to stray on a turned grid"
    );
  });

  it("is the band's own cell for the containing footprint however far it turns", () => {
    for (const turn of [5, 20, 35]) {
      const geo = turned(turn);
      const measured = stray(geo, solid, cellAt);

      assert.ok(measured.inside > 400, `only ${measured.inside} inside`);
      assert.equal(
        measured.stray,
        0,
        `turned ${turn} deg: ${measured.stray} of ${measured.inside} strayed`
      );
    }
  });
});

/**
 * The half no lookup closes, pinned so nobody sets out to "fix" it in the
 * lookup and cannot work out why it will not go.
 */
describe("a band's edge is smoothed, not cell-exact", () => {
  // Marching squares cuts the corner instead of turning it, so a concave
  // boundary leaves the band covering part of an excluded cell. A point there
  // reads that cell, and that reading is right — the band is what is drawn
  // loosely.
  it("covers ground belonging to an excluded cell at a concave corner", () => {
    const geo = turned(0);

    assert.ok(
      stray(geo, concave, cellAt).stray > 0,
      "expected the drawn band to overhang the corner it cuts"
    );
  });

  // What the fix is still worth on the shape that carries both halves at once.
  it("still leaves far less of it than the nearest centre does", () => {
    const geo = turned(20);

    assert.ok(
      stray(geo, concave, cellAt).stray < stray(geo, concave, nearestCell).stray
    );
  });
});
