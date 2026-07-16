// Node
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";

// Express
import express from "express";

// Routers
import { weather } from "../routers/weather";

// Services
import { Forecast, CloudCoverPoint } from "../lib/services/weather";

describe("GET /weather/cloud-cover", () => {
  let server: Server;
  let origin: string;

  before(async () => {
    const app = express();
    app.use("/weather", weather);
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

  it("responds with the service's points as JSON", async (t) => {
    const points: CloudCoverPoint[] = [
      { lat: 40, lon: -100, cloudCover: 75, time: "2026-07-16T06:15" },
    ];
    t.mock.method(Forecast, "cloudCover", async () => points);

    const res = await fetch(`${origin}/weather/cloud-cover`);

    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /application\/json/);
    assert.deepEqual(await res.json(), points);
  });

  it("responds 500 with the error message when the service fails", async (t) => {
    t.mock.method(Forecast, "cloudCover", async () => {
      throw new Error("Open-Meteo request failed: 502");
    });

    const res = await fetch(`${origin}/weather/cloud-cover`);

    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), {
      error: "Open-Meteo request failed: 502",
    });
  });
});
