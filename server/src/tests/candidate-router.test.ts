// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { candidate } from "../routers/candidate";

// Services
import { Seedability } from "../lib/services/candidate/field";

// Types
import type {
  CandidateFrame,
  CandidatePoint,
  CandidateStats,
} from "../lib/services/candidate/field";

const frame: CandidateFrame = {
  type: "FeatureCollection",
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  phaseTime: "2025-05-15T18:01:17.900Z",
  features: [
    {
      type: "Feature",
      properties: { seedableSlwPath: 50 },
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [
            [
              [-101.5, 32.0],
              [-101.4, 32.0],
              [-101.4, 32.1],
              [-101.5, 32.0],
            ],
          ],
        ],
      },
    },
  ],
};

const stats: CandidateStats = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  coveragePct: 0.31,
  candidateKm2: 52560,
  peak: 340,
  liquidKm2: 249120,
  rejected: {
    noCloudBase: 41184,
    baseAboveBand: 8496,
    noCloudSeen: 96912,
    topTooWarm: 34848,
    raining: 15120,
  },
  blindKm2: 2880,
  medianBaseFt: 5800,
  windowPct: 61.4,
  medianBandBaseFt: 17100,
  ceilingFt: 18000,
  reachablePct: 72.9,
  peakMixedCapeJKg: 1840,
  peakVilKgM2: 3.2,
  stormMotionKt: 24,
  stormMotionTowardDeg: 65,
  phase: {
    sceneTime: "2025-05-15T18:01:17.900Z",
    confirmedKm2: 31680,
    glaciatedKm2: 15840,
    unresolvedKm2: 5040,
    missedKm2: 8640,
  },
};

const point: CandidatePoint = {
  run: "2025-05-15T18:00:00.000Z",
  validTime: "2025-05-15T18:00:00.000Z",
  sceneTime: "2025-05-15T18:01:17.900Z",
  radarTime: "2025-05-15T18:00:39.000Z",
  phaseTime: "2025-05-15T18:01:17.900Z",
  lat: 32.05,
  lon: -101.42,
  verdict: "candidate",
  slwGM2: 140,
  cloudBaseFt: 5800,
  cloudTopC: -14,
  topPhase: "supercooled",
  dbz: null,
  radarCovered: true,
};

describe("candidate router", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/candidate", candidate);
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

  it("responds with the joined field as GeoJSON", async (t) => {
    t.mock.method(Seedability, "field", async () => frame);

    const res = await fetch(`${origin}/candidate/field`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), frame);
  });

  // The renderer matches on `seedableSlwPath`, so the level has to survive the
  // route or every band renders unsymbolised.
  it("keeps the level the renderer matches on", async (t) => {
    t.mock.method(Seedability, "field", async () => frame);

    const body = await fetch(`${origin}/candidate/field`).then((r) => r.json());

    assert.equal(body.features[0].properties.seedableSlwPath, 50);
    assert.equal(body.features[0].geometry.type, "MultiPolygon");
  });

  // The join is only as current as its slowest input, and the frame is the only
  // place the map learns when each source was.
  it("carries all three source times", async (t) => {
    t.mock.method(Seedability, "field", async () => frame);

    const body = await fetch(`${origin}/candidate/field`).then((r) => r.json());

    assert.equal(body.run, "2025-05-15T18:00:00.000Z");
    assert.equal(body.sceneTime, "2025-05-15T18:01:17.900Z");
    assert.equal(body.radarTime, "2025-05-15T18:00:39.000Z");
  });

  it("passes a replayed hour through to the service", async (t) => {
    let seen: Date | undefined;
    t.mock.method(Seedability, "field", async (at?: Date) => {
      seen = at;
      return frame;
    });

    await fetch(`${origin}/candidate/field?at=2025-05-15T18:00:00Z`);

    assert.equal(seen?.toISOString(), "2025-05-15T18:00:00.000Z");
  });

  // Absent `at` must reach the service as undefined, not as a date — the live
  // map is never routed through the historical path to get today's weather.
  it("reads an absent hour as live", async (t) => {
    let seen: Date | undefined | symbol = Symbol("unset");
    t.mock.method(Seedability, "field", async (at?: Date) => {
      seen = at;
      return frame;
    });

    await fetch(`${origin}/candidate/field`);

    assert.equal(seen, undefined);
  });

  it("responds with the summary as JSON", async (t) => {
    t.mock.method(Seedability, "fieldStats", async () => stats);

    const res = await fetch(`${origin}/candidate/field/stats`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), stats);
  });

  // The stats route is more specific than the field route; Express must not let
  // /field swallow /field/stats.
  it("keeps the stats route distinct from the field route", async (t) => {
    t.mock.method(Seedability, "field", async () => frame);
    t.mock.method(Seedability, "fieldStats", async () => stats);

    const [geo, summary] = await Promise.all([
      fetch(`${origin}/candidate/field`).then((r) => r.json()),
      fetch(`${origin}/candidate/field/stats`).then((r) => r.json()),
    ]);

    assert.equal(geo.type, "FeatureCollection");
    assert.equal(summary.coveragePct, 0.31);
  });

  it("responds with the clicked cell as JSON", async (t) => {
    t.mock.method(Seedability, "point", async () => point);

    const res = await fetch(`${origin}/candidate/point?lat=32&lon=-101.4`);

    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), point);
  });

  it("passes the clicked point through as numbers", async (t) => {
    let seen: [number, number] | null = null;
    t.mock.method(Seedability, "point", async (lat: number, lon: number) => {
      seen = [lat, lon];
      return point;
    });

    await fetch(`${origin}/candidate/point?lat=32.05&lon=-101.42`);

    assert.deepEqual(seen, [32.05, -101.42]);
  });

  // A point outside CONUS has no cell, and snapping it to the domain's edge
  // would report west Texas' cloud for a click on Hawaii.
  it("responds 500 when the point is outside the domain", async (t) => {
    t.mock.method(Seedability, "point", async () => {
      throw new Error("No HRRR data at 21, -158 — the domain is CONUS");
    });

    const res = await fetch(`${origin}/candidate/point?lat=21&lon=-158`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "No HRRR data at 21, -158 — the domain is CONUS",
    });
  });

  it("responds 500 with the message when a source is down", async (t) => {
    t.mock.method(Seedability, "field", async () => {
      throw new Error("MRMS mosaic unavailable: 503");
    });

    const res = await fetch(`${origin}/candidate/field`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "MRMS mosaic unavailable: 503",
    });
  });

  it("responds 500 when the summary fails", async (t) => {
    t.mock.method(Seedability, "fieldStats", async () => {
      throw new Error("No archived GOES scene near 2025-05-15T18:00:00.000Z");
    });

    const res = await fetch(`${origin}/candidate/field/stats`);

    assert.equal(res.status, 500);
    assert.equal(
      (await res.json()).error /* naming the source */,
      "No archived GOES scene near 2025-05-15T18:00:00.000Z"
    );
  });
});
