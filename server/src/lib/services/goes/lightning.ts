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
import { download, keysInHour, readScene, sceneTime } from "./scene";
import type { H5File } from "./scene";
import type { StormObject } from "../mrms/objects";
import type { Geo } from "../shared/contour";

const PRODUCT = "GLM-L2-LCFA";

/** One ABI-length window of granules. */
const WINDOW_MS = 5 * 60_000;

const CACHE_TTL_MS = 5 * 60_000;

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

type Bundle = { validTime: string; flashes: Flash[] };

export class LightningService {
  private cache: { bundle: Bundle; fetchedAt: number } | null = null;
  private inflight: Promise<Bundle> | null = null;
  private archive = new Map<string, Bundle>();

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
    const work = this.build()
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

  private async build(at?: Date): Promise<Bundle> {
    const end = at ?? new Date();
    const start = new Date(end.getTime() - WINDOW_MS);
    const keys = await this.keysInWindow(start, end);
    if (keys.length === 0) {
      return { validTime: end.toISOString(), flashes: [] };
    }
    const parts = await Promise.all(
      keys.map(async (key) => {
        try {
          return await readScene(await download(key), readFlashes);
        } catch {
          return [] as Flash[];
        }
      })
    );
    return {
      validTime: sceneTime(keys[keys.length - 1]),
      flashes: parts.flat(),
    };
  }

  private async keysInWindow(start: Date, end: Date): Promise<string[]> {
    const hours = [start, end];
    const seen = new Set<string>();
    const keys: string[] = [];
    for (const hour of hours) {
      for (const key of await keysInHour(PRODUCT, hour)) {
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
