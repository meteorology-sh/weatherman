// Types
import type {
  CandidateStats,
  CloudBaseStats,
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
 * Cloud base, banded server-side. Pinned to the analysis hour on the candidate
 * map, like the liquid-water layer, so nothing repoints this url.
 */
export function ForecastCloudBaseUrl(hour: number): string {
  return `/forecast/cloudbase?${new URLSearchParams({ hour: String(hour) })}`;
}

/** The same build's summary. Asking for it also warms the server's build. */
export async function GetCloudBaseStats(
  hour: number,
  at?: string
): Promise<CloudBaseStats> {
  const query = new URLSearchParams({ hour: String(hour) });
  if (at) query.set("at", at);
  const res = await fetch(`/forecast/cloudbase/stats?${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud base stats: ${res.status}`);
  }
  const stats: CloudBaseStats = await res.json();
  return stats;
}

/**
 * Summary of the supercooled-liquid layer. Small enough for the store, unlike
 * the frame it summarises — and asking for it warms the server's build of that
 * frame, which is why the provider fetches it on landing rather than on the map.
 */
export async function GetLiquidStats(
  hour: number,
  at?: string
): Promise<SlwStats> {
  const query = new URLSearchParams({ hour: String(hour) });
  if (at) query.set("at", at);
  const res = await fetch(`/forecast/liquid/stats?${query}`);
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
 * The candidate field — every layer joined into one.
 *
 * No `hour`, unlike the other HRRR routes: the join leans on an observed cloud
 * top and a satellite cannot forecast, so it exists at the analysis hour only.
 */
export function CandidateFieldUrl(): string {
  return "/candidate/field";
}

/** The same field at a past hour. `at` names the HRRR cycle to replay. */
export function ReplayCandidateUrl(at: string): string {
  return `/candidate/field?${new URLSearchParams({ at })}`;
}

/** The same build's summary. Asking for it also warms the server's build. */
export async function GetCandidateStats(at?: string): Promise<CandidateStats> {
  const res = await fetch(
    at
      ? `/candidate/field/stats?${new URLSearchParams({ at })}`
      : "/candidate/field/stats"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch the candidate field: ${res.status}`);
  }
  const stats: CandidateStats = await res.json();
  return stats;
}

/**
 * Observed cloud tops, banded server-side from a GOES-East scene. No hour and
 * no run, for the same reason the radar route has neither: this is whatever the
 * satellite scanned a few minutes ago, and the frame carries its own scan time.
 */
export function CloudTopUrl(): string {
  return "/cloudtop/temperature";
}

/**
 * The same layers, at a past hour.
 *
 * `at` names the HRRR cycle and the scene to replay. Every route takes it and
 * every route treats its absence as "live", so these builders exist to keep the
 * parameter spelled one way rather than to reach different endpoints.
 */
export function ReplayCloudTopUrl(at: string): string {
  return `/cloudtop/temperature?${new URLSearchParams({ at })}`;
}

export function ReplayLiquidUrl(at: string, hour = 0): string {
  return `/forecast/liquid?${new URLSearchParams({ hour: String(hour), at })}`;
}

export function ReplayCloudBaseUrl(at: string, hour = 0): string {
  return `/forecast/cloudbase?${new URLSearchParams({
    hour: String(hour),
    at,
  })}`;
}

export function ReplayRadarUrl(at: string): string {
  return `/radar/reflectivity?${new URLSearchParams({ at })}`;
}

/** The same scene's summary. Asking for it also warms the server's build. */
export async function GetCloudTopStats(at?: string): Promise<CloudTopStats> {
  const res = await fetch(
    at
      ? `/cloudtop/temperature/stats?${new URLSearchParams({ at })}`
      : "/cloudtop/temperature/stats"
  );
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
export async function GetRadarStats(at?: string): Promise<RadarStats> {
  const res = await fetch(
    at
      ? `/radar/reflectivity/stats?${new URLSearchParams({ at })}`
      : "/radar/reflectivity/stats"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch radar mosaic: ${res.status}`);
  }
  const stats: RadarStats = await res.json();
  return stats;
}
