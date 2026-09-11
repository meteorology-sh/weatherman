/**
 * MRMS 18 dBZ echo-top: the highest altitude in the column where
 * reflectivity still meets 18 dBZ.
 *
 * That is the top of precipitating hydrometeors, not of the cloud. GOES
 * still owns cloud-top temperature. Heights are kilometers MSL in the
 * GRIB; the click reports feet. The glaciogenic cue — 18 dBZ top at or
 * above the freezing level — is drawn as its own fill, labeled as
 * measured height at a modeled isotherm, not a volume scan.
 */

// Node
import { gunzip } from "zlib";
import { promisify } from "util";

// Services
import { eachMessage } from "../shared/grib";
import { cellAt, DRAWN, prepareDraw } from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import { LOOKS_WRONG, Notices, REQUEST_FAILED } from "../shared/notices";
import type { NoticeBoard } from "../shared/notices";
import { hasEmptyQuarter } from "./coverage";
import { features, smoothFor } from "../shared/contour";
import type { ContourFrame, Geo, Grid } from "../shared/contour";
import { METERS_TO_FEET } from "../hrrr/profile";
import { Hrrr } from "../hrrr/forecast";
import {
  archiveKeyTime,
  mosaicIndex,
  nativeGeo,
  nativeGrid,
  sceneTime,
} from "./radar";
import type { StormObject } from "./objects";

const gunzipAsync = promisify(gunzip);

const MRMS =
  "https://mrms.ncep.noaa.gov/data/2D/EchoTop_18/" +
  "MRMS_EchoTop_18.latest.grib2.gz";

const MRMS_ARCHIVE = "https://noaa-mrms-pds.s3.amazonaws.com";
const MRMS_PRODUCT = "EchoTop_18_00.50";

/** Same 0.01° mosaic as MergedBaseReflectivityQC. */
const NX = 7000;
const NY = 3500;
const POINTS = NX * NY;

const SCENE_TOLERANCE_MS = 30 * 60_000;
const CACHE_TTL_MS = 5 * 60_000;
/** Click-only, so fewer decoded scenes than the mosaic keeps. */
const ARCHIVE_CACHE = 4;

/**
 * Two sentinels, same job as the reflectivity mosaic:
 *
 * - **-1: no echo.** A radar looked here and found no 18 dBZ.
 * - **-3: no coverage.** No radar sees this column.
 *
 * Real tops are kilometers MSL, always positive. Zero does not appear.
 */
export const NO_ECHO_KM = -1;
export const NO_COVERAGE_KM = -3;

/** Kilometers MSL to feet. */
export const KM_TO_FT = METERS_TO_FEET * 1000;

type Scene = { grid: Grid; geo: Geo; validTime: string };

export type EchoTopHit = {
  echoTopFt: number;
  lat: number;
  lon: number;
};

/** Feet MSL, or null where the column has no 18 dBZ (or no radar). */
export function heightFt(km: number): number | null {
  if (!(km > 0)) return null;
  return Math.round(km * KM_TO_FT);
}

/**
 * 18 dBZ echo top, ft MSL, on the same cells as `echoTopKm`.
 * NaN where there is no 18 dBZ (or no radar).
 */
export function echoTopFtValues(echoTopKm: Float32Array): Float32Array {
  const out = new Float32Array(echoTopKm.length);
  for (let i = 0; i < echoTopKm.length; i++) {
    const ft = heightFt(echoTopKm[i]);
    out[i] = ft === null ? Number.NaN : ft;
  }
  return out;
}

/**
 * Sample the 1 km echo-top mosaic onto an HRRR column. Nearest cell,
 * nothing interpolated.
 */
export function sampleEchoTopKm(mosaic: Grid, geo: Geo): Float32Array {
  const out = new Float32Array(geo.lats.length).fill(NO_COVERAGE_KM);
  for (let cell = 0; cell < geo.lats.length; cell++) {
    const k = mosaicIndex(
      geo.lats[cell],
      geo.lons[cell],
      mosaic.nx,
      mosaic.ny
    );
    if (k >= 0) out[cell] = mosaic.values[k];
  }
  return out;
}

/**
 * 1 where the measured 18 dBZ top sits at or above the modeled
 * freezing level. NaN elsewhere.
 */
export function pastFreezingValues(
  echoTopKm: Float32Array,
  freezingFt: Float32Array
): Float32Array {
  const out = new Float32Array(echoTopKm.length);
  out.fill(Number.NaN);
  for (let i = 0; i < echoTopKm.length; i++) {
    const ft = heightFt(echoTopKm[i]);
    if (ft === null) continue;
    const freeze = freezingFt[i];
    if (!Number.isFinite(freeze)) continue;
    if (ft >= freeze) out[i] = 1;
  }
  return out;
}

/**
 * Highest 18 dBZ top on this storm's 1 km cells. Nothing is interpolated:
 * each raining cell reads the echo-top cell whose footprint contains it.
 */
export function tallestOver(
  storm: StormObject,
  stormGeo: Geo,
  echoGeo: Geo,
  values: Float32Array
): EchoTopHit | null {
  const seen = new Set<number>();
  let seed: number | undefined;
  let best: { km: number; cell: number } | null = null;
  for (const k of storm.cells) {
    seed = cellAt(echoGeo, stormGeo.lats[k], stormGeo.lons[k], seed);
    if (seen.has(seed)) continue;
    seen.add(seed);
    const v = values[seed];
    if (!(v > 0)) continue;
    if (!best || v > best.km) best = { km: v, cell: seed };
  }
  if (!best) return null;
  const ft = heightFt(best.km);
  if (ft === null) return null;
  return {
    echoTopFt: ft,
    lat: echoGeo.lats[best.cell],
    lon: echoGeo.lons[best.cell],
  };
}

/**
 * A radar looked at this cell. Anything above the midpoint of the two
 * sentinels, so a decode that rounds either one still lands on its own side.
 */
export const echoTopCovered = (km: number) =>
  km > (NO_ECHO_KM + NO_COVERAGE_KM) / 2;

/** How the notice board names this feed. */
const SOURCE = "MRMS echo top";

export class EchoTopService {
  private geo: Geo | null = null;
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();
  private readonly notices: NoticeBoard;

  constructor(notices: NoticeBoard = Notices) {
    this.notices = notices;
  }

  async tallest(
    storm: StormObject,
    stormGeo: Geo,
    at?: Date
  ): Promise<EchoTopHit | null> {
    if (!at && !this.cache && !this.inflight) {
      this.warm();
      return null;
    }
    const scene = await this.scene(at);
    return tallestOver(storm, stormGeo, scene.geo, scene.grid.values);
  }

  /** Start a decode without waiting. A click does not wait on a cold GRIB. */
  warm(at?: Date): void {
    void this.scene(at).catch(() => undefined);
  }

  /**
   * The 1 km mosaic. Sample onto HRRR with {@link sampleEchoTopKm}.
   */
  async mosaic(at?: Date): Promise<Scene> {
    return this.scene(at);
  }

  /**
   * 18 dBZ echo top, ft MSL, sampled onto `geo`. NaN where there is no
   * 18 dBZ. Nearest mosaic cell, nothing interpolated — the same sample
   * the past-freezing fill is drawn from.
   */
  async sampledFt(geo: Geo, at?: Date): Promise<Float32Array> {
    const scene = await this.mosaic(at);
    return echoTopFtValues(sampleEchoTopKm(scene.grid, geo));
  }

  /**
   * Where the 18 dBZ top is at or above the freezing level. Measured
   * height, modeled isotherm, on HRRR's 3 km cells.
   */
  async pastFreezing(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    const [scene, band] = await Promise.all([
      this.scene(at),
      Hrrr.bandField(0, at),
    ]);
    const echoKm = sampleEchoTopKm(scene.grid, band.geo);
    const values = pastFreezingValues(echoKm, band.freezingFt);
    // Absence is nodata, not zero: a lone 3 km column must not paint
    // the whole 12 km block the map contours.
    const drawn = prepareDraw(
      { nx: band.geo.nx, ny: band.geo.ny, values },
      band.geo,
      box,
      fine,
      undefined,
      true
    );
    return {
      type: "FeatureCollection",
      run: band.run.toISOString(),
      validTime: scene.validTime,
      hour: band.hour,
      features: features(
        drawn.grid,
        drawn.geo,
        "pastFreezing",
        [1],
        smoothFor(fine)
      ),
    };
  }

  private async scene(at?: Date): Promise<Scene> {
    if (at) return this.replay(at);

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
    if (this.inflight) return this.inflight;

    const work = this.live()
      .then((scene) => {
        this.cache = { scene, fetchedAt: Date.now() };
        return scene;
      })
      .finally(() => {
        this.inflight = null;
      });

    this.inflight = work;
    return work;
  }

  /**
   * The live mosaic, or NOAA's archived copy of it when the live request fails
   * or its data looks wrong.
   *
   * The archive is the same product filed minutes later, built apart from the
   * live file, and the notice says how many minutes behind live it is. The live
   * file is still asked first on every rebuild, so the map returns to it, and
   * the notice clears, as soon as it answers well.
   */
  private async live(): Promise<Scene> {
    let scene: Scene;
    try {
      scene = await this.build();
    } catch (error) {
      return this.fallback(REQUEST_FAILED, null, error);
    }
    if (hasEmptyQuarter(scene.grid, echoTopCovered)) {
      return this.fallback(LOOKS_WRONG, scene);
    }
    this.notices.clear(SOURCE);
    return scene;
  }

  /**
   * The archived scan nearest the live one when it looks right. Otherwise the
   * live scene as it is, or the live failure when there is no live scene.
   */
  private async fallback(
    detail: string,
    live: Scene | null,
    failure?: unknown
  ): Promise<Scene> {
    const want = live ? new Date(live.validTime) : new Date();
    const archived = await this.replay(want).catch(() => null);

    if (archived && !hasEmptyQuarter(archived.grid, echoTopCovered)) {
      this.notices.report(SOURCE, {
        detail: `${detail} Showing NOAA's archived copy.`,
        delayMinutes: Math.max(
          0,
          Math.round((want.getTime() - Date.parse(archived.validTime)) / 60_000)
        ),
      });
      return archived;
    }

    this.notices.report(SOURCE, { detail, delayMinutes: null });
    if (live) return live;
    throw failure;
  }

  private async replay(at: Date): Promise<Scene> {
    const key = await this.sceneAt(at);

    const cached = this.archive.get(key);
    if (cached) return cached;

    const running = this.archiveInflight.get(key);
    if (running) return running;

    const work = this.build(key)
      .then((scene) => {
        this.archive.set(key, scene);
        while (this.archive.size > ARCHIVE_CACHE) {
          this.archive.delete(this.archive.keys().next().value!);
        }
        return scene;
      })
      .finally(() => this.archiveInflight.delete(key));

    this.archiveInflight.set(key, work);
    return work;
  }

  private async sceneAt(at: Date): Promise<string> {
    if (Number.isNaN(at.getTime())) {
      throw new Error("`at` must be an ISO 8601 timestamp");
    }
    const want = at.getTime();
    const keys: string[] = [];
    for (const offset of [-1, 0, 1]) {
      const t = new Date(want + offset * 3_600_000);
      const day = t.toISOString().slice(0, 10).replace(/-/g, "");
      const hh = String(t.getUTCHours()).padStart(2, "0");
      const prefix = `CONUS/${MRMS_PRODUCT}/${day}/MRMS_${MRMS_PRODUCT}_${day}-${hh}`;
      keys.push(...(await this.list(prefix)));
    }

    let best: { key: string; delta: number } | null = null;
    for (const key of keys) {
      const t = Date.parse(archiveKeyTime(key));
      if (Number.isNaN(t)) continue;
      const delta = Math.abs(t - want);
      if (!best || delta < best.delta) best = { key, delta };
    }

    if (!best) {
      throw new Error(`No archived MRMS echo-top near ${at.toISOString()}`);
    }
    if (best.delta > SCENE_TOLERANCE_MS) {
      throw new Error(
        `Nearest archived MRMS echo-top to ${at.toISOString()} is ` +
          `${Math.round(best.delta / 60_000)} min away — refusing to caption it ` +
          `as that time`
      );
    }
    return best.key;
  }

  private async list(prefix: string): Promise<string[]> {
    const res = await fetch(
      `${MRMS_ARCHIVE}/?list-type=2&prefix=${encodeURIComponent(prefix)}`
    );
    if (!res.ok) {
      throw new Error(`MRMS echo-top listing failed: ${res.status}`);
    }
    const xml = await res.text();
    return Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]);
  }

  private async build(key?: string): Promise<Scene> {
    const grib = await gunzipAsync(await this.download(key));

    let grid: Grid | null = null;
    let validTime = "";

    await eachMessage(
      grib,
      {
        keys: ["validityDate", "validityTime"],
        points: POINTS,
        onMessage: ([date, time], values) => {
          validTime = sceneTime(date, time);
          grid = nativeGrid(values, NX, NY);
        },
      },
      "echotop"
    );

    if (!grid) throw new Error("MRMS echo-top carried no message");

    this.geo ??= nativeGeo(NX, NY);

    return { grid, geo: this.geo, validTime };
  }

  private async download(key?: string): Promise<Buffer> {
    const url = key ? `${MRMS_ARCHIVE}/${key}` : MRMS;
    let last: unknown;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) {
          throw new Error(`MRMS echo-top unavailable: ${res.status}`);
        }
        return Buffer.from(await res.arrayBuffer());
      } catch (error) {
        last = error;
      }
    }
    throw new Error(
      `MRMS echo-top unreachable: ${last instanceof Error ? last.message : String(last)}`
    );
  }
}

export const EchoTops = new EchoTopService();
