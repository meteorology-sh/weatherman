/**
 * Reading the flight record. Same shape as the app's client: plain async
 * functions, PascalCase, relative paths, throw on non-OK.
 *
 * The weather is not fetched here. Those layers are pointed at the Weatherman
 * server by url and fetch their own geometry, exactly as they do in the app.
 */

// Types
import type { Day, DaySummary } from "./types";

export async function GetDays(): Promise<DaySummary[]> {
  const res = await fetch("/eval/days");
  if (!res.ok) throw new Error(`Failed to fetch seeded days: ${res.status}`);
  return res.json();
}

export async function GetDay(date: string): Promise<Day> {
  const res = await fetch(`/eval/day/${date}`);
  if (!res.ok) throw new Error(`Failed to fetch ${date}: ${res.status}`);
  return res.json();
}

/**
 * The url the flare layer reads, optionally windowed to a slice of the day.
 *
 * A url rather than a fetch, because a GeoJSONLayer fetches its own geometry —
 * the same reason the app's layer urls are built rather than called.
 */
export function ReleasesUrl(date: string, from?: string, to?: string): string {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const query = params.toString();
  return `/eval/day/${date}/releases.geojson${query ? `?${query}` : ""}`;
}

export function CountiesUrl(): string {
  return "/eval/counties.geojson";
}
