// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { pireps } from "../routers/pirep";

// Services
import { Pireps, IcingFrame, IcingStats } from "../lib/services/pirep";

const frame: IcingFrame = {
  type: "FeatureCollection",
  fetchedAt: "2026-08-12T03:30:00.000Z",
  windowHours: 12,
  features: [
    {
      type: "Feature",
      properties: {
        severity: 3,
        intensity: "MOD",
        iceType: "RIME",
        flightLevelFt: 22000,
        tempC: -9,
        inBand: 1,
        obsTime: "2026-08-12T03:20:00.000Z",
        obsLabel: "12 Aug 03:20Z",
        aircraft: "Pilatus PC-12",
        detail: "22000 ft · -9 °C · RIME · Pilatus PC-12",
        raw: "DEN UA /OV DEN320055/TM 0320/FL220/TP PC12/TA M09/IC MOD RIME",
      },
      geometry: { type: "Point", coordinates: [-105.3, 40.59] },
    },
  ],
};

const stats: IcingStats = {
  fetchedAt: "2026-08-12T03:30:00.000Z",
  windowHours: 12,
  reports: 400,
  icing: 38,
  positive: 20,
  inBand: 3,
  latest: "2026-08-12T03:20:00.000Z",
};

describe("pirep router", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/pireps", pireps);
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

  it("responds with the reports as GeoJSON", async (t) => {
    t.mock.method(Pireps, "icing", async () => frame);

    const res = await fetch(`${origin}/pireps/icing`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), frame);
  });

  // The renderer matches on `severity` and the band filter queries `inBand`, so
  // both have to survive the route.
  it("keeps the fields the map draws from", async (t) => {
    t.mock.method(Pireps, "icing", async () => frame);

    const body = await fetch(`${origin}/pireps/icing`).then((r) => r.json());

    assert.equal(body.features[0].properties.severity, 3);
    assert.equal(body.features[0].properties.inBand, 1);
  });

  it("responds with the summary as JSON", async (t) => {
    t.mock.method(Pireps, "icingStats", async () => stats);

    const res = await fetch(`${origin}/pireps/icing/stats`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), stats);
  });

  // The stats route is more specific than the frame route; Express must not let
  // /icing swallow /icing/stats.
  it("keeps the stats route distinct from the frame route", async (t) => {
    t.mock.method(Pireps, "icing", async () => frame);
    t.mock.method(Pireps, "icingStats", async () => stats);

    const [geo, summary] = await Promise.all([
      fetch(`${origin}/pireps/icing`).then((r) => r.json()),
      fetch(`${origin}/pireps/icing/stats`).then((r) => r.json()),
    ]);

    assert.equal(geo.type, "FeatureCollection");
    assert.equal(summary.positive, 20);
  });

  it("responds 500 with the message when the feed is down", async (t) => {
    t.mock.method(Pireps, "icing", async () => {
      throw new Error("Icing PIREPs unavailable: 503");
    });

    const res = await fetch(`${origin}/pireps/icing`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "Icing PIREPs unavailable: 503",
    });
  });

  it("responds 500 when the summary fails", async (t) => {
    t.mock.method(Pireps, "icingStats", async () => {
      throw new Error("Icing PIREPs unavailable: 503");
    });

    const res = await fetch(`${origin}/pireps/icing/stats`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "Icing PIREPs unavailable: 503",
    });
  });
});
