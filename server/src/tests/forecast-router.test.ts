// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { forecast } from "../routers/forecast";

// Services
import {
  Hrrr,
  ContourFrame,
  ForecastMeta,
  SlwStats,
  Sounding,
} from "../lib/services/forecast";

const meta: ForecastMeta = {
  run: "2026-07-17T00:00:00.000Z",
  hours: [0, 1, 2],
};

const ring: [number, number][] = [
  [-100, 40],
  [-99, 40],
  [-99, 41],
  [-100, 40],
];

const frameOf = (property: string, level: number): ContourFrame => ({
  type: "FeatureCollection",
  run: "2026-07-17T00:00:00.000Z",
  hour: 6,
  validTime: "2026-07-17T06:00:00.000Z",
  features: [
    {
      type: "Feature",
      properties: { [property]: level },
      geometry: { type: "MultiPolygon", coordinates: [[ring]] },
    },
  ],
});

const frame = frameOf("cloudCover", 30);
const rain = frameOf("precipRate", 2.5);
const water = frameOf("slwPath", 50);

const stats: SlwStats = {
  run: "2026-07-17T00:00:00.000Z",
  hour: 0,
  validTime: "2026-07-17T00:00:00.000Z",
  coveragePct: 1.99,
  seedableKm2: 338832,
  peak: 964,
  bandTopMb: 425,
  bandBaseMb: 700,
};

describe("forecast router", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/forecast", forecast);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve()
      );
    });
    const { port } = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("responds with the run metadata as JSON", async (t) => {
    t.mock.method(Hrrr, "meta", async () => meta);

    const res = await fetch(`${origin}/forecast/meta`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), meta);
  });

  it("responds 500 when the metadata lookup fails", async (t) => {
    t.mock.method(Hrrr, "meta", async () => {
      throw new Error("No published HRRR run found in the last 6 cycles");
    });

    const res = await fetch(`${origin}/forecast/meta`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "No published HRRR run found in the last 6 cycles",
    });
  });

  it("responds with the requested frame as GeoJSON", async (t) => {
    t.mock.method(Hrrr, "clouds", async () => frame);

    const res = await fetch(`${origin}/forecast/clouds?hour=6`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), frame);
  });

  it("passes the requested hour through to the service", async (t) => {
    const seen: number[] = [];
    t.mock.method(Hrrr, "clouds", async (hour: number) => {
      seen.push(hour);
      return frame;
    });

    await fetch(`${origin}/forecast/clouds?hour=12`);

    assert.deepEqual(seen, [12]);
  });

  it("defaults to the analysis hour when none is given", async (t) => {
    const seen: number[] = [];
    t.mock.method(Hrrr, "clouds", async (hour: number) => {
      seen.push(hour);
      return frame;
    });

    await fetch(`${origin}/forecast/clouds`);

    assert.deepEqual(seen, [0]);
  });

  it("responds 500 with the message when the hour is out of range", async () => {
    const res = await fetch(`${origin}/forecast/clouds?hour=99`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "Forecast hour must be an integer 0-18",
    });
  });

  it("responds with the requested precipitation frame as GeoJSON", async (t) => {
    t.mock.method(Hrrr, "precip", async () => rain);

    const res = await fetch(`${origin}/forecast/precip?hour=6`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), rain);
  });

  it("passes the requested hour through to the precipitation service", async (t) => {
    const seen: number[] = [];
    t.mock.method(Hrrr, "precip", async (hour: number) => {
      seen.push(hour);
      return rain;
    });

    await fetch(`${origin}/forecast/precip?hour=12`);

    assert.deepEqual(seen, [12]);
  });

  it("serves precipitation from a different field than clouds", async (t) => {
    t.mock.method(Hrrr, "clouds", async () => frame);
    t.mock.method(Hrrr, "precip", async () => rain);

    const [clouds, precip] = await Promise.all([
      fetch(`${origin}/forecast/clouds?hour=6`).then((r) => r.json()),
      fetch(`${origin}/forecast/precip?hour=6`).then((r) => r.json()),
    ]);

    assert.ok("cloudCover" in clouds.features[0].properties);
    assert.ok("precipRate" in precip.features[0].properties);
  });

  it("responds 500 with the message when the precipitation hour is out of range", async () => {
    const res = await fetch(`${origin}/forecast/precip?hour=99`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "Forecast hour must be an integer 0-18",
    });
  });

  it("responds with the liquid water frame as GeoJSON", async (t) => {
    t.mock.method(Hrrr, "liquid", async () => water);

    const res = await fetch(`${origin}/forecast/liquid?hour=0`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), water);
  });

  it("responds with the liquid water stats as JSON", async (t) => {
    t.mock.method(Hrrr, "liquidStats", async () => stats);

    const res = await fetch(`${origin}/forecast/liquid/stats?hour=0`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), stats);
  });

  // The stats route is more specific than the frame route; Express must not let
  // /liquid swallow /liquid/stats.
  it("keeps the stats route distinct from the frame route", async (t) => {
    t.mock.method(Hrrr, "liquid", async () => water);
    t.mock.method(Hrrr, "liquidStats", async () => stats);

    const [geo, summary] = await Promise.all([
      fetch(`${origin}/forecast/liquid?hour=0`).then((r) => r.json()),
      fetch(`${origin}/forecast/liquid/stats?hour=0`).then((r) => r.json()),
    ]);

    assert.equal(geo.type, "FeatureCollection");
    assert.equal(summary.peak, 964);
  });

  it("passes the requested hour through to the liquid service", async (t) => {
    const seen: number[] = [];
    t.mock.method(Hrrr, "liquid", async (hour: number) => {
      seen.push(hour);
      return water;
    });

    await fetch(`${origin}/forecast/liquid?hour=3`);

    assert.deepEqual(seen, [3]);
  });

  it("defaults the stats to the analysis hour, which is what the map shows", async (t) => {
    const seen: number[] = [];
    t.mock.method(Hrrr, "liquidStats", async (hour: number) => {
      seen.push(hour);
      return stats;
    });

    await fetch(`${origin}/forecast/liquid/stats`);

    assert.deepEqual(seen, [0]);
  });

  it("responds 500 with the message when the liquid build fails", async (t) => {
    t.mock.method(Hrrr, "liquid", async () => {
      throw new Error("spawn grib_filter ENOENT");
    });

    const res = await fetch(`${origin}/forecast/liquid?hour=0`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { error: "spawn grib_filter ENOENT" });
  });

  it("responds 500 with the message when the stats build fails", async (t) => {
    t.mock.method(Hrrr, "liquidStats", async () => {
      throw new Error("HRRR index unavailable: 404");
    });

    const res = await fetch(`${origin}/forecast/liquid/stats?hour=0`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "HRRR index unavailable: 404",
    });
  });
});

const sounding: Sounding = {
  run: "2026-08-12T04:00:00.000Z",
  hour: 0,
  validTime: "2026-08-12T04:00:00.000Z",
  lat: 39.8,
  lon: -98.54,
  surfaceFt: 1830,
  freezingFt: 16433,
  bandBaseFt: 18685,
  bandTopFt: 22066,
  baseC: 35.6,
  topC: -32.4,
  levels: [
    { mb: 600, tempC: 4.37, heightFt: 14665 },
    { mb: 550, tempC: -1.32, heightFt: 16966 },
  ],
};

describe("forecast router sounding", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/forecast", forecast);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve()
      );
    });
    const { port } = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it("responds with the profile as JSON", async (t) => {
    t.mock.method(Hrrr, "sounding", async () => sounding);

    const res = await fetch(
      `${origin}/forecast/sounding?lat=39.83&lon=-98.58&hour=0`
    );

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), sounding);
  });

  it("passes the point through to the service", async (t) => {
    const seen: number[][] = [];
    t.mock.method(
      Hrrr,
      "sounding",
      async (lat: number, lon: number, hour: number) => {
        seen.push([lat, lon, hour]);
        return sounding;
      }
    );

    await fetch(`${origin}/forecast/sounding?lat=39.83&lon=-98.58&hour=2`);

    assert.deepEqual(seen, [[39.83, -98.58, 2]]);
  });

  it("defaults to the analysis hour", async (t) => {
    const seen: number[] = [];
    t.mock.method(
      Hrrr,
      "sounding",
      async (_lat: number, _lon: number, hour: number) => {
        seen.push(hour);
        return sounding;
      }
    );

    await fetch(`${origin}/forecast/sounding?lat=39.83&lon=-98.58`);

    assert.deepEqual(seen, [0]);
  });

  // Outside CONUS there is no HRRR column, and the service says so rather than
  // handing back the nearest edge cell.
  it("responds 500 with the message for a point off the domain", async (t) => {
    t.mock.method(Hrrr, "sounding", async () => {
      throw new Error("No HRRR data at 21, -158 — the domain is CONUS");
    });

    const res = await fetch(`${origin}/forecast/sounding?lat=21&lon=-158`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "No HRRR data at 21, -158 — the domain is CONUS",
    });
  });
});
