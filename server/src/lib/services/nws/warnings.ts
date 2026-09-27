/**
 * NWS Severe Thunderstorm, Tornado and Flash Flood Warning polygons in force at
 * a moment.
 *
 * Each Texas program's operating plan, filed with NOAA on Form 17-4 under
 * 15 CFR 908, names the NWS warnings its operations are suspended under. The
 * lists differ by program; these three are every warning type any of them
 * names. The warning is the forecast office's decision (NWSI 10-511), so
 * nothing here is derived from reflectivity or VIL, and no seeding test reads
 * this layer.
 *
 * The polygon is the office's, not the storm's. It covers the warned storm and
 * the ground ahead of it, and other cells inside it are not themselves warned.
 * The map draws it over everything else and gates nothing.
 *
 * The live map reads the NWS alerts API. A past minute, and the live map's
 * copy when that API fails, come from the Iowa Environmental Mesonet's
 * storm-based warning archive. Both answer with each warning once, as the
 * polygon in force: a follow-up statement that shrinks a warning replaces its
 * polygon.
 */

// Services
import { inBox, DRAWN } from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import { liveOrArchive, Notices } from "../shared/notices";
import type { NoticeBoard } from "../shared/notices";

const LIVE =
  "https://api.weather.gov/alerts/active?event=Severe%20Thunderstorm%20Warning,Tornado%20Warning,Flash%20Flood%20Warning";

const ARCHIVE = "https://mesonet.agron.iastate.edu/geojson/sbw.geojson";

/** api.weather.gov refuses requests without one. */
const USER_AGENT = "weatherman";

/** How the notice board names this feed. */
const SOURCE = "NWS severe weather warnings";

/** Warnings update by the minute; this is how long a live snapshot stands. */
const CACHE_TTL_MS = 2 * 60_000;

const TIMEOUT_MS = 30_000;

/** VTEC phenomena this layer draws, with significance W (warning). */
const PHENOMENA = {
  SV: "Severe Thunderstorm Warning",
  TO: "Tornado Warning",
  FF: "Flash Flood Warning",
} as const;

export type Phenomenon = keyof typeof PHENOMENA;

type Ring = [number, number][];

export type WarningGeometry =
  | { type: "Polygon"; coordinates: Ring[] }
  | { type: "MultiPolygon"; coordinates: Ring[][] };

export type WarningFeature = {
  type: "Feature";
  properties: {
    phenomenon: Phenomenon;
    event: string;
    office: string;
    eventId: number;
    /** When this polygon took effect, ISO 8601. */
    begins: string;
    /** When this polygon lapses, ISO 8601. */
    ends: string;
  };
  geometry: WarningGeometry;
};

export type WarningFrame = {
  type: "FeatureCollection";
  /** The minute the warnings are in force at. */
  validTime: string;
  fetchedAt: string;
  features: WarningFeature[];
};

export type WarningStats = {
  validTime: string;
  fetchedAt: string;
  /** Warnings in force over the drawn domain. */
  count: number;
  severe: number;
  tornado: number;
  flood: number;
};

/** The active-alerts answer, as much of it as this reads. */
export type AlertCollection = {
  features: {
    properties: {
      messageType: string;
      sent: string;
      ends: string | null;
      expires: string;
      parameters?: { VTEC?: string[] };
    };
    geometry: WarningGeometry | null;
  }[];
};

/** The archive's answer, as much of it as this reads. */
export type SbwCollection = {
  features: {
    properties: {
      phenomena: string;
      significance: string;
      wfo: string;
      eventid: number;
      polygon_begin: string;
      polygon_end: string;
    };
    geometry: WarningGeometry | null;
  }[];
};

const isPhenomenon = (value: string): value is Phenomenon =>
  Object.keys(PHENOMENA).includes(value);

function feature(
  phenomenon: Phenomenon,
  office: string,
  eventId: number,
  begins: number,
  ends: number,
  geometry: WarningGeometry
): WarningFeature {
  return {
    type: "Feature",
    properties: {
      phenomenon,
      event: PHENOMENA[phenomenon],
      office,
      eventId,
      begins: new Date(begins).toISOString(),
      ends: new Date(ends).toISOString(),
    },
    geometry,
  };
}

/** `/O.CON.KSGF.SV.W.0404.000000T0000Z-260916T2245Z/` → action, office, … */
const VTEC = /^\/O\.([A-Z]{3})\.K?([A-Z]{3,4})\.([A-Z]{2})\.([A-Z])\.(\d{4})\./;

/**
 * The warnings this layer draws, out of an active-alerts answer, that are in force
 * at `at`. A cancellation carries the polygon it cancels, so it is dropped; a
 * warning with more than one statement keeps its latest.
 */
export function alertsAt(
  collection: AlertCollection,
  at: Date
): WarningFeature[] {
  const t = at.getTime();
  const latest = new Map<string, { sent: number; warning: WarningFeature }>();
  for (const row of collection.features) {
    const p = row.properties;
    if (p.messageType === "Cancel" || !row.geometry) continue;
    const match = VTEC.exec(p.parameters?.VTEC?.[0] ?? "");
    if (!match) continue;
    const [, action, office, phenomena, significance, id] = match;
    if (action === "CAN" || significance !== "W") continue;
    if (!isPhenomenon(phenomena)) continue;
    const sent = Date.parse(p.sent);
    const ends = Date.parse(p.ends ?? p.expires);
    if (!(sent <= t && t < ends)) continue;
    const eventId = Number(id);
    const key = `${office}.${phenomena}.${eventId}`;
    const held = latest.get(key);
    if (held && held.sent >= sent) continue;
    latest.set(key, {
      sent,
      warning: feature(phenomena, office, eventId, sent, ends, row.geometry),
    });
  }
  return Array.from(latest.values(), (held) => held.warning);
}

/**
 * The warnings this layer draws, out of an archive snapshot, that are in force
 * at `at`. The snapshot also carries river-flood products, advisories, and
 * polygons that lapsed inside the minute; none of those is drawn.
 */
export function warningsAt(
  collection: SbwCollection,
  at: Date
): WarningFeature[] {
  const t = at.getTime();
  const out: WarningFeature[] = [];
  for (const row of collection.features) {
    const p = row.properties;
    if (p.significance !== "W" || !row.geometry) continue;
    if (!isPhenomenon(p.phenomena)) continue;
    const begins = Date.parse(p.polygon_begin);
    const ends = Date.parse(p.polygon_end);
    if (!(begins <= t && t < ends)) continue;
    out.push(
      feature(p.phenomena, p.wfo, p.eventid, begins, ends, row.geometry)
    );
  }
  return out;
}

/** The minute `at` falls in, as the archive's `ts` wants it. */
export function minuteOf(at: Date): string {
  return `${at.toISOString().slice(0, 16)}Z`;
}

function rings(geometry: WarningGeometry): Ring[] {
  return geometry.type === "Polygon"
    ? geometry.coordinates
    : geometry.coordinates.flat();
}

/** Whether the polygon's bounding box meets the box. */
export function touchesBox(geometry: WarningGeometry, box: LonLatBox): boolean {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const ring of rings(geometry)) {
    for (const [lon, lat] of ring) {
      if (inBox(lat, lon, box)) return true;
      west = Math.min(west, lon);
      east = Math.max(east, lon);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    }
  }
  return (
    west <= box.east &&
    east >= box.west &&
    south <= box.north &&
    north >= box.south
  );
}

export function warningStats(frame: WarningFrame): WarningStats {
  const of = (phenomenon: Phenomenon) =>
    frame.features.filter((f) => f.properties.phenomenon === phenomenon).length;
  return {
    validTime: frame.validTime,
    fetchedAt: frame.fetchedAt,
    count: frame.features.length,
    severe: of("SV"),
    tornado: of("TO"),
    flood: of("FF"),
  };
}

type Snapshot = {
  validTime: string;
  fetchedAt: string;
  features: WarningFeature[];
};

export class WarningService {
  private cache: { snapshot: Snapshot; fetchedAt: number } | null = null;
  private inflight: Promise<Snapshot> | null = null;
  private archive = new Map<string, Promise<Snapshot>>();
  private readonly notices: NoticeBoard;

  constructor(notices: NoticeBoard = Notices) {
    this.notices = notices;
  }

  async warnings(at?: Date, box: LonLatBox = DRAWN): Promise<WarningFrame> {
    const snapshot = await this.snapshot(at);
    return {
      type: "FeatureCollection",
      validTime: snapshot.validTime,
      fetchedAt: snapshot.fetchedAt,
      features: snapshot.features.filter((f) => touchesBox(f.geometry, box)),
    };
  }

  async stats(at?: Date): Promise<WarningStats> {
    return warningStats(await this.warnings(at));
  }

  private snapshot(at?: Date): Promise<Snapshot> {
    if (at) {
      // Keyed by minute, and the promise is what is kept, so the stats route
      // and the layer asking for the same replayed minute share one request.
      const key = minuteOf(at);
      const hit = this.archive.get(key);
      if (hit) return hit;
      const work = this.fromArchive(new Date(key));
      this.archive.set(key, work);
      work.catch(() => this.archive.delete(key));
      return work;
    }

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return Promise.resolve(this.cache.snapshot);
    }
    if (this.inflight) return this.inflight;
    const work = this.live()
      .then((snapshot) => {
        this.cache = { snapshot, fetchedAt: Date.now() };
        return snapshot;
      })
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = work;
    return work;
  }

  /**
   * The NWS alerts API, or the archive at this minute when it fails. No
   * warnings is an answer, not a sign of a broken feed, so only a failed
   * request falls back.
   */
  private live(): Promise<Snapshot> {
    return liveOrArchive({
      source: SOURCE,
      copy: "the Iowa Environmental Mesonet's archive",
      live: () => this.fromAlerts(),
      archive: (want) => this.fromArchive(new Date(minuteOf(want))),
      validTime: (snapshot) => snapshot.validTime,
      board: this.notices,
    });
  }

  private async fromAlerts(): Promise<Snapshot> {
    const collection = (await this.read(LIVE, {
      "User-Agent": USER_AGENT,
      Accept: "application/geo+json",
    })) as AlertCollection;
    const now = new Date();
    return {
      validTime: now.toISOString(),
      fetchedAt: now.toISOString(),
      features: alertsAt(collection, now),
    };
  }

  private async fromArchive(at: Date): Promise<Snapshot> {
    const collection = (await this.read(
      `${ARCHIVE}?ts=${minuteOf(at)}`
    )) as SbwCollection;
    return {
      validTime: at.toISOString(),
      fetchedAt: new Date().toISOString(),
      features: warningsAt(collection, at),
    };
  }

  private async read(
    url: string,
    headers: Record<string, string> = {}
  ): Promise<unknown> {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`${url} answered ${res.status}`);
    return res.json();
  }
}

export const Warnings = new WarningService();
