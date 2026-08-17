/**
 * Reading the findings off the eval server.
 *
 * Plain async functions, PascalCase, throwing on non-OK — the same shape as
 * `/app`'s client, because a reader moving between the two should not have to
 * learn a second convention.
 *
 * **Everything here is local.** The findings are files the harness in `eval/`
 * wrote, served on 3100. Weather comes from the product's own server through
 * `@/lib/client`, and this file never fetches any.
 *
 * **Every finding is scoped to a region.** A programme's season is a whole
 * dataset rather than a filter on one, so the region is a path segment and every
 * call below takes it. There is no unscoped route to fall back to, which is what
 * stops one operator's numbers being read as the state's.
 */

// Types
import type {
  BandFinding,
  Day,
  DaySummary,
  OverlapFinding,
  Painted,
  Region,
} from "./types";

/** A run that has not happened yet is a 404, and that is a fair answer. */
export class NotRunYet extends Error {}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/eval${path}`);
  if (res.status === 404) {
    const body = (await res.json().catch(() => null)) as { error?: string };
    throw new NotRunYet(body?.error ?? `Nothing at ${path} yet`);
  }
  if (!res.ok) {
    throw new Error(`Failed to load ${path}: ${res.status}`);
  }
  return res.json();
}

/** Every programme, including the ones with no flight record parsed yet. */
export async function GetRegions(): Promise<Region[]> {
  return get<Region[]>("/regions");
}

/** Finding 1 — the band against the balloons. */
export async function GetBand(region: string): Promise<BandFinding> {
  return get<BandFinding>(`/region/${region}/band`);
}

/** Finding 2 — the flares against what we painted. */
export async function GetOverlap(region: string): Promise<OverlapFinding> {
  return get<OverlapFinding>(`/region/${region}/overlap`);
}

export async function GetDays(region: string): Promise<DaySummary[]> {
  return get<DaySummary[]>(`/region/${region}/days`);
}

export async function GetDay(region: string, date: string): Promise<Day> {
  return get<Day>(`/region/${region}/day/${date}`);
}

/** The frames a day was painted with, if `held.mjs` has run for it. */
export async function GetPainted(
  region: string,
  date: string
): Promise<Painted> {
  return get<Painted>(`/region/${region}/day/${date}/painted`);
}

/** The county boundaries, as a url a layer can be pointed at. */
export function CountiesUrl(): string {
  return "/eval/counties.geojson";
}
