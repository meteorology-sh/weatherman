// Types
import type {
  CloudTopStats,
  ForecastMeta,
  SlwStats,
  RadarStats,
  Sounding,
} from "@/lib/types";

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

/**
 * The vertical profile over one point: where 0, −5 and −12 °C sit, in feet.
 *
 * Small enough for the store, unlike everything else HRRR serves here — it is
 * one column of a dozen levels, not a national field.
 */
export async function GetSounding(
  lon: number,
  lat: number,
  hour: number
): Promise<Sounding> {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    hour: String(hour),
  });
  const res = await fetch(`/forecast/sounding?${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch the sounding: ${res.status}`);
  }
  const sounding: Sounding = await res.json();
  return sounding;
}

/**
 * Observed cloud tops, banded server-side from a GOES-East scene. No hour and
 * no run, for the same reason the radar route has neither: this is whatever the
 * satellite scanned a few minutes ago, and the frame carries its own scan time.
 */
export function CloudTopUrl(): string {
  return "/cloudtop/temperature";
}

/** The same scene's summary. Asking for it also warms the server's build. */
export async function GetCloudTopStats(): Promise<CloudTopStats> {
  const res = await fetch("/cloudtop/temperature/stats");
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud tops: ${res.status}`);
  }
  const stats: CloudTopStats = await res.json();
  return stats;
}

/**
 * Observed reflectivity, contoured server-side from the MRMS mosaic. No hour
 * and no run: a radar scene is whatever the network saw a few minutes ago, and
 * the frame carries its own valid time.
 */
export function RadarReflectivityUrl(): string {
  return "/radar/reflectivity";
}

/** The same scene's summary. Asking for it also warms the server's build. */
export async function GetRadarStats(): Promise<RadarStats> {
  const res = await fetch("/radar/reflectivity/stats");
  if (!res.ok) {
    throw new Error(`Failed to fetch radar mosaic: ${res.status}`);
  }
  const stats: RadarStats = await res.json();
  return stats;
}
