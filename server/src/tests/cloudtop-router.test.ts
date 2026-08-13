// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { cloudtop } from "../routers/cloudtop";

// Services
import { Goes, CloudTopFrame, CloudTopStats } from "../lib/services/cloudtop";

const frame: CloudTopFrame = {
  type: "FeatureCollection",
  validTime: "2026-08-13T01:41:17.900Z",
  profileRun: "2026-08-13T00:00:00.000Z",
  features: [
    {
      type: "Feature",
      properties: { topColdnessC: 5 },
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

const stats: CloudTopStats = {
  fetchedAt: "2026-08-13T01:48:42.658Z",
  validTime: "2026-08-13T01:41:17.900Z",
  profileRun: "2026-08-13T00:00:00.000Z",
  cloudPct: 53.66,
  seedableTopPct: 41.5,
  seedableKm2: 7083216,
  coldestTopC: -68.4,
};

describe("cloudtop router", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/cloudtop", cloudtop);
    await new Promise<void>((resolve, reject) => {
      server = app.listen(0, "127.0.0.1", (error) =>
        error ? reject(error) : resolve()
      );
    });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it("serves the banded scene as GeoJSON", async (t) => {
    t.mock.method(Goes, "temperature", async () => frame);

    const res = await fetch(`${origin}/cloudtop/temperature`);
    const body = (await res.json()) as CloudTopFrame;

    assert.equal(res.status, 200);
    assert.equal(body.type, "FeatureCollection");
    assert.equal(body.features[0].properties.topColdnessC, 5);
  });

  // The layer's valid time is the satellite's scan, not our fetch — an operator
  // reading a five-minute-old scene must not be shown a fresh timestamp.
  it("carries the scan time through to the frame", async (t) => {
    t.mock.method(Goes, "temperature", async () => frame);

    const res = await fetch(`${origin}/cloudtop/temperature`);
    const body = (await res.json()) as CloudTopFrame;

    assert.equal(body.validTime, "2026-08-13T01:41:17.900Z");
  });

  // Both halves of the claim have to reach the client, or the sidebar cannot
  // say which source supplied the temperature.
  it("carries the model run the temperatures came from", async (t) => {
    t.mock.method(Goes, "temperature", async () => frame);

    const res = await fetch(`${origin}/cloudtop/temperature`);
    const body = (await res.json()) as CloudTopFrame;

    assert.equal(body.profileRun, "2026-08-13T00:00:00.000Z");
  });

  it("serves the summary on its own route", async (t) => {
    t.mock.method(Goes, "temperatureStats", async () => stats);

    const res = await fetch(`${origin}/cloudtop/temperature/stats`);
    const body = (await res.json()) as CloudTopStats;

    assert.equal(res.status, 200);
    assert.equal(body.cloudPct, 53.66);
    assert.equal(body.coldestTopC, -68.4);
  });

  // A clear sky is a real answer and must come back as an empty collection
  // rather than an error — that is the whole nodata story of this layer.
  it("serves a cloud-free scene as an empty collection", async (t) => {
    t.mock.method(Goes, "temperature", async () => ({
      ...frame,
      features: [],
    }));

    const res = await fetch(`${origin}/cloudtop/temperature`);
    const body = (await res.json()) as CloudTopFrame;

    assert.equal(res.status, 200);
    assert.deepEqual(body.features, []);
  });

  it("500s with the message when the scene cannot be built", async (t) => {
    t.mock.method(Goes, "temperature", async () => {
      throw new Error("No GOES cloud-top scene published in the last 4 hours");
    });

    const res = await fetch(`${origin}/cloudtop/temperature`);
    const body = (await res.json()) as { error: string };

    assert.equal(res.status, 500);
    assert.match(body.error, /No GOES cloud-top scene/);
  });

  it("500s with the message when the summary cannot be built", async (t) => {
    t.mock.method(Goes, "temperatureStats", async () => {
      throw new Error("GOES scene fetch failed: 503");
    });

    const res = await fetch(`${origin}/cloudtop/temperature/stats`);
    const body = (await res.json()) as { error: string };

    assert.equal(res.status, 500);
    assert.match(body.error, /503/);
  });
});
