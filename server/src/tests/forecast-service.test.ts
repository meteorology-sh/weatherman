// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  ForecastService,
  polygons,
  FORECAST_HOURS,
} from "../lib/services/hrrr/forecast";
import { accumulate } from "../lib/services/shared/grid";

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

  it("keeps every native cell", () => {
    const values = Array.from({ length: 16 }, (_, i) => i);
    const { grid } = accumulate(dump(values, 4), 1, 4, 4);

    assert.equal(grid.nx, 4);
    assert.equal(grid.ny, 4);
    assert.deepEqual(Array.from(grid.values), values);
  });

  // PRATE arrives as kg m-2 s-1; the map, the legend and the operator all talk
  // in mm/hr.
  it("scales into the units we contour", () => {
    const values = new Array(4).fill(2);
    const { grid } = accumulate(dump(values, 2), 3600, 2, 2);

    assert.equal(grid.values[0], 7200);
  });

  it("keeps each point's lat/lon", () => {
    const values = new Array(4).fill(1);
    const { geo } = accumulate(dump(values, 2), 1, 2, 2);

    assert.equal(geo.lats[0], 0);
    assert.equal(geo.lons[0], 0);
    assert.equal(geo.lats[3], 1);
    assert.equal(geo.lons[3], 1);
  });

  it("folds longitudes past the antimeridian back into -180..180", () => {
    const text = "Latitude Longitude Value\n40 260 1\n";
    const { geo } = accumulate(text, 1, 1, 1);

    assert.equal(geo.lons[0], -100);
  });

  // We ask grib_get_data to print 9999 for absent values, so 9999 must be
  // dropped rather than drawn: it is finite, and would read as permanent
  // overcast or a cloudburst.
  it("drops the missing sentinel instead of drawing it", () => {
    const values = [10, 9999];
    const { grid } = accumulate(dump(values, 2), 1, 2, 1);

    assert.equal(grid.values[0], 10);
    assert.equal(grid.values[1], 0);
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
