// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  ForecastService,
  polygons,
  FORECAST_HOURS,
} from "../lib/services/hrrr/forecast";
import { accumulate, blockAverage } from "../lib/services/shared/grid";

const NX = 20;
const NY = 20;

/** Identity geo: grid indices are the lon/lat, so shapes are easy to reason about. */
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

const bbox = (ring: [number, number][]) => ({
  minLon: Math.min(...ring.map((p) => p[0])),
  maxLon: Math.max(...ring.map((p) => p[0])),
  minLat: Math.min(...ring.map((p) => p[1])),
  maxLat: Math.max(...ring.map((p) => p[1])),
});

describe("polygons (marching squares)", () => {
  it("traces one polygon with one ring for a solid blob", () => {
    const { values, lats, lons } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    assert.equal(out.length, 1);
    assert.equal(out[0].length, 1);
  });

  it("closes every ring it emits", () => {
    const { values, lats, lons } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    for (const poly of out) {
      for (const ring of poly) {
        assert.deepEqual(ring[0], ring[ring.length - 1]);
      }
    }
  });

  it("wraps the blob's true extent", () => {
    const { values, lats, lons } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    const b = bbox(out[0][0]);
    // Contour sits on cell boundaries, so it hugs the blob within half a cell.
    assert.ok(b.minLon >= 4 && b.minLon <= 5.5, `minLon ${b.minLon}`);
    assert.ok(b.maxLon >= 14 && b.maxLon <= 15.5, `maxLon ${b.maxLon}`);
    assert.ok(b.minLat >= 4 && b.minLat <= 5.5, `minLat ${b.minLat}`);
    assert.ok(b.maxLat >= 14 && b.maxLat <= 15.5, `maxLat ${b.maxLat}`);
  });

  it("nests a hole inside its exterior rather than emitting two polygons", () => {
    const { values, lats, lons } = fixture();
    fill(values, 5, 14, 5, 14, 100);
    fill(values, 8, 11, 8, 11, 0); // punch a clear hole
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    assert.equal(out.length, 1, "one polygon");
    assert.equal(out[0].length, 2, "exterior + hole");

    // The hole must be the smaller ring, and inside the exterior.
    const ext = bbox(out[0][0]);
    const hole = bbox(out[0][1]);
    assert.ok(
      hole.minLon > ext.minLon && hole.maxLon < ext.maxLon,
      "hole within exterior lon"
    );
    assert.ok(
      hole.minLat > ext.minLat && hole.maxLat < ext.maxLat,
      "hole within exterior lat"
    );
  });

  it("separates disjoint blobs into separate polygons", () => {
    const { values, lats, lons } = fixture();
    fill(values, 2, 5, 2, 5, 100);
    fill(values, 12, 15, 12, 15, 100);
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    assert.equal(out.length, 2);
  });

  it("emits nothing when no cell reaches the level", () => {
    const { values, lats, lons } = fixture();
    fill(values, 5, 14, 5, 14, 40);
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    assert.equal(out.length, 0);
  });

  it("closes regions that run off the domain edge", () => {
    const { values, lats, lons } = fixture();
    fill(values, 0, 6, 0, 6, 100); // flush against the corner
    const out = polygons(
      { nx: NX, ny: NY, values },
      { nx: NX, ny: NY, lats, lons },
      50
    );
    assert.equal(out.length, 1);
    assert.deepEqual(out[0][0][0], out[0][0][out[0][0].length - 1]);
  });
});

describe("ForecastService.clouds", () => {
  it("rejects a non-integer hour", async () => {
    const svc = new ForecastService();
    await assert.rejects(() => svc.clouds(1.5), /integer/);
  });

  it("rejects an hour beyond the model's range", async () => {
    const svc = new ForecastService();
    await assert.rejects(() => svc.clouds(FORECAST_HOURS + 1), /0-18/);
  });

  it("rejects a negative hour", async () => {
    const svc = new ForecastService();
    await assert.rejects(() => svc.clouds(-1), /0-18/);
  });
});

describe("ForecastService.precip", () => {
  it("rejects a non-integer hour", async () => {
    const svc = new ForecastService();
    await assert.rejects(() => svc.precip(1.5), /integer/);
  });

  it("rejects an hour beyond the model's range", async () => {
    const svc = new ForecastService();
    await assert.rejects(() => svc.precip(FORECAST_HOURS + 1), /0-18/);
  });

  // HRRR only diagnoses PRATE by integrating a timestep forward: the analysis
  // record is a 188-byte constant that decodes to zero at all 1.9M points. So
  // f00 is answered from that fact rather than downloaded.
  it("answers the analysis hour with an empty frame", async (t) => {
    const svc = new ForecastService();
    t.mock.method(globalThis, "fetch", async () => ({ ok: true }) as Response);

    const frame = await svc.precip(0);

    assert.deepEqual(frame.features, []);
  });

  it("does not download the analysis frame it knows is empty", async (t) => {
    const svc = new ForecastService();
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string | URL) => {
      urls.push(String(url));
      return { ok: true } as Response;
    });

    await svc.precip(0);

    // Only latestRun's HEAD probe of the f00 index — no .idx read, no GRIB.
    assert.equal(urls.length, 1);
    assert.ok(urls[0].endsWith(".idx"), urls[0]);
  });

  it("still dates the empty analysis frame correctly", async (t) => {
    const svc = new ForecastService();
    t.mock.method(globalThis, "fetch", async () => ({ ok: true }) as Response);

    const frame = await svc.precip(0);

    assert.equal(frame.hour, 0);
    assert.equal(frame.validTime, frame.run);
    assert.equal(frame.type, "FeatureCollection");
  });
});

describe("accumulate", () => {
  /** grib_get_data's output: a header line, then "lat lon value" row-major. */
  const dump = (values: number[], nx: number) =>
    "Latitude Longitude Value\n" +
    values
      .map((v, i) => {
        const row = Math.floor(i / nx);
        const col = i % nx;
        return `${row} ${col} ${v}`;
      })
      .join("\n");

  it("block-averages the 4x4 cells into one", () => {
    const values = Array.from({ length: 16 }, (_, i) => i); // mean 7.5
    const { grid } = accumulate(dump(values, 4), 1, 4, 4);

    assert.equal(grid.nx, 1);
    assert.equal(grid.ny, 1);
    assert.equal(grid.values[0], 7.5);
  });

  // PRATE arrives as kg m-2 s-1; the map, the legend and the operator all talk
  // in mm/hr.
  it("scales the block mean into the units we contour", () => {
    const values = new Array(16).fill(2);
    const { grid } = accumulate(dump(values, 4), 3600, 4, 4);

    assert.equal(grid.values[0], 7200);
  });

  it("keeps the block's lat/lon centroid", () => {
    const values = new Array(16).fill(1);
    const { geo } = accumulate(dump(values, 4), 1, 4, 4);

    assert.equal(geo.lats[0], 1.5);
    assert.equal(geo.lons[0], 1.5);
  });

  it("folds longitudes past the antimeridian back into -180..180", () => {
    const text =
      "Latitude Longitude Value\n" +
      new Array(16)
        .fill(0)
        .map(() => `40 260 1`)
        .join("\n");
    const { geo } = accumulate(text, 1, 4, 4);

    assert.equal(geo.lons[0], -100);
  });

  // We ask grib_get_data to print 9999 for absent values, so 9999 must be
  // dropped rather than averaged in: it is finite, and would read as permanent
  // overcast or a cloudburst.
  it("drops the missing sentinel instead of averaging it in", () => {
    const values = [...new Array(15).fill(10), 9999];
    const { grid } = accumulate(dump(values, 4), 1, 4, 4);

    assert.equal(grid.values[0], 10);
  });

  // The location is good even where the value is not, so a missing row must
  // still count toward the centroid or the block drifts.
  it("keeps a missing point's location in the centroid", () => {
    const values = [...new Array(15).fill(10), 9999];
    const { geo } = accumulate(dump(values, 4), 1, 4, 4);

    assert.equal(geo.lats[0], 1.5);
    assert.equal(geo.lons[0], 1.5);
  });

  it("contours a fully missing block as nothing rather than as 9999", () => {
    const values = new Array(16).fill(9999);
    const { grid } = accumulate(dump(values, 4), 1, 4, 4);

    assert.equal(grid.values[0], 0);
  });

  it("drops the partial block a non-multiple grid leaves over", () => {
    // 6x6 at BLOCK 4 -> one 4x4 block; the ragged edge is not half-counted.
    const values = new Array(36).fill(5);
    const { grid } = accumulate(dump(values, 6), 1, 6, 6);

    assert.equal(grid.nx, 1);
    assert.equal(grid.ny, 1);
    assert.equal(grid.values[0], 5);
  });
});

describe("ForecastService.latestRun", () => {
  it("walks back to the most recent published cycle", async (t) => {
    const svc = new ForecastService();
    const seen: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string | URL) => {
      seen.push(String(url));
      // Fail the first cycle it tries, succeed on the second.
      return { ok: seen.length > 1 } as Response;
    });
    const run = await svc.latestRun();
    assert.equal(seen.length, 2);
    assert.ok(run instanceof Date);
  });

  it("throws when no cycle is published", async (t) => {
    const svc = new ForecastService();
    t.mock.method(globalThis, "fetch", async () => ({ ok: false }) as Response);
    await assert.rejects(() => svc.latestRun(), /No published HRRR run/);
  });

  it("caches the run rather than re-probing NOMADS per request", async (t) => {
    const svc = new ForecastService();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return { ok: true } as Response;
    });
    await svc.latestRun();
    await svc.latestRun();
    assert.equal(calls, 1);
  });
});

describe("ForecastService.meta", () => {
  it("reports every forecast hour the model publishes", async (t) => {
    const svc = new ForecastService();
    t.mock.method(globalThis, "fetch", async () => ({ ok: true }) as Response);
    const meta = await svc.meta();
    assert.equal(meta.hours.length, FORECAST_HOURS + 1);
    assert.equal(meta.hours[0], 0);
    assert.equal(meta.hours[meta.hours.length - 1], FORECAST_HOURS);
    assert.ok(meta.run.endsWith("Z") || meta.run.includes("T"));
  });
});

describe("blockAverage", () => {
  // A 4x4 grid is exactly one 12 km block, so the whole grid collapses to its
  // own mean — the simplest statement of what this does.
  it("collapses one block to its mean", () => {
    const values = new Float32Array([
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16,
    ]);

    const grid = blockAverage(values, 1, 4, 4);

    assert.deepEqual({ nx: grid.nx, ny: grid.ny }, { nx: 1, ny: 1 });
    assert.equal(grid.values[0], 8.5);
  });

  it("applies the scale to the mean", () => {
    const values = new Float32Array(16).fill(2);

    const grid = blockAverage(values, 1000, 4, 4);

    assert.equal(grid.values[0], 2000);
  });

  it("averages each block independently", () => {
    // Two blocks side by side: the left all 4s, the right all 8s.
    const values = new Float32Array(8 * 4);
    for (let j = 0; j < 4; j++) {
      for (let i = 0; i < 8; i++) values[j * 8 + i] = i < 4 ? 4 : 8;
    }

    const grid = blockAverage(values, 1, 8, 4);

    assert.equal(grid.nx, 2);
    assert.deepEqual(Array.from(grid.values), [4, 8]);
  });

  // Mean, not max: a lone hot cell is diluted by its block rather than smeared
  // across it. Block-averaging removes structure; it must never invent it.
  it("dilutes a lone cell rather than promoting it", () => {
    const values = new Float32Array(16);
    values[0] = 16;

    const grid = blockAverage(values, 1, 4, 4);

    assert.equal(grid.values[0], 1);
  });

  it("drops the remainder rows a whole block cannot cover", () => {
    const grid = blockAverage(new Float32Array(9 * 9), 1, 9, 9);

    assert.deepEqual({ nx: grid.nx, ny: grid.ny }, { nx: 2, ny: 2 });
  });
});
