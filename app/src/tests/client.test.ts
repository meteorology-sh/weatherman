// Client
import {
  CandidateBuild,
  CandidateConfirmedUrl,
  CandidateFieldUrl,
  GetCandidatePoint,
  GetDomain,
  GetCandidateStats,
  ReplayCandidateUrl,
  ReplayConfirmedUrl,
  ForecastCloudBaseUrl,
  GetCloudBaseStats,
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
    expect(ForecastCloudsUrl(0)).toBe(
      "/forecast/clouds?hour=0&west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("carries the requested hour", () => {
    expect(ForecastCloudsUrl(12)).toBe(
      "/forecast/clouds?hour=12&west=-107&east=-93&south=25.5&north=37"
    );
  });
});

describe("ForecastPrecipUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(ForecastPrecipUrl(1)).toBe(
      "/forecast/precip?hour=1&west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("carries the requested hour", () => {
    expect(ForecastPrecipUrl(12)).toBe(
      "/forecast/precip?hour=12&west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("asks a different route than the cloud frame", () => {
    expect(ForecastPrecipUrl(6)).not.toBe(ForecastCloudsUrl(6));
  });
});

describe("GetCloudBaseStats", () => {
  it("fetches the relative server route with the hour", async () => {
    await GetCloudBaseStats(0);
    expect(fetch).toHaveBeenCalledWith("/forecast/cloudbase/stats?hour=0");
  });

  // Every route takes `at`, and its absence means live rather than a default
  // date — so the parameter must not be sent when there is none.
  it("omits `at` when no hour is being replayed", async () => {
    await GetCloudBaseStats(0);
    expect(fetch).toHaveBeenCalledWith("/forecast/cloudbase/stats?hour=0");
  });

  it("passes a replayed hour through", async () => {
    await GetCloudBaseStats(0, "2025-05-15T18:00:00.000Z");
    expect(fetch).toHaveBeenCalledWith(
      "/forecast/cloudbase/stats?hour=0&at=2025-05-15T18%3A00%3A00.000Z"
    );
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    await expect(GetCloudBaseStats(0)).rejects.toThrow(
      "Failed to fetch cloud base stats: 500"
    );
  });
});

describe("ForecastCloudBaseUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(ForecastCloudBaseUrl(0)).toBe(
      "/forecast/cloudbase?hour=0&west=-107&east=-93&south=25.5&north=37"
    );
  });

  // One cached server build serves both, but they are separate routes: the
  // geometry never enters the store.
  it("asks a different route than the stats", () => {
    expect(ForecastCloudBaseUrl(0)).not.toBe(
      "/forecast/cloudbase/stats?hour=0"
    );
  });
});

describe("ForecastLiquidUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(ForecastLiquidUrl(0)).toBe(
      "/forecast/liquid?hour=0&west=-107&east=-93&south=25.5&north=37"
    );
  });

  // The frame and the stats come from one cached server build, but they are
  // separate routes: the geometry never enters the store.
  it("asks a different route than the stats", () => {
    expect(ForecastLiquidUrl(0)).not.toBe("/forecast/liquid/stats?hour=0");
  });
});

describe("RadarReflectivityUrl", () => {
  it("builds a relative url so the proxy routes it", () => {
    expect(RadarReflectivityUrl()).toBe(
      "/radar/reflectivity?west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("names the window the map can paint", () => {
    expect(RadarReflectivityUrl()).toContain("west=-107");
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

  // The one non-OK status that is not a failure: outside HRRR's grid there is
  // no column to read, and null says so without the caller raising an error
  // about a click on the ocean.
  it("answers null for a point outside the model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    expect(await GetSounding(-158, 21, 0)).toBe(null);
  });
});

describe("GetCandidatePoint", () => {
  // The same swap as the sounding, and the same reason: a click is [lon, lat].
  it("sends the point as lat and lon", async () => {
    await GetCandidatePoint(-101.42, 32.05);

    expect(fetch).toHaveBeenCalledWith(
      "/candidate/point?lat=32.05&lon=-101.42"
    );
  });

  // No hour: the join leans on an observed cloud top, so it exists at the
  // analysis hour only.
  it("asks for no hour", async () => {
    await GetCandidatePoint(-101.42, 32.05);

    expect(fetch).toHaveBeenCalledWith(expect.not.stringContaining("hour"));
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 500, json: async () => ({}) }))
    );
    await expect(GetCandidatePoint(-101.42, 32.05)).rejects.toThrow(
      "Failed to fetch the point: 500"
    );
  });

  it("answers null for a point outside the model", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    );

    expect(await GetCandidatePoint(-158, 21)).toBe(null);
  });
});

describe("GetDomain", () => {
  it("reads the ring out of the polygon the server sends", async () => {
    const ring = [
      [-120, 25],
      [-70, 25],
      [-70, 50],
      [-120, 25],
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {},
              geometry: { type: "Polygon", coordinates: [ring] },
            },
          ],
        }),
      }))
    );

    expect(await GetDomain()).toEqual(ring);
  });
});

describe("cloud tops", () => {

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

describe("GetCandidateStats", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // No hour: the join reads an observed cloud top, and a satellite cannot
  // forecast, so the field exists at the analysis hour only.
  it("asks for the live field with no parameters at all", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await GetCandidateStats();

    expect(fetcher.mock.calls[0][0]).toBe("/candidate/field/stats");
  });

  it("passes a replayed hour through as `at`", async () => {
    const fetcher = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response("{}", { status: 200 }));

    await GetCandidateStats("2025-05-15T18:00:00.000Z");

    expect(fetcher.mock.calls[0][0]).toContain(
      "at=2025-05-15T18%3A00%3A00.000Z"
    );
  });

  it("throws on a non-OK response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("nope", { status: 503 })
    );

    await expect(GetCandidateStats()).rejects.toThrow(/503/);
  });
});

describe("candidate field urls", () => {
  it("names the live field without a date", () => {
    expect(CandidateFieldUrl()).toBe(
      "/candidate/target?west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("names a replayed field by its hour", () => {
    expect(ReplayCandidateUrl("2025-05-15T18:00:00.000Z")).toBe(
      "/candidate/target?at=2025-05-15T18%3A00%3A00.000Z&west=-107&east=-93&south=25.5&north=37"
    );
  });

  // A second trace of the same build, not a subset of the field's route — the
  // outline is drawn over the field rather than instead of it.
  it("names the observed outline on its own route", () => {
    expect(CandidateConfirmedUrl()).toBe(
      "/candidate/field/confirmed?west=-107&east=-93&south=25.5&north=37"
    );
  });

  it("names a replayed outline by its hour", () => {
    expect(ReplayConfirmedUrl("2025-05-15T18:00:00.000Z")).toBe(
      "/candidate/field/confirmed?at=2025-05-15T18%3A00%3A00.000Z&west=-107&east=-93&south=25.5&north=37"
    );
  });
});

// A build is only as current as its slowest source, so all four times name it.
// Comparing one would leave the map drawing a stale field whenever the source
// that rolled was not the one being watched.
describe("naming a candidate build", () => {
  const build = {
    run: "2026-08-12T04:00:00.000Z",
    sceneTime: "2026-08-12T04:01:17.900Z",
    radarTime: "2026-08-12T04:00:39.000Z",
    phaseTime: "2026-08-12T04:01:17.900Z",
  };

  it("is the same string for the same build", () => {
    expect(CandidateBuild(build)).toBe(CandidateBuild({ ...build }));
  });

  it("changes when the satellite sweep rolls", () => {
    expect(CandidateBuild({ ...build, sceneTime: "later" })).not.toBe(
      CandidateBuild(build)
    );
  });

  it("changes when the radar scan rolls", () => {
    expect(CandidateBuild({ ...build, radarTime: "later" })).not.toBe(
      CandidateBuild(build)
    );
  });

  it("changes when the model cycle rolls", () => {
    expect(CandidateBuild({ ...build, run: "later" })).not.toBe(
      CandidateBuild(build)
    );
  });

  // The phase scan is the one source the join can do without, so its absence
  // has to be a build like any other rather than an unnameable one.
  it("names a build with no phase scan", () => {
    expect(CandidateBuild({ ...build, phaseTime: null })).not.toBe(
      CandidateBuild(build)
    );
  });
});
