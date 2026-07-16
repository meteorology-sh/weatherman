// Client
import { GetCloudCover } from "@/lib/client";

// ArcGIS
import { CloudCoverRenderer } from "@/lib/arcgis/renderers";
import { CloudCoverPopupTemplate } from "@/lib/arcgis/templates";

// Types
import type { CloudCoverPoint, CloudPointI, GeoJSON } from "@/lib/types";

vi.mock("@arcgis/core/layers/GeoJSONLayer", () => ({
  default: class FakeGeoJSONLayer {
    constructor(props: Record<string, unknown>) {
      Object.assign(this, props);
    }
  },
}));
vi.mock("@/lib/arcgis/renderers", () => ({
  CloudCoverRenderer: { kind: "renderer" },
}));
vi.mock("@/lib/arcgis/templates", () => ({
  CloudCoverPopupTemplate: { kind: "template" },
}));

const points: CloudCoverPoint[] = [
  { lat: 40, lon: -100, cloudCover: 75, time: "2026-07-16T06:15" },
  { lat: 30, lon: -90, cloudCover: 10, time: "2026-07-16T06:15" },
];

const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:mock");

beforeEach(() => {
  URL.createObjectURL = createObjectURL;
  createObjectURL.mockClear();
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

  it("builds a GeoJSON FeatureCollection from the fetched points", async () => {
    await GetCloudCover();

    const blob = createObjectURL.mock.calls[0][0];
    const geojson: GeoJSON<CloudPointI> = JSON.parse(await blob.text());

    expect(geojson.type).toBe("FeatureCollection");
    expect(geojson.features).toHaveLength(2);
    expect(geojson.features[0]).toEqual({
      type: "Feature",
      id: 1,
      geometry: { type: "Point", coordinates: [-100, 40] },
      properties: { cloudCover: 75, lat: 40, lon: -100, time: "2026-07-16T06:15" },
    });
  });

  it("constructs the layer from the blob URL with the shared renderer and popup template", async () => {
    const [layer] = await GetCloudCover();

    expect(layer.url).toBe("blob:mock");
    expect(layer.renderer).toBe(CloudCoverRenderer);
    expect(layer.popupTemplate).toBe(CloudCoverPopupTemplate);
  });

  it("returns the points unchanged for the store", async () => {
    const [, returned] = await GetCloudCover();
    expect(returned).toEqual(points);
  });
});
