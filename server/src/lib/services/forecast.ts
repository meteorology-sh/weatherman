// Node
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execFileAsync = promisify(execFile);

const HRRR =
  "https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod";

/** HRRR CONUS is a fixed Lambert grid; these never change between runs. */
const NX = 1799;
const NY = 1059;

/** 3 km -> 12 km. Block-averaging removes structure; it never invents it. */
const BLOCK = 4;

/**
 * Cloud-cover isopleths, in percent. Nested: each is a subset of the one below.
 * Must stay in step with CLOUD_BANDS in app/src/lib/arcgis/renderers.ts, which
 * decides how each level is painted.
 *
 * No 10% band on purpose: ~65% of the country has at least 10% cloud on a
 * normal day, so it veils the map without telling the operator anything.
 */
const LEVELS = [30, 50, 70, 90];

/** HRRR publishes f00-f18 every cycle. */
export const FORECAST_HOURS = 18;

export type CloudForecastMeta = {
  /** Model run, ISO 8601 (e.g. "2026-07-16T21:00:00.000Z"). */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
};

export type CloudRing = [number, number][];

export type CloudFeature = {
  type: "Feature";
  properties: { cloudCover: number };
  geometry: { type: "MultiPolygon"; coordinates: CloudRing[][] };
};

export type CloudForecast = {
  type: "FeatureCollection";
  /** Valid time of this frame, ISO 8601. */
  validTime: string;
  run: string;
  hour: number;
  features: CloudFeature[];
};

type Grid = { nx: number; ny: number; values: Float32Array };

/** Lat/lon of the (block-averaged) grid. Identical for every run, so computed once. */
type Geo = { nx: number; ny: number; lats: Float32Array; lons: Float32Array };

export class ForecastService {
  private geo: Geo | null = null;
  private runCache: { run: Date; checkedAt: number } | null = null;
  /** Keyed `${runIso}:${hour}`. A given run+hour never changes, so this never expires. */
  private frames = new Map<string, CloudForecast>();
  private inflight = new Map<string, Promise<CloudForecast>>();

  /** Most recent cycle whose f00 index is published. Re-checked every 5 min. */
  async latestRun(): Promise<Date> {
    if (this.runCache && Date.now() - this.runCache.checkedAt < 5 * 60_000) {
      return this.runCache.run;
    }

    const now = new Date();
    // HRRR posts ~50 min after the hour; walk back until an index exists.
    for (let back = 1; back <= 6; back++) {
      const run = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours() - back
        )
      );
      const res = await fetch(this.idxUrl(run, 0), { method: "HEAD" });
      if (res.ok) {
        this.runCache = { run, checkedAt: Date.now() };
        return run;
      }
    }
    throw new Error("No published HRRR run found in the last 6 cycles");
  }

  async meta(): Promise<CloudForecastMeta> {
    const run = await this.latestRun();
    return {
      run: run.toISOString(),
      hours: Array.from({ length: FORECAST_HOURS + 1 }, (_, i) => i),
    };
  }

  async clouds(hour: number): Promise<CloudForecast> {
    if (!Number.isInteger(hour) || hour < 0 || hour > FORECAST_HOURS) {
      throw new Error(`Forecast hour must be an integer 0-${FORECAST_HOURS}`);
    }

    const run = await this.latestRun();
    const key = `${run.toISOString()}:${hour}`;

    const cached = this.frames.get(key);
    if (cached) return cached;

    // Collapse concurrent requests for the same frame onto one download.
    const running = this.inflight.get(key);
    if (running) return running;

    const work = this.build(run, hour)
      .then((frame) => {
        this.frames.set(key, frame);
        this.evictOldRuns(run);
        return frame;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, work);
    return work;
  }

  private evictOldRuns(current: Date) {
    const keep = current.toISOString();
    for (const key of this.frames.keys()) {
      if (!key.startsWith(keep)) this.frames.delete(key);
    }
  }

  private idxUrl(run: Date, hour: number) {
    return `${this.gribUrl(run, hour)}.idx`;
  }

  private gribUrl(run: Date, hour: number) {
    const d = run.toISOString().slice(0, 10).replace(/-/g, "");
    const cc = String(run.getUTCHours()).padStart(2, "0");
    const fh = String(hour).padStart(2, "0");
    return `${HRRR}/hrrr.${d}/conus/hrrr.t${cc}z.wrfsfcf${fh}.grib2`;
  }

  /** Byte range of the total-cloud-cover record, from the plain-text .idx. */
  private async cloudRange(run: Date, hour: number): Promise<[number, number]> {
    const res = await fetch(this.idxUrl(run, hour));
    if (!res.ok) {
      throw new Error(`HRRR index unavailable: ${res.status}`);
    }
    const lines = (await res.text()).trim().split("\n");
    const rows = lines.map((l) => l.split(":"));
    const i = rows.findIndex(
      (r) => r[3] === "TCDC" && r[4] === "entire atmosphere"
    );
    if (i < 0) throw new Error("TCDC not present in HRRR index");
    const start = Number(rows[i][1]);
    const end = rows[i + 1] ? Number(rows[i + 1][1]) - 1 : NaN;
    if (!Number.isFinite(end)) throw new Error("Could not bound TCDC record");
    return [start, end];
  }

  private async build(run: Date, hour: number): Promise<CloudForecast> {
    const [start, end] = await this.cloudRange(run, hour);
    const res = await fetch(this.gribUrl(run, hour), {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (!res.ok) throw new Error(`HRRR fetch failed: ${res.status}`);
    const grib = Buffer.from(await res.arrayBuffer());

    const { grid, geo } = await this.decode(grib);
    if (!this.geo) this.geo = geo;

    const features = LEVELS.map((level) => ({
      type: "Feature" as const,
      properties: { cloudCover: level },
      geometry: {
        type: "MultiPolygon" as const,
        coordinates: polygons(grid, this.geo!, level),
      },
    })).filter((f) => f.geometry.coordinates.length > 0);

    const valid = new Date(run.getTime() + hour * 3_600_000);
    return {
      type: "FeatureCollection",
      run: run.toISOString(),
      hour,
      validTime: valid.toISOString(),
      features,
    };
  }

  /**
   * eccodes reads the Lambert grid and hands back lat/lon per point, so we
   * never do projection maths ourselves. Values are block-averaged to 12 km on
   * the fly — the full 3 km grid is 1.9M points and we don't need that
   * resolution for a national overview.
   */
  private async decode(grib: Buffer): Promise<{ grid: Grid; geo: Geo }> {
    const dir = await mkdtemp(join(tmpdir(), "hrrr-"));
    const file = join(dir, "tcdc.grib2");
    try {
      await writeFile(file, grib);
      const { stdout } = await execFileAsync(
        "grib_get_data",
        ["-m", "9999", file],
        { maxBuffer: 256 * 1024 * 1024 }
      );
      return accumulate(stdout);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/**
 * Parse `grib_get_data` output ("lat lon value" per line, row-major) directly
 * into block averages, so the 1.9M-point grid is never held in memory.
 */
function accumulate(text: string): { grid: Grid; geo: Geo } {
  const ox = Math.floor(NX / BLOCK);
  const oy = Math.floor(NY / BLOCK);
  const n = ox * oy;
  const sv = new Float64Array(n);
  const sla = new Float64Array(n);
  const slo = new Float64Array(n);
  const cnt = new Uint16Array(n);

  let i = 0; // point index within the full grid
  let pos = text.indexOf("\n") + 1; // skip the header line

  while (pos < text.length) {
    let nl = text.indexOf("\n", pos);
    if (nl < 0) nl = text.length;
    const line = text.slice(pos, nl);
    pos = nl + 1;
    if (!line) continue;

    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const row = Math.floor(i / NX);
    const col = i % NX;
    i++;

    const bj = Math.floor(row / BLOCK);
    const bi = Math.floor(col / BLOCK);
    if (bj >= oy || bi >= ox) continue;

    const value = Number(parts[2]);
    if (!Number.isFinite(value)) continue;

    const o = bj * ox + bi;
    sla[o] += Number(parts[0]);
    let lon = Number(parts[1]);
    if (lon > 180) lon -= 360;
    slo[o] += lon;
    sv[o] += value;
    cnt[o]++;
  }

  const values = new Float32Array(n);
  const lats = new Float32Array(n);
  const lons = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const c = cnt[k] || 1;
    values[k] = sv[k] / c;
    lats[k] = sla[k] / c;
    lons[k] = slo[k] / c;
  }

  return {
    grid: { nx: ox, ny: oy, values },
    geo: { nx: ox, ny: oy, lats, lons },
  };
}

type Pt = readonly [number, number];

/**
 * Marching squares over {value >= level}, stitched into closed rings, with
 * holes nested inside the exterior that contains them (GeoJSON needs
 * [exterior, ...holes] or a clear patch inside a cloud mass renders as cloud).
 */
export function polygons(grid: Grid, geo: Geo, level: number): CloudRing[][] {
  const rings = trace(grid, level).map((ring) =>
    ring.map(([fi, fj]) => project(fi, fj, geo))
  );

  const exteriors: { ring: CloudRing; area: number; holes: CloudRing[] }[] = [];
  const holes: CloudRing[] = [];

  for (const ring of rings) {
    const a = signedArea(ring);
    if (a > 0) exteriors.push({ ring, area: a, holes: [] });
    else if (a < 0) holes.push(ring);
  }

  // Smallest containing exterior wins, so holes inside nested shapes land right.
  for (const hole of holes) {
    let best: (typeof exteriors)[number] | null = null;
    for (const ext of exteriors) {
      if (!contains(ext.ring, hole[0])) continue;
      if (!best || ext.area < best.area) best = ext;
    }
    if (best) best.holes.push(hole);
  }

  return exteriors.map((e) => [e.ring, ...e.holes]);
}

/** Grid coords (in the 1-cell padded space) -> lat/lon, bilinear on eccodes' own arrays. */
function project(fi: number, fj: number, geo: Geo): [number, number] {
  const gi = Math.min(Math.max(fi - 1, 0), geo.nx - 1.001);
  const gj = Math.min(Math.max(fj - 1, 0), geo.ny - 1.001);
  const i0 = Math.floor(gi);
  const j0 = Math.floor(gj);
  const di = gi - i0;
  const dj = gj - j0;
  const i1 = Math.min(i0 + 1, geo.nx - 1);
  const j1 = Math.min(j0 + 1, geo.ny - 1);

  const bil = (a: Float32Array) =>
    a[j0 * geo.nx + i0] * (1 - di) * (1 - dj) +
    a[j0 * geo.nx + i1] * di * (1 - dj) +
    a[j1 * geo.nx + i0] * (1 - di) * dj +
    a[j1 * geo.nx + i1] * di * dj;

  return [round(bil(geo.lons)), round(bil(geo.lats))];
}

const round = (n: number) => Math.round(n * 1000) / 1000;

const SIDES = {
  T: (i: number, j: number) => [i + 0.5, j] as Pt,
  R: (i: number, j: number) => [i + 1, j + 0.5] as Pt,
  B: (i: number, j: number) => [i + 0.5, j + 1] as Pt,
  L: (i: number, j: number) => [i, j + 0.5] as Pt,
};

/** Marching-squares cases, directed so the region is on the left of each segment. */
const CASES: Record<number, [keyof typeof SIDES, keyof typeof SIDES][]> = {
  1: [["B", "L"]],
  2: [["R", "B"]],
  3: [["R", "L"]],
  4: [["T", "R"]],
  5: [
    ["T", "L"],
    ["B", "R"],
  ],
  6: [["T", "B"]],
  7: [["T", "L"]],
  8: [["L", "T"]],
  9: [["B", "T"]],
  10: [
    ["L", "B"],
    ["R", "T"],
  ],
  11: [["R", "T"]],
  12: [["L", "R"]],
  13: [["B", "R"]],
  14: [["L", "B"]],
};

/** Closed rings in padded grid coordinates. */
function trace(grid: Grid, level: number): Pt[][] {
  const { nx, ny, values } = grid;
  // Pad by one cell so regions touching the domain edge still close.
  const w = nx + 2;
  const h = ny + 2;
  const mask = new Uint8Array(w * h);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      if (values[j * nx + i] >= level) mask[(j + 1) * w + (i + 1)] = 1;
    }
  }

  const next = new Map<string, Pt[]>();
  const key = (p: Pt) => `${p[0]},${p[1]}`;

  for (let j = 0; j < h - 1; j++) {
    for (let i = 0; i < w - 1; i++) {
      const tl = mask[j * w + i];
      const tr = mask[j * w + i + 1];
      const br = mask[(j + 1) * w + i + 1];
      const bl = mask[(j + 1) * w + i];
      const c = (tl << 3) | (tr << 2) | (br << 1) | bl;
      const segs = CASES[c];
      if (!segs) continue;
      for (const [from, to] of segs) {
        const a = SIDES[from](i, j);
        const b = SIDES[to](i, j);
        const k = key(a);
        const list = next.get(k);
        if (list) list.push(b);
        else next.set(k, [b]);
      }
    }
  }

  const rings: Pt[][] = [];
  for (const start of Array.from(next.keys())) {
    while (next.get(start)?.length) {
      const ring: Pt[] = [];
      let cur: Pt = start.split(",").map(Number) as unknown as Pt;
      for (;;) {
        const outs = next.get(key(cur));
        if (!outs || outs.length === 0) break;
        const step = outs.pop()!;
        ring.push(cur);
        cur = step;
        if (key(cur) === start) {
          ring.push(cur);
          break;
        }
      }
      if (ring.length >= 4) rings.push(ring);
    }
  }
  return rings;
}

function signedArea(ring: CloudRing): number {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    s += (ring[i + 1][0] - ring[i][0]) * (ring[i + 1][1] + ring[i][1]);
  }
  return s / 2;
}

/** Ray casting; ring is closed (first === last). */
function contains(ring: CloudRing, p: [number, number]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 2; i < ring.length - 1; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > p[1] !== yj > p[1]) {
      const x = ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi;
      if (p[0] < x) inside = !inside;
    }
  }
  return inside;
}

export const Hrrr = new ForecastService();
