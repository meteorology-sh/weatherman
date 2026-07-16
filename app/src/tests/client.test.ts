// Client
import { GetCloudCover } from "@/lib/client";

// Types
import type { CloudCoverPoint } from "@/lib/types";

const points: CloudCoverPoint[] = [
  { lat: 40, lon: -100, cloudCover: 75, time: "2026-07-16T06:15" },
  { lat: 30, lon: -90, cloudCover: 10, time: "2026-07-16T06:15" },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, status: 200, json: async () => points }))
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GetCloudCover", () => {
  it("fetches the relative server route", async () => {
    await GetCloudCover();
    expect(fetch).toHaveBeenCalledWith("/weather/cloud-cover");
  });

  it("throws on a non-OK response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, status: 502, json: async () => ({}) }))
    );
    await expect(GetCloudCover()).rejects.toThrow(
      "Failed to fetch cloud cover: 502"
    );
  });

  it("returns the points for the store", async () => {
    await expect(GetCloudCover()).resolves.toEqual(points);
  });
});
