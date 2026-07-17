// Types
import type { CloudCoverPoint, ForecastMeta } from "@/lib/types";

export async function GetForecastMeta(): Promise<ForecastMeta> {
  const res = await fetch("/forecast/meta");
  if (!res.ok) {
    throw new Error(`Failed to fetch forecast metadata: ${res.status}`);
  }
  const meta: ForecastMeta = await res.json();
  return meta;
}

/**
 * The URL of a forecast frame. The contours are megabytes of geometry, so the
 * GeoJSONLayer fetches this itself rather than routing it through Redux — the
 * same reasoning that keeps GIBS tiles out of the store.
 */
export function ForecastCloudsUrl(hour: number): string {
  return `/forecast/clouds?${new URLSearchParams({ hour: String(hour) })}`;
}

export async function GetCloudCover(): Promise<CloudCoverPoint[]> {
  const res = await fetch("/weather/cloud-cover");
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud cover: ${res.status}`);
  }
  const points: CloudCoverPoint[] = await res.json();
  return points;
}
