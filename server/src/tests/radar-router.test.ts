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
import { Mrms, RadarFrame, RadarStats } from "../lib/services/mrms/radar";
import { EchoTops } from "../lib/services/mrms/echotop";

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

  it("starts the echo-top decode when the mosaic summary is asked for", async (t) => {
    t.mock.method(Mrms, "reflectivityStats", async () => stats);
    const warm = t.mock.method(EchoTops, "warm", () => undefined);

    await fetch(`${origin}/radar/reflectivity/stats`);

    assert.equal(warm.mock.callCount(), 1);
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
    t.mock.method(EchoTops, "warm", () => undefined);

    const res = await fetch(`${origin}/radar/reflectivity/stats`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), stats);
  });

  // The stats route is more specific than the frame route; Express must not let
  // /reflectivity swallow /reflectivity/stats.
  it("keeps the stats route distinct from the frame route", async (t) => {
    t.mock.method(Mrms, "reflectivity", async () => frame);
    t.mock.method(Mrms, "reflectivityStats", async () => stats);
    t.mock.method(EchoTops, "warm", () => undefined);

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

  it("responds with storm objects as GeoJSON", async (t) => {
    t.mock.method(Mrms, "objects", async () => ({
      type: "FeatureCollection",
      validTime: "2026-08-12T04:10:00.000Z",
      features: [
        {
          type: "Feature",
          properties: {
            stormId: 1,
            maxDbz: 48,
            areaKm2: 36,
            ageMin: 6,
            motionTowardDeg: 40,
            motionKmh: 25,
            coreLon: -101.4,
            coreLat: 32.1,
          },
          geometry: {
            type: "MultiPolygon",
            coordinates: [[[[-101.5, 32], [-101.4, 32], [-101.4, 32.1], [-101.5, 32]]]],
          },
        },
      ],
    }));

    const res = await fetch(`${origin}/radar/objects`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.type, "FeatureCollection");
    assert.equal(body.features[0].properties.stormId, 1);
    assert.equal(body.features[0].properties.maxDbz, 48);
  });

  it("passes a replayed hour and a box through to the objects", async (t) => {
    let seen: { at?: Date; box?: { west: number } } = {};
    t.mock.method(
      Mrms,
      "objects",
      async (at?: Date, box?: { west: number }) => {
        seen = { at, box };
        return { type: "FeatureCollection", validTime: "", features: [] };
      }
    );

    await fetch(
      `${origin}/radar/objects?at=2025-08-11T18:00:00.000Z&west=-102&east=-100&south=31&north=33`
    );

    assert.equal(seen.at?.toISOString(), "2025-08-11T18:00:00.000Z");
    assert.equal(seen.box?.west, -102);
  });

  it("asks for the native grid when evaluation sends fine=1", async (t) => {
    const stub = t.mock.method(Mrms, "cores", async () => ({
      type: "FeatureCollection",
      validTime: "",
      features: [],
    }));

    await fetch(`${origin}/radar/objects/cores?fine=1`);

    assert.equal(stub.mock.calls[0].arguments[2], true);
  });

  it("responds with the storm nearest a click", async (t) => {
    t.mock.method(Mrms, "objectNear", async () => ({
      validTime: "2026-08-12T04:10:00.000Z",
      coreKm: 2.1,
      inside: false,
      edgeKm: 2.1,
      object: { id: 3, maxDbz: 44, areaKm2: 22 },
    }));

    const res = await fetch(`${origin}/radar/objects/near?lat=32.1&lon=-101.4`);

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.edgeKm, 2.1);
    assert.equal(body.object.id, 3);
  });

  it("responds with a point at each storm's strongest cell", async (t) => {
    t.mock.method(Mrms, "cores", async () => ({
      type: "FeatureCollection",
      validTime: "2026-08-12T04:10:00.000Z",
      features: [
        {
          type: "Feature",
          properties: { stormId: 1, maxDbz: 48 },
          geometry: { type: "Point", coordinates: [-101.4, 32.1] },
        },
      ],
    }));

    const body = await fetch(`${origin}/radar/objects/cores`).then((r) =>
      r.json()
    );
    assert.equal(body.features[0].geometry.type, "Point");
    assert.equal(body.features[0].properties.maxDbz, 48);
  });

  it("responds with a heading tick from each core", async (t) => {
    t.mock.method(Mrms, "motion", async () => ({
      type: "FeatureCollection",
      validTime: "2026-08-12T04:10:00.000Z",
      features: [
        {
          type: "Feature",
          properties: { stormId: 1, motionTowardDeg: 90, motionKmh: 40 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-101.4, 32.1],
                [-101.0, 32.1],
                [-101.05, 32.12],
                [-101.4, 32.1],
              ],
            ],
          },
        },
      ],
    }));

    const body = await fetch(`${origin}/radar/objects/motion`).then((r) =>
      r.json()
    );
    assert.equal(body.features[0].geometry.type, "Polygon");
    assert.equal(body.features[0].properties.motionKmh, 40);
  });

  it("hands the heading shape the caller asked for to the service", async (t) => {
    const shapes: unknown[] = [];
    t.mock.method(
      Mrms,
      "motion",
      async (_at?: Date, _box?: unknown, _fine?: boolean, shape?: unknown) => {
        shapes.push(shape);
        return { type: "FeatureCollection", validTime: null, features: [] };
      }
    );

    await fetch(`${origin}/radar/objects/motion`).then((r) => r.json());
    await fetch(`${origin}/radar/objects/motion?shape=line`).then((r) =>
      r.json()
    );

    assert.deepEqual(shapes, ["dart", "line"]);
  });

  it("responds with the upwind raining edge of each storm", async (t) => {
    t.mock.method(Mrms, "flanks", async () => ({
      type: "FeatureCollection",
      validTime: "2026-08-12T04:10:00.000Z",
      features: [
        {
          type: "Feature",
          properties: { stormId: 1, maxDbz: 48 },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-101.4, 32.1],
                [-101.3, 32.1],
                [-101.3, 32.2],
                [-101.4, 32.1],
              ],
            ],
          },
        },
      ],
    }));

    const body = await fetch(`${origin}/radar/objects/flanks`).then((r) =>
      r.json()
    );
    assert.equal(body.features[0].geometry.type, "Polygon");
    assert.equal(body.features[0].properties.stormId, 1);
  });

  it("responds with echo top at or above freezing as GeoJSON", async (t) => {
    t.mock.method(EchoTops, "pastFreezing", async () => ({
      type: "FeatureCollection",
      run: "2026-08-12T04:00:00.000Z",
      validTime: "2026-08-12T04:10:00.000Z",
      hour: 0,
      features: [
        {
          type: "Feature",
          properties: { pastFreezing: 1 },
          geometry: {
            type: "MultiPolygon",
            coordinates: [[[[-101.4, 32.1], [-101.3, 32.1], [-101.3, 32.2], [-101.4, 32.1]]]],
          },
        },
      ],
    }));

    const body = await fetch(`${origin}/radar/echotop/past-freezing`).then(
      (r) => r.json()
    );
    assert.equal(body.features[0].properties.pastFreezing, 1);
  });

  it("responds 400 when a click has no coordinates", async () => {
    const res = await fetch(`${origin}/radar/objects/near`);
    assert.equal(res.status, 400);
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
