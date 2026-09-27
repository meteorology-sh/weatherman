/**
 * GOES-East GLM flashes as points.
 *
 * Lightning is sparse and irregular, so it is never contoured
 * (`MEASUREMENTS.md` §3). Each marker is where a flash was. Nothing is
 * drawn between them. A five-minute window matches one ABI sweep: vigour
 * of the storm, not a rate field.
 *
 * Flashes, not events. An event is one optical detection; a flash is the
 * lightning the operator means.
 */

// Services
import { cellAt, inBox, DRAWN } from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import { liveOrArchive, Notices } from "../shared/notices";
import type { NoticeBoard } from "../shared/notices";
import {
  BUCKET,
  download,
  keysInHour,
  MIRROR,
  readScene,
  sceneTime,
} from "./scene";
import type { H5File } from "./scene";
import type { StormObject } from "../mrms/objects";
import type { Geo } from "../shared/contour";

const PRODUCT = "GLM-L2-LCFA";

/** One ABI-length window of granules. */
const WINDOW_MS = 5 * 60_000;

const CACHE_TTL_MS = 5 * 60_000;

/** How the notice board names this feed. */
const SOURCE = "GOES-East lightning";

export type Flash = { lat: number; lon: number };

export type LightningFrame = {
  type: "FeatureCollection";
  validTime: string;
  features: {
    type: "Feature";
    properties: Record<string, never>;
    geometry: { type: "Point"; coordinates: [number, number] };
  }[];
};

/** Degrees: half a 1 km mosaic cell, so a flash maps to one raining cell. */
const CELL_HALF_DEG = 0.007;

export function readFlashes(file: H5File): Flash[] {
  const lats = file.get("flash_lat").value;
  const lons = file.get("flash_lon").value;
  const n = Math.min(lats.length, lons.length);
  const out: Flash[] = [];
  for (let i = 0; i < n; i++) {
    const lat = Number(lats[i]);
    const lon = Number(lons[i]);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    out.push({ lat, lon });
  }
  return out;
}

export function flashesInBox(flashes: Flash[], box: LonLatBox): Flash[] {
  return flashes.filter((f) => inBox(f.lat, f.lon, box));
}

/**
 * Flashes whose footprint falls on a raining cell of this storm.
 * Nearest-cell on the mosaic, refused when the flash sits outside that cell.
 */
export function countOver(
  flashes: Flash[],
  storm: StormObject,
  geo: Geo
): number {
  const member = new Set(storm.cells);
  let n = 0;
  let seed: number | undefined;
  for (const f of flashes) {
    seed = cellAt(geo, f.lat, f.lon, seed);
    if (!member.has(seed)) continue;
    if (Math.abs(geo.lats[seed] - f.lat) > CELL_HALF_DEG) continue;
    if (Math.abs(geo.lons[seed] - f.lon) > CELL_HALF_DEG) continue;
    n += 1;
  }
  return n;
}

export function flashFrame(
  validTime: string,
  flashes: Flash[]
): LightningFrame {
  return {
    type: "FeatureCollection",
    validTime,
    features: flashes.map((f) => ({
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "Point" as const,
        coordinates: [f.lon, f.lat] as [number, number],
      },
    })),
  };
}

/**
 * `granules` is how many files the window held and `unread` how many of them
 * could not be read. GLM files a granule every 20 seconds whether or not
 * anything flashed, so a live window with none, or with one unread, is data
 * that did not arrive rather than quiet weather.
 */
type Bundle = {
  validTime: string;
  flashes: Flash[];
  granules: number;
  unread: number;
};

export class LightningService {
  private cache: { bundle: Bundle; fetchedAt: number } | null = null;
  private inflight: Promise<Bundle> | null = null;
  private archive = new Map<string, Bundle>();
  private readonly notices: NoticeBoard;

  constructor(notices: NoticeBoard = Notices) {
    this.notices = notices;
  }

  async flashes(at?: Date, box: LonLatBox = DRAWN): Promise<LightningFrame> {
    const bundle = await this.bundle(at);
    return flashFrame(bundle.validTime, flashesInBox(bundle.flashes, box));
  }

  async overStorm(
    storm: StormObject,
    geo: Geo,
    at?: Date
  ): Promise<number | null> {
    try {
      const bundle = await this.bundle(at);
      return countOver(bundle.flashes, storm, geo);
    } catch {
      return null;
    }
  }

  private async bundle(at?: Date): Promise<Bundle> {
    if (at) {
      const key = at.toISOString().slice(0, 16);
      const hit = this.archive.get(key);
      if (hit) return hit;
      const built = await this.build(at);
      this.archive.set(key, built);
      return built;
    }

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.bundle;
    }
    if (this.inflight) return this.inflight;
    const work = this.live()
      .then((bundle) => {
        this.cache = { bundle, fetchedAt: Date.now() };
        return bundle;
      })
      .finally(() => {
        this.inflight = null;
      });
    this.inflight = work;
    return work;
  }

  /**
   * The last five minutes from AWS, or Google Cloud's copy of them when the
   * AWS read fails or comes back missing granules.
   */
  private live(): Promise<Bundle> {
    return liveOrArchive({
      source: SOURCE,
      copy: "Google Cloud's copy",
      live: () => this.build(),
      archive: () => this.build(undefined, MIRROR),
      validTime: (bundle) => bundle.validTime,
      looksWrong: (bundle) => bundle.granules === 0 || bundle.unread > 0,
      board: this.notices,
    });
  }

  private async build(at?: Date, bucket: string = BUCKET): Promise<Bundle> {
    const end = at ?? new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const keys = await this.keysInWindow(start, end, bucket);
    if (keys.length === 0) {
      return {
        validTime: end.toISOString(),
        flashes: [],
        granules: 0,
        unread: 0,
      };
    }
    const parts = await Promise.all(
      keys.map(async (key) => {
        try {
          return await readScene(await download(key), readFlashes);
        } catch {
          return null;
        }
      })
    );
    return {
      validTime: sceneTime(keys[keys.length - 1]),
      flashes: parts.flatMap((part) => part ?? []),
      granules: keys.length,
      unread: parts.filter((part) => part === null).length,
    };
  }

  private async keysInWindow(
    start: Date,
    end: Date,
    bucket: string
  ): Promise<string[]> {
    const hours = [start, end];
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const hour of hours) {
      for (const key of await keysInHour(PRODUCT, hour, bucket)) {
        if (seen.has(key)) continue;
        seen.add(key);
        const t = Date.parse(sceneTime(key));
        if (Number.isNaN(t)) continue;
        if (t < start.getTime() || t > end.getTime()) continue;
        keys.push(key);
      }
    }
    keys.sort((a, b) => Date.parse(sceneTime(a)) - Date.parse(sceneTime(b)));
    return keys;
  }
}

export const Glm = new LightningService();
