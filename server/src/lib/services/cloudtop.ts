/**
 * Observed cloud-top temperature, from GOES-East geometry and HRRR thermodynamics.
 *
 * This is the one layer on either map built from two sources on purpose, and
 * the split is the whole point. `MEASUREMENTS.md` §5 records that HRRR "nails
 * the thermodynamic profile and is much shakier on cloud", so the satellite is
 * asked the question it can answer — *where is the cloud top, and how high* —
 * and HRRR is asked the one it can — *how cold is it up there*. Neither is used
 * for the other's job.
 *
 * That makes it the only cloud layer here that can contradict the model. The
 * supercooled-liquid contours are HRRR's opinion; if the satellite sees no
 * cloud where those contours are amber, the operator learns something, which is
 * exactly the role MRMS already plays.
 */

// Services
import { bandFeatures } from "./contour";
import { Hrrr } from "./forecast";

// Types
import type { Grid, Geo, ContourFeature } from "./contour";
import type { Column } from "./forecast";
import { abiGrid, pixelAt } from "./abi";
import type { AbiGrid } from "./abi";

/**
 * GOES-19 is GOES-East. `ABI-L2-ACHP2KMC` is cloud-top **pressure**, CONUS
 * sector, 2 km — 4.1 MB a scene, a new scene every 5 minutes, keyless.
 *
 * Pressure rather than the `ACHT` cloud-top *temperature* product because there
 * is no CONUS variant of that one: it is published full-disk and mesoscale only.
 * That turns out to be the better accident anyway — pressure is the same
 * variable HRRR's own `PRES:cloud top` carries, so the two sources are
 * interchangeable behind this service if the observed feed ever fails.
 */
const BUCKET = "https://noaa-goes19.s3.amazonaws.com";
const PRODUCT = "ABI-L2-ACHP2KMC";

/**
 * One scene's cadence. A build is dominated by the HRRR profile it leans on
 * (~25 s cold, then free for the rest of that run), and the scene itself
 * refreshes every 5 minutes, so this matches the radar service's reasoning:
 * track the feed loosely and let the frame carry its own valid time rather than
 * implying it is live.
 */
const CACHE_TTL_MS = 5 * 60_000;

/**
 * The analysis hour. The candidate map is "right now", and `CandidateLiquidLayer`
 * is pinned the same way for the same reason.
 */
const ANALYSIS_HOUR = 0;

/** Ground covered by one 12 km cell, km^2. Mirrors CELL_KM2 in forecast.ts. */
const CELL_KM2 = 144;

const CLOUD_TOP = {
  /**
   * Degrees below zero at the cloud top.
   *
   * The field is negated once here because `features()` contours `value >=
   * level` and cloud-top temperature runs the wrong way for that: colder is the
   * direction of interest, and nesting requires the scalar to increase with it.
   * So a top at −18 °C is stored as 18, and the levels below read as −5, −12,
   * −18 and −25 °C.
   */
  property: "topColdnessC",
  /**
   * Band edges in coldness, i.e. −5, −12, −18 and −25 °C. **Disjoint, not
   * nested** — see `bandFeatures`.
   *
   * **−5 °C is a filter; the other three are not.**
   *
   * −5 °C is criterion **C2** from `SENSING_STRATEGY.md`: "the band must
   * physically lie between base and top. A shallow warm cloud never reaches
   * it." A top warmer than −5 °C means the seeding band is *above* the cloud,
   * so there is nothing inside it to seed — and **[verified] that is 71% of all
   * cloudy ground over a Texas year**. Masking those off is what this layer is
   * for.
   *
   * −12, −18 and −25 °C are **reference isotherms, not gates**, and they are
   * deliberately the numbers this project already argues about: −12 was the
   * seeding band's old cold edge, −18 is its current one. Nothing is discarded
   * for being colder than any of them — the coldest band is open-ended and
   * still drawn, just drawn faintly, because **[verified] 54% of cloudy cells
   * sit below −30 °C** and painting cirrus as loudly as a seedable top would
   * bury the thing the operator is looking for.
   *
   * There is **no cold cutoff**, and that is a decision rather than an
   * omission. A cutoff would be a claim that seeding stops paying below some
   * cloud-top temperature; no version of that claim appears in
   * `SENSING_STRATEGY.md`, and the year-round Texas sample showed every
   * candidate cutoff is expensive (−18 °C keeps 48.7% of seedable ground where
   * this rule keeps 92.7%) and unstable (14.2%–82.7% across days). See
   * `MEASUREMENTS.md` §G, which holds that decision open pending literature.
   */
  levels: [5, 12, 18, 25],
} as const;

/** The warm edge, as a temperature. Mirrors BAND_WARMEST_C in the app. */
export const TOP_WARMEST_C = -CLOUD_TOP.levels[0];

/**
 * Marks a cell the satellite reports as clear.
 *
 * It has to sit below the lowest contour level so nothing is drawn, and it is
 * the property this layer exists for: where GOES sees no cloud, the map draws
 * nothing at all and the basemap shows through. That is what the Band 13
 * imagery this replaced could never do — an infrared image paints warm clear
 * sky opaquely and buries whatever is underneath.
 */
const CLEAR = -999;

/**
 * GOES pixels across one 12 km cell. The ABI pixel is ~2 km at nadir, so six of
 * them span the cell there.
 *
 * Approximate on purpose, and it errs the readable way: a pixel's ground
 * footprint grows away from the sub-satellite point, so over CONUS this window
 * covers somewhat more than 12 km and the block mean is slightly smoother than
 * the grid. Smoothing removes structure; it never invents any, which is the
 * same rule §5 applies to every other block average here.
 */
const WINDOW = 6;

export type CloudTopFrame = {
  type: "FeatureCollection";
  /** Start of the satellite scan, ISO 8601 — not when we fetched it. */
  validTime: string;
  /** HRRR run that supplied the temperatures, ISO 8601. */
  profileRun: string;
  features: ContourFeature[];
};

/**
 * What the sidebar reports. It names both sources, because this layer is a
 * claim built from two and an operator reading "cloud top −14 °C" deserves to
 * know which half of that came from a satellite and which from a model.
 */
export type CloudTopStats = {
  fetchedAt: string;
  validTime: string;
  profileRun: string;
  /** Percent of the 12 km grid the satellite sees any cloud over. */
  cloudPct: number;
  /** Percent of the grid whose cloud top is at or below −5 °C. */
  seedableTopPct: number;
  /** Ground with a seedable top, km^2. */
  seedableKm2: number;
  /** Coldest cloud top on the grid, °C. Null when there is no cloud at all. */
  coldestTopC: number | null;
};

type Scene = { frame: CloudTopFrame; stats: CloudTopStats };

/**
 * The slice of h5wasm this service uses.
 *
 * Declared locally rather than imported: h5wasm is ESM-only and this server is
 * CommonJS, so it is loaded through a dynamic `import()` (see `hdf5()` below)
 * and never appears in a static import position that could be downlevelled to
 * `require()`. Naming the surface we depend on also keeps that surface small
 * and obvious.
 */
type H5Attr = { value: unknown };
type H5Dataset = { shape: number[]; value: ArrayLike<number>; attrs: Record<string, H5Attr> };
type H5File = { get(name: string): H5Dataset; close(): void };
type H5Module = {
  ready: Promise<{ FS: { writeFile(p: string, d: Uint8Array): void; unlink(p: string): void } }>;
  File: new (name: string, mode: string) => H5File;
};

let h5: Promise<H5Module> | null = null;

/**
 * Load h5wasm once, lazily.
 *
 * Lazily because it drags a WebAssembly runtime in with it, and a server whose
 * other five routes never touch HDF5 should not pay for that at boot.
 */
function hdf5(): Promise<H5Module> {
  h5 ??= import("h5wasm/node").then(
    (m) => ((m as { default?: H5Module }).default ?? m) as unknown as H5Module
  );
  return h5;
}

export class CloudTopService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;

  async temperature(): Promise<CloudTopFrame> {
    return (await this.scene()).frame;
  }

  /** The same build's summary. Asking for either warms both. */
  async temperatureStats(): Promise<CloudTopStats> {
    return (await this.scene()).stats;
  }

  private async scene(): Promise<Scene> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
    // The map asks for the frame and the stats at the same moment, and a cold
    // build waits on the HRRR profile. Collapse them onto one.
    if (this.inflight) return this.inflight;

    const work = this.build()
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

  private async build(): Promise<Scene> {
    const key = await this.latestKey();
    // The profile is the slow half on a cold run, and it does not depend on the
    // scene, so the two go together rather than in sequence.
    const [buffer, column] = await Promise.all([
      this.download(key),
      Hrrr.column(ANALYSIS_HOUR),
    ]);

    const { grid, pressure } = await this.decode(buffer);
    const values = this.resample(grid, pressure, column);

    const cells: Grid = {
      nx: column.geo.nx,
      ny: column.geo.ny,
      values,
    };

    const validTime = sceneTime(key);
    const profileRun = column.run.toISOString();

    return {
      frame: {
        type: "FeatureCollection",
        validTime,
        profileRun,
        features: bandFeatures(
          cells,
          column.geo,
          CLOUD_TOP.property,
          CLOUD_TOP.levels
        ),
      },
      stats: summarize(cells, validTime, profileRun),
    };
  }

  /**
   * Newest published scene key.
   *
   * Keys sort lexicographically by their embedded start time, so the last one
   * in the hour's listing is the newest. The walk back covers the hour boundary
   * — at 00:02 UTC the current hour may hold nothing yet — and gives up rather
   * than silently serving something stale.
   */
  private async latestKey(): Promise<string> {
    const now = Date.now();
    for (let back = 0; back < 4; back++) {
      const t = new Date(now - back * 3_600_000);
      const prefix =
        `${PRODUCT}/${t.getUTCFullYear()}/` +
        `${String(dayOfYear(t)).padStart(3, "0")}/` +
        `${String(t.getUTCHours()).padStart(2, "0")}/`;
      const keys = await this.list(prefix);
      if (keys.length) return keys[keys.length - 1];
    }
    throw new Error("No GOES cloud-top scene published in the last 4 hours");
  }

  private async list(prefix: string): Promise<string[]> {
    const res = await fetch(
      `${BUCKET}/?list-type=2&prefix=${encodeURIComponent(prefix)}`
    );
    if (!res.ok) throw new Error(`GOES listing failed: ${res.status}`);
    const xml = await res.text();
    return Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]);
  }

  private async download(key: string): Promise<Buffer> {
    const res = await fetch(`${BUCKET}/${key}`);
    if (!res.ok) throw new Error(`GOES scene fetch failed: ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Read the scene: the projection constants, and cloud-top pressure in hPa
   * with clear pixels left as NaN.
   *
   * Every constant comes out of the file rather than a table in this comment.
   * The scale factor, the fill value and the projection geometry are all
   * attributes GOES publishes per scene, and hardcoding them would be the
   * pixel-archaeology version of the mistake this layer exists to undo.
   */
  private async decode(
    buffer: Buffer
  ): Promise<{ grid: AbiGrid; pressure: Float32Array }> {
    const mod = await hdf5();
    const { FS } = await mod.ready;
    const path = `goes-${Date.now()}-${Math.random().toString(36).slice(2)}.nc`;

    FS.writeFile(path, new Uint8Array(buffer));
    let file: H5File | null = null;
    try {
      file = new mod.File(path, "r");

      const pres = file.get("PRES");
      const proj = file.get("goes_imager_projection");
      const x = file.get("x");
      const y = file.get("y");

      const [ny, nx] = pres.shape;
      const grid = abiGrid({
        lonOriginDeg: scalar(proj, "longitude_of_projection_origin"),
        perspectiveHeight: scalar(proj, "perspective_point_height"),
        semiMajor: scalar(proj, "semi_major_axis"),
        semiMinor: scalar(proj, "semi_minor_axis"),
        sweep: text(proj, "sweep_angle_axis"),
        xScale: scalar(x, "scale_factor"),
        xOffset: scalar(x, "add_offset"),
        yScale: scalar(y, "scale_factor"),
        yOffset: scalar(y, "add_offset"),
        nx,
        ny,
      });

      const fill = scalar(pres, "_FillValue");
      const scale = scalar(pres, "scale_factor");
      const offset = scalar(pres, "add_offset");

      const raw = pres.value;
      const pressure = new Float32Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        // The fill value is what makes this layer honest: a clear pixel carries
        // no pressure, so it becomes NaN and contributes nothing downstream.
        pressure[i] = raw[i] === fill ? NaN : raw[i] * scale + offset;
      }

      return { grid, pressure };
    } finally {
      file?.close();
      FS.unlink(path);
    }
  }

  /**
   * Fold the 2 km scene onto the 12 km grid the other layers are contoured on,
   * and convert each cell's pressure to a temperature.
   *
   * Mapped **grid cell → pixel**, not the other way round. The forward
   * geostationary projection is exact arithmetic, so 118k cells each index
   * straight into the image; going pixel-first would mean searching 3.75M
   * pixels for their nearest cell.
   *
   * **A cell is cloudy only if most of its pixels are.** The alternative — any
   * cloudy pixel makes the cell cloudy — would inflate coverage at 12 km and
   * paint solid cloud over scattered cumulus. A majority needs no tuning
   * constant, and scattered cloud under half a 12 km box is not a target a
   * drone is sent to.
   */
  private resample(
    grid: AbiGrid,
    pressure: Float32Array,
    column: Column
  ): Float32Array {
    const { geo } = column;
    const out = new Float32Array(geo.lats.length).fill(CLEAR);
    const half = Math.floor(WINDOW / 2);

    for (let cell = 0; cell < geo.lats.length; cell++) {
      const at = pixelAt(grid, geo.lats[cell], geo.lons[cell]);
      if (!at) continue;
      const [col, row] = at;

      let cloudy = 0;
      let seen = 0;
      let sum = 0;
      for (let dy = -half; dy < WINDOW - half; dy++) {
        const r = row + dy;
        if (r < 0 || r >= grid.ny) continue;
        for (let dx = -half; dx < WINDOW - half; dx++) {
          const c = col + dx;
          if (c < 0 || c >= grid.nx) continue;
          seen++;
          const mb = pressure[r * grid.nx + c];
          if (Number.isNaN(mb)) continue;
          cloudy++;
          sum += mb;
        }
      }

      if (seen === 0 || cloudy * 2 < seen) continue;

      const topC = column.tempAt(cell, sum / cloudy);
      out[cell] = -topC;
    }

    return out;
  }
}

export const Goes = new CloudTopService();

/** A numeric attribute, which HDF5 hands back as a length-1 typed array. */
function scalar(node: H5Dataset, name: string): number {
  const attr = node.attrs[name];
  if (!attr) throw new Error(`GOES scene has no ${name} attribute`);
  const v = attr.value;
  const n = typeof v === "number" ? v : Number((v as ArrayLike<number>)[0]);
  if (!Number.isFinite(n)) throw new Error(`GOES ${name} is not a number`);
  return n;
}

function text(node: H5Dataset, name: string): string {
  const attr = node.attrs[name];
  if (!attr) throw new Error(`GOES scene has no ${name} attribute`);
  const v = attr.value;
  return String(Array.isArray(v) ? v[0] : v);
}

/**
 * Scan start time from the file name, e.g. `..._s20262250051179_e..._c....nc`
 * -> `2026-08-13T00:51:17.900Z`.
 *
 * The name is the only place the scan time appears without opening the file,
 * and `latestKey` has to compare scenes before downloading one.
 */
export function sceneTime(key: string): string {
  const m = /_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})(\d)/.exec(key);
  if (!m) throw new Error(`Unparseable GOES scene name: ${key}`);
  const [, year, doy, hh, mm, ss, tenths] = m;
  const t = new Date(
    Date.UTC(Number(year), 0, 1, Number(hh), Number(mm), Number(ss), Number(tenths) * 100)
  );
  t.setUTCDate(t.getUTCDate() + Number(doy) - 1);
  return t.toISOString();
}

/** Day of year, 1-based — the directory GOES files are filed under. */
export function dayOfYear(t: Date): number {
  const start = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.floor((t.getTime() - start) / 86_400_000) + 1;
}

/**
 * The sidebar's numbers, against the same 12 km grid the contours are drawn
 * from so the picture and the figures cannot disagree.
 */
export function summarize(
  grid: Grid,
  validTime: string,
  profileRun: string
): CloudTopStats {
  const floor = CLOUD_TOP.levels[0];
  let cloudy = 0;
  let seedable = 0;
  let coldest = -Infinity;

  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (v === CLEAR) continue;
    cloudy++;
    if (v >= floor) seedable++;
    if (v > coldest) coldest = v;
  }

  const total = grid.values.length;
  return {
    fetchedAt: new Date().toISOString(),
    validTime,
    profileRun,
    cloudPct: Math.round((10000 * cloudy) / total) / 100,
    seedableTopPct: Math.round((10000 * seedable) / total) / 100,
    seedableKm2: seedable * CELL_KM2,
    // Stored negated, reported as the temperature an operator reads.
    coldestTopC: cloudy === 0 ? null : Math.round(-coldest * 10) / 10,
  };
}

export type { Geo };
