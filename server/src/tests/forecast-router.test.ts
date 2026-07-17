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
import { Hrrr, ContourFrame, ForecastMeta } from "../lib/services/forecast";

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
});
