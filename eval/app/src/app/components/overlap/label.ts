/**
 * Where to write a county's name.
 *
 * **The centre of a bounding box is not inside a county of an awkward shape.**
 * Tom Green wraps around a notch and Crockett's north-western boundary follows
 * the Pecos, so both had their bbox centre land on or beside a boundary line —
 * Tom Green with 0.2 km of clearance, Crockett with 4.8 km, against 20 km or
 * more for every well-behaved county on the map. A name on the line reads as
 * belonging to whichever county the eye picks.
 *
 * So the label goes at the **pole of inaccessibility**: the interior point
 * farthest from any edge. It is the standard answer to this and it degrades
 * gracefully — for a county that is roughly a rectangle it lands within a
 * hundred metres of the centre it would have had anyway, so nothing that was
 * already right moves.
 */

export type Ring = [number, number][];

/**
 * Vertices kept per ring before searching.
 *
 * Label placement is a coarse question and the answer moves by metres when the
 * river detail is dropped, while the search is linear in vertex count — Crockett
 * alone carries 8,317 points. Thinning the whole map to 4,452 makes this a few
 * hundred milliseconds instead of several seconds.
 */
const MAX_VERTS = 400;

/**
 * Rounds of search: one coarse sweep, then narrowing on the best cell.
 *
 * The coarse pass only has to land in the right lobe of the county — the
 * refinements find the actual pole from there, and every grid from 20 to 32
 * gives the same answer to a tenth of a kilometre on the thirteen counties
 * here. 24 is the middle of that range, kept as margin for a shape from a
 * region that has not been loaded yet.
 *
 * The whole map costs about 380 ms, once, when the counties arrive. It is
 * synchronous and it does block, but it is off the render path: the maps draw
 * without counties and gain them when they land.
 */
const COARSE = 24;
const FINE = 10;
const REFINEMENTS = 3;

function thin(ring: Ring): Ring {
  if (ring.length <= MAX_VERTS) return ring;
  const step = Math.ceil(ring.length / MAX_VERTS);
  const out = ring.filter((_, index) => index % step === 0);
  const last = ring[ring.length - 1];
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

/**
 * Even-odd ray casting across every ring at once.
 *
 * The same rule the counties are drawn with (`fill-rule: evenodd`), so a point
 * in a hole counts as outside here exactly as it reads on the map.
 */
function inside(rings: Ring[], x: number, y: number): boolean {
  let odd = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        odd = !odd;
      }
    }
  }
  return odd;
}

/** Distance from a point to the nearest edge, longitude squeezed to ground. */
function clearance(rings: Ring[], x: number, y: number, squeeze: number) {
  let best = Infinity;
  const px = x * squeeze;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const ax = ring[j][0] * squeeze;
      const ay = ring[j][1];
      const bx = ring[i][0] * squeeze;
      const by = ring[i][1];
      const dx = bx - ax;
      const dy = by - ay;
      const span = dx * dx + dy * dy;
      const t =
        span === 0
          ? 0
          : Math.max(0, Math.min(1, ((px - ax) * dx + (y - ay) * dy) / span));
      const d = Math.hypot(px - (ax + t * dx), y - (ay + t * dy));
      if (d < best) best = d;
    }
  }
  return best;
}

export function labelPoint(rings: Ring[]): [number, number] {
  const thinned = rings.map(thin);
  const points = thinned.flat();
  if (!points.length) return [0, 0];

  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [x, y] of points) {
    if (x < west) west = x;
    if (x > east) east = x;
    if (y < south) south = y;
    if (y > north) north = y;
  }

  // Longitude squeezed so "farthest from an edge" is a distance on the ground
  // rather than a distance in degrees, which at this latitude differ by 15%.
  const squeeze = Math.cos((((south + north) / 2) * Math.PI) / 180);

  let box = { west, east, south, north };
  let best: [number, number] = [(west + east) / 2, (south + north) / 2];
  let bestClearance = -1;

  for (let round = 0; round <= REFINEMENTS; round++) {
    const steps = round === 0 ? COARSE : FINE;
    for (let i = 0; i <= steps; i++) {
      for (let j = 0; j <= steps; j++) {
        const x = box.west + ((box.east - box.west) * i) / steps;
        const y = box.south + ((box.north - box.south) * j) / steps;
        if (!inside(thinned, x, y)) continue;
        const d = clearance(thinned, x, y, squeeze);
        if (d > bestClearance) {
          bestClearance = d;
          best = [x, y];
        }
      }
    }
    // Narrow to one cell either side of the winner and look again.
    const cellX = (box.east - box.west) / steps;
    const cellY = (box.north - box.south) / steps;
    box = {
      west: best[0] - cellX,
      east: best[0] + cellX,
      south: best[1] - cellY,
      north: best[1] + cellY,
    };
  }

  return best;
}
