// Client
import {
  CloudTopUrl,
  GetCloudTopStats,
  GetForecastMeta,
  GetLiquidStats,
  GetRadarStats,
  GetSounding,
  RadarReflectivityUrl,
  ForecastCloudsUrl,
  ForecastPrecipUrl,
  ForecastLiquidUrl,
} from "@/lib/client";

// Types
import type { SlwStats } from "@/lib/types";

const stats: SlwStats = {
  run: "2026-07-17T03:00:00.000Z",
  hour: 0,
  validTime: "2026-07-17T03:00:00.000Z",
  coveragePct: 1.99,
  seedableKm2: 338832,
  peak: 964,
  bandTopMb: 425,
  bandBaseMb: 700,
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => stats }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GetForecastMeta", () => {
  it("fetches the relative server route", async () => {
    await GetForecastMeta();
    expect(fetch).toHaveBeenCalledWith("/forecast/meta");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    await expect(GetForecastMeta()).rejects.toThrow(
      "Failed to fetch forecast metadata: 503"
    );
  });
});

describe("GetLiquidStats", () => {
  it("fetches the relative server route with the hour", async () => {
    await GetLiquidStats(0);
    expect(fetch).toHaveBeenCalledWith("/forecast/liquid/stats?hour=0");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    await expect(GetLiquidStats(0)).rejects.toThrow(
      "Failed to fetch liquid water stats: 500"
    );
  });

  it("returns the stats for the store", async () => {
    await expect(GetLiquidStats(0)).resolves.toEqual(stats);
  });
});

describe("ForecastCloudsUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(ForecastCloudsUrl(0)).toBe("/forecast/clouds?hour=0");
  });

  it("carries the requested hour", () => {
    expect(ForecastCloudsUrl(12)).toBe("/forecast/clouds?hour=12");
  });
});

describe("ForecastPrecipUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(ForecastPrecipUrl(1)).toBe("/forecast/precip?hour=1");
  });

  it("carries the requested hour", () => {
    expect(ForecastPrecipUrl(12)).toBe("/forecast/precip?hour=12");
  });

  it("asks a different route than the cloud frame", () => {
    expect(ForecastPrecipUrl(6)).not.toBe(ForecastCloudsUrl(6));
  });
});

describe("ForecastLiquidUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(ForecastLiquidUrl(0)).toBe("/forecast/liquid?hour=0");
  });

  // The frame and the stats come from one cached server build, but they are
  // separate routes: the geometry never enters the store.
  it("asks a different route than the stats", () => {
    expect(ForecastLiquidUrl(0)).not.toBe("/forecast/liquid/stats?hour=0");
  });
});

describe("RadarReflectivityUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(RadarReflectivityUrl()).toBe("/radar/reflectivity");
  });

  // A radar scene has no run and no forecast hour, and a query string here
  // would be stripped into ArcGIS's customParameters rather than the url.
  it("takes no parameters, because a scene is whatever is current", () => {
    expect(RadarReflectivityUrl()).not.toContain("?");
  });
});

describe("GetRadarStats", () => {
  it("fetches the relative server route", async () => {
    await GetRadarStats();
    expect(fetch).toHaveBeenCalledWith("/radar/reflectivity/stats");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    await expect(GetRadarStats()).rejects.toThrow(
      "Failed to fetch radar mosaic: 503"
    );
  });
});

describe("GetSounding", () => {
  // The server takes lat/lon; the app thinks in [lon, lat] because that is what
  // ArcGIS hands back from a click. The swap happens here, once.
  it("sends the point as lat and lon, whatever order the caller holds it in", async () => {
    await GetSounding(-98.58, 39.83, 0);

    expect(fetch).toHaveBeenCalledWith(
      "/forecast/sounding?lat=39.83&lon=-98.58&hour=0"
    );
  });

  it("passes the hour through", async () => {
    await GetSounding(-98.58, 39.83, 6);

    expect(fetch).toHaveBeenCalledWith(
      "/forecast/sounding?lat=39.83&lon=-98.58&hour=6"
    );
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    await expect(GetSounding(-98.58, 39.83, 0)).rejects.toThrow(
      "Failed to fetch the sounding: 500"
    );
  });
});

describe("cloud tops", () => {
  // A scene has no run and no hour to ask for — the frame carries its own scan
  // time, exactly like the radar mosaic.
  it("points the layer at the banded scene with no parameters", () => {
    expect(CloudTopUrl()).toBe("/cloudtop/temperature");
  });

  it("fetches the summary from its own route", async () => {
    await GetCloudTopStats();

    expect(fetch).toHaveBeenCalledWith("/cloudtop/temperature/stats");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 503, json: async () => ({}) }))
    );
    await expect(GetCloudTopStats()).rejects.toThrow(
      "Failed to fetch cloud tops: 503"
    );
  });
});
