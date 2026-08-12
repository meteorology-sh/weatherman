// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { radar } from "../routers/radar";

// Services
import { Mrms, RadarFrame, RadarStats } from "../lib/services/radar";

const frame: RadarFrame = {
  type: "FeatureCollection",
  validTime: "2026-08-12T04:10:00.000Z",
  features: [
    {
      type: "Feature",
      properties: { reflectivity: 20 },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-95.9, 24.0],
              [-95.8, 24.0],
              [-95.8, 24.1],
              [-95.9, 24.0],
            ],
          ],
        ],
      },
    },
  ],
};

const stats: RadarStats = {
  fetchedAt: "2026-08-12T04:15:46.334Z",
  validTime: "2026-08-12T04:10:00.000Z",
  radarCoveragePct: 67.33,
  echoPct: 2.01,
  echoKm2: 309859,
  peakDbz: 57,
};

describe("radar router", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/radar", radar);
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

  it("responds with the contours as GeoJSON", async (t) => {
    t.mock.method(Mrms, "reflectivity", async () => frame);

    const res = await fetch(`${origin}/radar/reflectivity`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), frame);
  });

  // The renderer matches on `reflectivity`, so the level has to survive the
  // route or every band renders unsymbolised.
  it("keeps the level the renderer matches on", async (t) => {
    t.mock.method(Mrms, "reflectivity", async () => frame);

    const body = await fetch(`${origin}/radar/reflectivity`).then((r) =>
      r.json()
    );

    assert.equal(body.features[0].properties.reflectivity, 20);
    assert.equal(body.features[0].geometry.type, "MultiPolygon");
  });

  // A radar scene is only worth reading with its age attached, and the frame is
  // the only place the map learns it.
  it("carries the scene's valid time", async (t) => {
    t.mock.method(Mrms, "reflectivity", async () => frame);

    const body = await fetch(`${origin}/radar/reflectivity`).then((r) =>
      r.json()
    );

    assert.equal(body.validTime, "2026-08-12T04:10:00.000Z");
  });

  it("responds with the summary as JSON", async (t) => {
    t.mock.method(Mrms, "reflectivityStats", async () => stats);

    const res = await fetch(`${origin}/radar/reflectivity/stats`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), stats);
  });

  // The stats route is more specific than the frame route; Express must not let
  // /reflectivity swallow /reflectivity/stats.
  it("keeps the stats route distinct from the frame route", async (t) => {
    t.mock.method(Mrms, "reflectivity", async () => frame);
    t.mock.method(Mrms, "reflectivityStats", async () => stats);

    const [geo, summary] = await Promise.all([
      fetch(`${origin}/radar/reflectivity`).then((r) => r.json()),
      fetch(`${origin}/radar/reflectivity/stats`).then((r) => r.json()),
    ]);

    assert.equal(geo.type, "FeatureCollection");
    assert.equal(summary.radarCoveragePct, 67.33);
  });

  it("responds 500 with the message when the mosaic is down", async (t) => {
    t.mock.method(Mrms, "reflectivity", async () => {
      throw new Error("MRMS mosaic unavailable: 503");
    });

    const res = await fetch(`${origin}/radar/reflectivity`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "MRMS mosaic unavailable: 503",
    });
  });

  it("responds 500 when the summary fails", async (t) => {
    t.mock.method(Mrms, "reflectivityStats", async () => {
      throw new Error("MRMS mosaic unavailable: 503");
    });

    const res = await fetch(`${origin}/radar/reflectivity/stats`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "MRMS mosaic unavailable: 503",
    });
  });
});
