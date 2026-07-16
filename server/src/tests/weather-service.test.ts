// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { WeatherService, CloudCoverPoint } from "../lib/services/weather";

const CACHE_TTL_MS = 10 * 60 * 1000;

function entry(lat: number, lon: number, cloudCover: number) {
  return {
    latitude: lat,
    longitude: lon,
    current: { time: "2026-07-16T06:15", interval: 900, cloud_cover: cloudCover },
  };
}

describe("WeatherService.cloudCover", () => {
  it("samples the CONUS grid in a single Open-Meteo request", async (t) => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      Response.json([])
    );

    await new WeatherService().cloudCover();

    assert.equal(fetchMock.mock.callCount(), 1);
    const url = new URL(String(fetchMock.mock.calls[0].arguments[0]));
    assert.equal(url.origin + url.pathname, "https://api.open-meteo.com/v1/forecast");
    assert.equal(url.searchParams.get("current"), "cloud_cover");

    const lats = url.searchParams.get("latitude")!.split(",").map(Number);
    const lons = url.searchParams.get("longitude")!.split(",").map(Number);
    assert.equal(lats.length, 180);
    assert.equal(lons.length, 180);
    assert.ok(lats.every((lat) => lat >= 25 && lat <= 49));
    assert.ok(lons.every((lon) => lon >= -124 && lon <= -67));
  });

  it("maps entries to points and skips entries without current data", async (t) => {
    t.mock.method(globalThis, "fetch", async () =>
      Response.json([
        entry(40, -100, 75),
        { latitude: 31, longitude: -90 }, // no current block: model gap
        entry(46, -70, 10),
      ])
    );

    const points = await new WeatherService().cloudCover();

    const expected: CloudCoverPoint[] = [
      { lat: 40, lon: -100, cloudCover: 75, time: "2026-07-16T06:15" },
      { lat: 46, lon: -70, cloudCover: 10, time: "2026-07-16T06:15" },
    ];
    assert.deepEqual(points, expected);
  });

  it("throws on a non-OK upstream response", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(null, { status: 502 })
    );

    await assert.rejects(new WeatherService().cloudCover(), {
      message: "Open-Meteo request failed: 502",
    });
  });

  it("serves cached points without refetching within the TTL", async (t) => {
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      Response.json([entry(40, -100, 75)])
    );
    const service = new WeatherService();

    const first = await service.cloudCover();
    const second = await service.cloudCover();

    assert.equal(fetchMock.mock.callCount(), 1);
    assert.equal(second, first);
  });

  it("refetches after the TTL expires", async (t) => {
    t.mock.timers.enable({ apis: ["Date"] });
    const fetchMock = t.mock.method(globalThis, "fetch", async () =>
      Response.json([entry(40, -100, 75)])
    );
    const service = new WeatherService();

    await service.cloudCover();
    t.mock.timers.tick(CACHE_TTL_MS + 1);
    await service.cloudCover();

    assert.equal(fetchMock.mock.callCount(), 2);
  });

  it("does not cache a failed fetch", async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls += 1;
      if (calls === 1) return new Response(null, { status: 500 });
      return Response.json([entry(40, -100, 75)]);
    });
    const service = new WeatherService();

    await assert.rejects(service.cloudCover());
    const points = await service.cloudCover();

    assert.equal(calls, 2);
    assert.equal(points.length, 1);
  });
});
