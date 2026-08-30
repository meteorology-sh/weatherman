// Types
import type {
  CandidatePoint,
  CandidateStats,
  CloudBaseStats,
  CloudTopStats,
  DomainFrame,
  DomainRing,
  ForecastMeta,
  SlwStats,
  RadarStats,
  Sounding,
  StormNear,
} from "@/lib/types";
import { boxParams, INITIAL_BOX } from "@/lib/bbox";
import type { MapBox } from "@/lib/bbox";

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
export function ForecastCloudsUrl(hour: number, box: MapBox = INITIAL_BOX): string {
  return `/forecast/clouds?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
}

export function ForecastPrecipUrl(hour: number, box: MapBox = INITIAL_BOX): string {
  return `/forecast/precip?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
}

export function ForecastLiquidUrl(hour: number, box: MapBox = INITIAL_BOX): string {
  return `/forecast/liquid?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
}

/**
 * Cloud base, banded server-side. Pinned to the analysis hour on the candidate
 * map, like the liquid-water layer, so nothing repoints this url.
 */
export function ForecastCloudBaseUrl(
  hour: number,
  box: MapBox = INITIAL_BOX
): string {
  return `/forecast/cloudbase?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
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
): Promise<Sounding | null> {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    hour: String(hour),
  });
  const res = await fetch(`/forecast/sounding?${query}`);
  // Outside the model's grid — the same answer, and the same null, as
  // `GetCandidatePoint`.
  if (res.status === 404) return null;
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
export function CandidateFieldUrl(box: MapBox = INITIAL_BOX): string {
  return `/candidate/field?${new URLSearchParams(boxParams(box))}`;
}

/** The same field at a past hour. `at` names the HRRR cycle to replay. */
export function ReplayCandidateUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/candidate/field?${new URLSearchParams({
    at,
    ...boxParams(box),
  })}`;
}

/**
 * The outline around the part of that field the satellite still sees liquid at
 * the top of. Same build, drawn over the field rather than instead of it.
 */
export function CandidateConfirmedUrl(box: MapBox = INITIAL_BOX): string {
  return `/candidate/field/confirmed?${new URLSearchParams(boxParams(box))}`;
}

/** The same outline at a past hour. */
export function ReplayConfirmedUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/candidate/field/confirmed?${new URLSearchParams({
    at,
    ...boxParams(box),
  })}`;
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
 * The join read over one clicked point — what the cloud there is made of and
 * which test, if any, ruled it out.
 *
 * Takes `[lon, lat]` because that is what an ArcGIS click returns, and sends
 * `lat`/`lon` because that is what the server takes. The swap happens here, like
 * `GetSounding`, rather than at every call site.
 */
export async function GetCandidatePoint(
  lon: number,
  lat: number
): Promise<CandidatePoint | null> {
  const query = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  const res = await fetch(`/candidate/point?${query}`);
  // The one non-OK status that is not an error. A click off the edge of the
  // model is answered "not here", and null is that answer — the caller has
  // nothing to show and nothing to apologise for.
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Failed to fetch the point: ${res.status}`);
  }
  const point: CandidatePoint = await res.json();
  return point;
}

/**
 * Which build an answer came off, as one comparable string.
 *
 * The join is only as current as its slowest source, so a build is named by all
 * four: the model cycle, the satellite sweep, the radar scan and the phase
 * sweep. Any one of them rolling is a different picture of the sky, and the
 * layers have to be sent after it.
 *
 * Both the summary and the point readout carry these times, and they spell the
 * phase sweep differently — `phase.sceneTime` on one, `phaseTime` on the other.
 * Reconciling that is exactly the kind of transform that belongs here rather
 * than at two call sites that could drift apart.
 */
export function CandidateBuild(build: {
  run: string;
  sceneTime: string;
  radarTime: string;
  phaseTime: string | null;
}): string {
  return [build.run, build.sceneTime, build.radarTime, build.phaseTime].join(
    "|"
  );
}

/**
 * The edge of the model, as one polygon.
 *
 * Drawn as the line inside which a click is answered. It never changes, so it
 * is fetched once and the layer that draws it reads the same route.
 */
export function DomainUrl(): string {
  return "/forecast/domain";
}

export async function GetDomain(): Promise<DomainRing> {
  const res = await fetch(DomainUrl());
  if (!res.ok) {
    throw new Error(`Failed to fetch the model domain: ${res.status}`);
  }
  const frame: DomainFrame = await res.json();
  return frame.features[0].geometry.coordinates[0];
}

/**
 * Observed cloud tops, banded server-side from a GOES-East scene. No hour and
 * no run, for the same reason the radar route has neither: this is whatever the
 * satellite scanned a few minutes ago, and the frame carries its own scan time.
 */
export function CloudTopUrl(box: MapBox = INITIAL_BOX): string {
  return `/cloudtop/temperature?${new URLSearchParams(boxParams(box))}`;
}

/**
 * The same layers, at a past hour.
 *
 * `at` names the HRRR cycle and the scene to replay. Every route takes it and
 * every route treats its absence as "live", so these builders exist to keep the
 * parameter spelled one way rather than to reach different endpoints.
 */
export function ReplayCloudTopUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/cloudtop/temperature?${new URLSearchParams({
    at,
    ...boxParams(box),
  })}`;
}

export function ReplayLiquidUrl(
  at: string,
  hour = 0,
  box: MapBox = INITIAL_BOX
): string {
  return `/forecast/liquid?${new URLSearchParams({
    hour: String(hour),
    at,
    ...boxParams(box),
  })}`;
}

export function ReplayCloudBaseUrl(
  at: string,
  hour = 0,
  box: MapBox = INITIAL_BOX
): string {
  return `/forecast/cloudbase?${new URLSearchParams({
    hour: String(hour),
    at,
    ...boxParams(box),
  })}`;
}

export function ReplayRadarUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/radar/reflectivity?${new URLSearchParams({
    at,
    ...boxParams(box),
  })}`;
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
export function RadarReflectivityUrl(box: MapBox = INITIAL_BOX): string {
  return `/radar/reflectivity?${new URLSearchParams(boxParams(box))}`;
}

/** Contiguous ≥20 dBZ storms on the same mosaic as the reflectivity contours. */
export function RadarObjectsUrl(box: MapBox = INITIAL_BOX): string {
  return `/radar/objects?${new URLSearchParams(boxParams(box))}`;
}

export function RadarStormCoresUrl(box: MapBox = INITIAL_BOX): string {
  return `/radar/objects/cores?${new URLSearchParams(boxParams(box))}`;
}

export function ReplayRadarObjectsUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/radar/objects?${new URLSearchParams({ at, ...boxParams(box) })}`;
}

export function ReplayRadarStormCoresUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/radar/objects/cores?${new URLSearchParams({ at, ...boxParams(box) })}`;
}

/** The storm containing this click, or the nearest one. Null when none is near. */
export async function GetStormNear(
  lon: number,
  lat: number,
  at?: string
): Promise<StormNear | null> {
  const query = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
  });
  if (at) query.set("at", at);
  const res = await fetch(`/radar/objects/near?${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch storm at point: ${res.status}`);
  }
  return res.json();
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
