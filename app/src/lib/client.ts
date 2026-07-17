// Types
import type { ForecastMeta, SlwStats } from "@/lib/types";

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
 * GeoJSONLayer fetches these itself rather than routing them through Redux —
 * the same reasoning that keeps GIBS tiles out of the store.
 */
export function ForecastCloudsUrl(hour: number): string {
  return `/forecast/clouds?${new URLSearchParams({ hour: String(hour) })}`;
}

export function ForecastPrecipUrl(hour: number): string {
  return `/forecast/precip?${new URLSearchParams({ hour: String(hour) })}`;
}

export function ForecastLiquidUrl(hour: number): string {
  return `/forecast/liquid?${new URLSearchParams({ hour: String(hour) })}`;
}

/**
 * Summary of the supercooled-liquid layer. Small enough for the store, unlike
 * the frame it summarises — and asking for it warms the server's build of that
 * frame, which is why the provider fetches it on landing rather than on the map.
 */
export async function GetLiquidStats(hour: number): Promise<SlwStats> {
  const res = await fetch(
    `/forecast/liquid/stats?${new URLSearchParams({ hour: String(hour) })}`
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch liquid water stats: ${res.status}`);
  }
  const stats: SlwStats = await res.json();
  return stats;
}
