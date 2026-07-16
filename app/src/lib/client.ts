// ArcGIS
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer";
import { CloudCoverRenderer } from "@/lib/arcgis/renderers";
import { CloudCoverPopupTemplate } from "@/lib/arcgis/templates";

// Types
import type { CloudCoverPoint, CloudPointI, GeoJSON } from "@/lib/types";

export async function GetCloudCover(): Promise<
  [GeoJSONLayer, CloudCoverPoint[]]
> {
  const res = await fetch("/weather/cloud-cover");
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud cover: ${res.status}`);
  }
  const points: CloudCoverPoint[] = await res.json();

  // Build GeoJSON FeatureCollection from the sampled national grid
  const features: CloudPointI[] = points.map((p, index) => ({
    type: "Feature" as const,
    id: index + 1,
    geometry: {
      type: "Point" as const,
      coordinates: [p.lon, p.lat] as [number, number],
    },
    properties: {
      cloudCover: p.cloudCover,
      lat: p.lat,
      lon: p.lon,
      time: p.time,
    },
  }));

  const geojson: GeoJSON<CloudPointI> = { type: "FeatureCollection", features };

  // Build ArcGIS GeoJSONLayer from blob URL
  const blob = new Blob([JSON.stringify(geojson)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const layer = new GeoJSONLayer({
    url,
    renderer: CloudCoverRenderer,
    popupTemplate: CloudCoverPopupTemplate,
  });

  return [layer, points];
}
