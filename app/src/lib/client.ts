// Types
import type {
  CandidatePoint,
  CandidateStats,
  TargetStats,
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
export function ForecastCloudsUrl(
  hour: number,
  box: MapBox = INITIAL_BOX
): string {
  return `/forecast/clouds?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
}

export function ForecastPrecipUrl(
  hour: number,
  box: MapBox = INITIAL_BOX
): string {
  return `/forecast/precip?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
}

export function ForecastLiquidUrl(
  hour: number,
  box: MapBox = INITIAL_BOX
): string {
  return `/forecast/liquid?${new URLSearchParams({
    hour: String(hour),
    ...boxParams(box),
  })}`;
}

/**
 * Cloud base, banded server-side: HRRR's own base where it has one, the CCL
 * where it does not, under a measured echo top and below 18,000 ft MSL.
 *
 * No `hour`. The echo top that gates it is an observation and an observation
 * cannot be forecast, so the layer exists at the analysis hour only — the same
 * reason the candidate field has no hour either.
 */
export function CloudBaseUrl(box: MapBox = INITIAL_BOX): string {
  return `/candidate/cloudbase?${new URLSearchParams({
    ...boxParams(box),
  })}`;
}

/** The same build's summary. Asking for it also warms the server's build. */
export async function GetCloudBaseStats(at?: string): Promise<CloudBaseStats> {
  const query = new URLSearchParams();
  if (at) query.set("at", at);
  const res = await fetch(`/candidate/cloudbase/stats?${query}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch cloud base stats: ${res.status}`);
  }
  const stats: CloudBaseStats = await res.json();
  return stats;
}

/**
 * Summary of the supercooled-liquid layer. Small enough for the store, unlike
 * the frame it summarizes — and asking for it warms the server's build of that
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
 * The Texas fly fill — base in the window, echo top past freezing,
 * rain nearby. Liquid-with-no-rain geometry stays on `/candidate/field` for
 * eval.
 *
 * `fine` traces the native 3 km cells instead of the 4×4 average. It is a
 * gate, so the average changes the answer rather than smoothing it, and a
 * click always reads the native cell — `tracesNative` decides when the display
 * can show the difference.
 *
 * `round` rides with it. A gate has no gradient to put a vertex along, so its
 * ring runs on cell edges and comes out as a staircase whatever the cell size;
 * the map takes the corners off it and the evaluation, which measures against
 * that edge, does not.
 */
export function CandidateFieldUrl(
  box: MapBox = INITIAL_BOX,
  fine = false
): string {
  return `/candidate/target?${new URLSearchParams({
    ...boxParams(box),
    ...(fine ? { fine: "1", round: "1" } : {}),
  })}`;
}

/** The same fill at a past hour. `at` names the HRRR cycle to replay. */
export function ReplayCandidateUrl(
  at: string,
  box: MapBox = INITIAL_BOX,
  fine = false
): string {
  return `/candidate/target?${new URLSearchParams({
    at,
    ...boxParams(box),
    ...(fine ? { fine: "1", round: "1" } : {}),
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

/** How much ground passed the Texas tests. Same cached build as the fill. */
export async function GetTargetStats(at?: string): Promise<TargetStats> {
  const res = await fetch(
    at
      ? `/candidate/target/stats?${new URLSearchParams({ at })}`
      : "/candidate/target/stats"
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch the Texas join: ${res.status}`);
  }
  return res.json();
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
  box: MapBox = INITIAL_BOX
): string {
  return `/candidate/cloudbase?${new URLSearchParams({
    at,
    ...boxParams(box),
  })}`;
}

export function ReplayRadarUrl(at: string, box: MapBox = INITIAL_BOX): string {
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

export function RadarStormCoresUrl(box: MapBox = INITIAL_BOX): string {
  return `/radar/objects/cores?${new URLSearchParams(boxParams(box))}`;
}

/**
 * Heading ticks from each core. Empty when the storm has no motion.
 *
 * `shape=line` asks for the tick as a line rather than the painted dart:
 * this map draws it a fixed number of pixels wide, so the width must not
 * be baked into the geometry as kilometers.
 */
export function RadarStormMotionUrl(box: MapBox = INITIAL_BOX): string {
  return `/radar/objects/motion?${new URLSearchParams({
    shape: "line",
    ...boxParams(box),
  })}`;
}

/** 18 dBZ top at or above the freezing level. */
export function RadarEchoFreezeUrl(box: MapBox = INITIAL_BOX): string {
  return `/radar/echotop/past-freezing?${new URLSearchParams(boxParams(box))}`;
}

/** GLM flashes in the last five minutes, as points. */
export function LightningUrl(box: MapBox = INITIAL_BOX): string {
  return `/cloudtop/lightning?${new URLSearchParams(boxParams(box))}`;
}

export function ReplayRadarStormCoresUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/radar/objects/cores?${new URLSearchParams({ at, ...boxParams(box) })}`;
}

export function ReplayRadarStormMotionUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/radar/objects/motion?${new URLSearchParams({
    at,
    shape: "line",
    ...boxParams(box),
  })}`;
}

export function ReplayRadarEchoFreezeUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/radar/echotop/past-freezing?${new URLSearchParams({
    at,
    ...boxParams(box),
  })}`;
}

export function ReplayLightningUrl(
  at: string,
  box: MapBox = INITIAL_BOX
): string {
  return `/cloudtop/lightning?${new URLSearchParams({ at, ...boxParams(box) })}`;
}

/**
 * The storm containing this click, or the nearest one, with modeled liquid
 * and the observed top change over that storm. Null when none is near.
 */
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
  const res = await fetch(`/candidate/storm?${query}`);
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
