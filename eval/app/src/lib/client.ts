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
 */

// Types
import type {
  BandFinding,
  Day,
  DaySummary,
  OverlapFinding,
  Painted,
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

/** Finding 1 — the band against the balloons. */
export async function GetBand(): Promise<BandFinding> {
  return get<BandFinding>("/band");
}

/** Finding 2 — the flares against what we painted. */
export async function GetOverlap(): Promise<OverlapFinding> {
  return get<OverlapFinding>("/overlap");
}

export async function GetDays(): Promise<DaySummary[]> {
  return get<DaySummary[]>("/days");
}

export async function GetDay(date: string): Promise<Day> {
  return get<Day>(`/day/${date}`);
}

/** The frames a day was painted with, if `held.mjs` has run for it. */
export async function GetPainted(date: string): Promise<Painted> {
  return get<Painted>(`/day/${date}/painted`);
}

/** The county boundaries, as a url a layer can be pointed at. */
export function CountiesUrl(): string {
  return "/eval/counties.geojson";
}
