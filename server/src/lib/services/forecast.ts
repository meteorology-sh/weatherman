// Node
import { execFile, spawn } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Services
import { polygons } from "./contour";

// Types
import type { Grid, Geo, ContourRing } from "./contour";

const execFileAsync = promisify(execFile);

const HRRR = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod";

/** HRRR CONUS is a fixed Lambert grid; these never change between runs. */
const NX = 1799;
const NY = 1059;
const POINTS = NX * NY;

/** 3 km -> 12 km. Block-averaging removes structure; it never invents it. */
const BLOCK = 4;

/** Ground covered by one block-averaged cell, km^2. */
const CELL_KM2 = (BLOCK * 3) ** 2;

/** `grib_get_data -m` prints this where the record has no value. */
const MISSING = 9999;

/**
 * The two HRRR products we read. `wrfsfc` carries the 2D diagnostics; `wrfprs`
 * carries the 3D fields on 25 mb pressure levels and is ~430 MB, which is why
 * nothing here ever downloads a whole file — only byte ranges named by the .idx.
 */
type Product = "wrfsfc" | "wrfprs";

/**
 * The 2D fields we contour. Each is one record in the wrfsfc GRIB2 file.
 *
 * `levels` are nested — each is a subset of the one below — and must stay in
 * step with the matching BANDS in app/src/lib/arcgis/renderers.ts. The server
 * decides which contours exist; the app decides how each one is painted.
 */
const FIELDS = {
  /**
   * Total cloud cover, percent.
   *
   * No 10% band on purpose: ~65% of the country has at least 10% cloud on a
   * normal day, so it veils the map without telling the operator anything.
   */
  clouds: {
    grib: { name: "TCDC", level: "entire atmosphere" },
    property: "cloudCover",
    scale: 1,
    levels: [30, 50, 70, 90],
    firstHour: 0,
  },
  /**
   * Precipitation rate. GRIB carries kg m-2 s-1, which is mm/s, so x3600 gives
   * the mm/hr an operator reads. Levels are the NWS intensity classes: 0.1
   * trace, 0.5 light, 2.5 moderate (NWS light/moderate boundary), 7.6 heavy.
   *
   * `firstHour: 1` is a fact about HRRR, not a guess. PRATE is a diagnostic the
   * model produces by integrating a timestep forward, and the analysis has not
   * taken one — its PRATE record is 188 bytes (GRIB2's size for a constant
   * field) and decodes to zero at all 1.9M points, on every cycle checked. So
   * f00 has no precipitation to draw and we do not download it.
   */
  precip: {
    grib: { name: "PRATE", level: "surface" },
    property: "precipRate",
    scale: 3600,
    levels: [0.1, 0.5, 2.5, 7.6],
    firstHour: 1,
  },
} as const;

export type FieldId = keyof typeof FIELDS;

type FieldSpec = (typeof FIELDS)[FieldId];

/**
 * Supercooled liquid water path in the seeding band — the question the whole
 * product exists to answer, and the one field here that is derived rather than
 * read.
 *
 * CLWMR (cloud water mixing ratio) is 3D: 40 pressure levels in wrfprs. Drawing
 * it at a single level would be arbitrary, because the -5..-12 C band moves —
 * it sat at 425-525 mb over Texas in July and lives near 700-950 mb in a winter
 * airmass. So we integrate CLWMR over exactly the levels that are in the band
 * at each point:
 *
 *   SLW = sum over levels in band of  q_c * dp / g      [kg/m^2 -> x1000 g/m^2]
 *
 * Unlike PRATE this exists at f00: a mixing ratio is a *state* the analysis
 * holds, not a flux needing a timestep. That is what lets the candidate map show
 * it for "right now".
 */
const SEEDING = {
  property: "slwPath",
  /**
   * g/m^2. Measured against a real analysis rather than chosen for round
   * numbers: >=10 covers 1.73% of CONUS, >=50 0.90%, >=150 ~0.3%, >=400 0.07%.
   * That is the same footprint precipitation has, so the same faint stacked
   * fills keep the basemap readable.
   */
  levels: [10, 50, 150, 400],
  /** The band worth seeding: warmer than this and ice will not nucleate. */
  warmestC: -5,
  coldestC: -12,
} as const;

/** wrfprs carries CLWMR and TMP every 25 mb. */
const LEVEL_STEP_MB = 25;

/** Pressure of one 25 mb layer, in Pa, for the dp/g integral. */
const LAYER_PA = LEVEL_STEP_MB * 100;
const GRAVITY = 9.81;

/**
 * Coarse ladder used to find the seeding band before reading it properly.
 *
 * Every record decoded costs ~1 s regardless of how small it is, so reading all
 * 25 levels of TMP+CLWMR (50 records, ~43 s) to discover that the band occupies
 * five of them is most of the build spent on levels that contribute nothing.
 * Seven TMP records (~7 s) bound the band, and only the levels that can contain
 * it are read at full spacing. Cost is then flat across seasons (~25 s) instead
 * of worst-case always.
 */
const SCOUT_LADDER_MB = [400, 500, 600, 700, 800, 900, 1000];

/** Deepest/highest the ladder can look. Below 1000 mb is mostly below ground. */
const SCOUT_MIN_MB = 400;
const SCOUT_MAX_MB = 1000;

/** HRRR publishes f00-f18 every cycle. */
export const FORECAST_HOURS = 18;

/** Marks each message in a multi-record grib_filter decode. */
const MARKER = "@@@";

export type ForecastMeta = {
  /** Model run, ISO 8601 (e.g. "2026-07-16T21:00:00.000Z"). */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
};

export type { ContourRing };

export type ContourFeature = {
  type: "Feature";
  /** One entry, keyed by the field's `property` and set to the contour level. */
  properties: Record<string, number>;
  geometry: { type: "MultiPolygon"; coordinates: ContourRing[][] };
};

export type ContourFrame = {
  type: "FeatureCollection";
  /** Valid time of this frame, ISO 8601. */
  validTime: string;
  run: string;
  hour: number;
  features: ContourFeature[];
};

/**
 * What the sidebar reports for the supercooled-liquid layer. Deliberately the
 * numbers an operator acts on — is there any, how much, how much ground does it
 * cover, and what altitude is it at — rather than a domain average, which for a
 * field covering ~2% of the country is a number about the other 98%.
 */
export type SlwStats = {
  run: string;
  hour: number;
  validTime: string;
  /** Percent of the HRRR domain at or above the lowest contour. */
  coveragePct: number;
  /** Ground at or above the lowest contour, km^2. */
  seedableKm2: number;
  /** Peak supercooled liquid water path, g/m^2. */
  peak: number;
  /** Pressure window the -5..-12 C band occupied, mb. Null when it is absent. */
  bandTopMb: number | null;
  bandBaseMb: number | null;
};

type IdxRow = { name: string; level: string; start: number; end: number };

type Slw = { frame: ContourFrame; stats: SlwStats };

export class ForecastService {
  private geo: Geo | null = null;
  private runCache: { run: Date; checkedAt: number } | null = null;
  /**
   * Keyed `${runIso}:${field}:${hour}`. A given run+field+hour never changes,
   * so this never expires; evictOldRuns drops it when the run rolls.
   */
  private frames = new Map<string, ContourFrame>();
  private slw = new Map<string, Slw>();
  private inflight = new Map<string, Promise<ContourFrame>>();
  private slwInflight = new Map<string, Promise<Slw>>();

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
      const res = await fetch(this.idxUrl(run, 0, "wrfsfc"), { method: "HEAD" });
      if (res.ok) {
        this.runCache = { run, checkedAt: Date.now() };
        return run;
      }
    }
    throw new Error("No published HRRR run found in the last 6 cycles");
  }

  async meta(): Promise<ForecastMeta> {
    const run = await this.latestRun();
    return {
      run: run.toISOString(),
      hours: Array.from({ length: FORECAST_HOURS + 1 }, (_, i) => i),
    };
  }

  async clouds(hour: number): Promise<ContourFrame> {
    return this.contours("clouds", hour);
  }

  async precip(hour: number): Promise<ContourFrame> {
    return this.contours("precip", hour);
  }

  /** Supercooled liquid water contours for the seeding band. */
  async liquid(hour: number): Promise<ContourFrame> {
    return (await this.seeding(hour)).frame;
  }

  /** The same build's summary. Shares the cache, so asking for either warms both. */
  async liquidStats(hour: number): Promise<SlwStats> {
    return (await this.seeding(hour)).stats;
  }

  private async contours(field: FieldId, hour: number): Promise<ContourFrame> {
    this.assertHour(hour);

    const run = await this.latestRun();
    const spec = FIELDS[field];

    // The model does not diagnose this field yet (see FIELDS.precip.firstHour).
    // Answer honestly with an empty frame rather than downloading a record we
    // already know decodes to zeros.
    if (hour < spec.firstHour) return frame(run, hour, []);

    const key = `${run.toISOString()}:${field}:${hour}`;

    const cached = this.frames.get(key);
    if (cached) return cached;

    // Collapse concurrent requests for the same frame onto one download.
    const running = this.inflight.get(key);
    if (running) return running;

    const work = this.build(run, hour, spec)
      .then((built) => {
        this.frames.set(key, built);
        this.evictOldRuns(run);
        return built;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, work);
    return work;
  }

  private async seeding(hour: number): Promise<Slw> {
    this.assertHour(hour);

    const run = await this.latestRun();
    const key = `${run.toISOString()}:slw:${hour}`;

    const cached = this.slw.get(key);
    if (cached) return cached;

    const running = this.slwInflight.get(key);
    if (running) return running;

    const work = this.buildSeeding(run, hour)
      .then((built) => {
        this.slw.set(key, built);
        this.evictOldRuns(run);
        return built;
      })
      .finally(() => this.slwInflight.delete(key));

    this.slwInflight.set(key, work);
    return work;
  }

  private assertHour(hour: number) {
    if (!Number.isInteger(hour) || hour < 0 || hour > FORECAST_HOURS) {
      throw new Error(`Forecast hour must be an integer 0-${FORECAST_HOURS}`);
    }
  }

  private evictOldRuns(current: Date) {
    const keep = current.toISOString();
    for (const key of this.frames.keys()) {
      if (!key.startsWith(keep)) this.frames.delete(key);
    }
    for (const key of this.slw.keys()) {
      if (!key.startsWith(keep)) this.slw.delete(key);
    }
  }

  private idxUrl(run: Date, hour: number, product: Product) {
    return `${this.gribUrl(run, hour, product)}.idx`;
  }

  private gribUrl(run: Date, hour: number, product: Product) {
    const d = run.toISOString().slice(0, 10).replace(/-/g, "");
    const cc = String(run.getUTCHours()).padStart(2, "0");
    const fh = String(hour).padStart(2, "0");
    return `${HRRR}/hrrr.${d}/conus/hrrr.t${cc}z.${product}f${fh}.grib2`;
  }

  /**
   * The .idx as rows. It lists start offsets only, so a record ends where the
   * next begins and the final record cannot be bounded (end: NaN) — callers that
   * select it must say so rather than requesting an open range on a 430 MB file.
   */
  private async index(
    run: Date,
    hour: number,
    product: Product
  ): Promise<IdxRow[]> {
    const res = await fetch(this.idxUrl(run, hour, product));
    if (!res.ok) {
      throw new Error(`HRRR index unavailable: ${res.status}`);
    }
    const rows = (await res.text())
      .trim()
      .split("\n")
      .map((l) => l.split(":"));
    return rows.map((r, i) => ({
      name: r[3],
      level: r[4],
      start: Number(r[1]),
      end: rows[i + 1] ? Number(rows[i + 1][1]) - 1 : NaN,
    }));
  }

  /** Byte range of one field's record. */
  private async range(
    run: Date,
    hour: number,
    grib: FieldSpec["grib"]
  ): Promise<[number, number]> {
    const rows = await this.index(run, hour, "wrfsfc");
    const row = rows.find((r) => r.name === grib.name && r.level === grib.level);
    if (!row) throw new Error(`${grib.name} not present in HRRR index`);
    if (!Number.isFinite(row.end)) {
      throw new Error(`Could not bound ${grib.name} record`);
    }
    return [row.start, row.end];
  }

  /**
   * Fetch byte ranges and return them concatenated in file order.
   *
   * NOMADS honours multi-range requests, and GRIB2 records are self-contained,
   * so N ranges come back in one round trip and concatenate straight into a
   * valid N-message GRIB2 file. That is what keeps a 50-record read to a single
   * request instead of 50.
   */
  private async fetchRanges(
    url: string,
    ranges: [number, number][]
  ): Promise<Buffer> {
    const res = await fetch(url, {
      headers: { Range: `bytes=${ranges.map(([a, b]) => `${a}-${b}`).join(",")}` },
    });
    if (!res.ok) throw new Error(`HRRR fetch failed: ${res.status}`);
    const body = Buffer.from(await res.arrayBuffer());
    const type = res.headers.get("content-type") ?? "";
    // A single range comes back raw; several come back multipart.
    return type.toLowerCase().startsWith("multipart/")
      ? concatParts(body, type)
      : body;
  }

  private async build(
    run: Date,
    hour: number,
    spec: FieldSpec
  ): Promise<ContourFrame> {
    const [start, end] = await this.range(run, hour, spec.grib);
    const grib = await this.fetchRanges(this.gribUrl(run, hour, "wrfsfc"), [
      [start, end],
    ]);

    const { grid, geo } = await this.decode(grib, spec);
    if (!this.geo) this.geo = geo;

    return frame(run, hour, this.features(grid, spec.property, spec.levels));
  }

  /** One nested MultiPolygon per level, dropping levels nothing reaches. */
  private features(
    grid: Grid,
    property: string,
    levels: readonly number[]
  ): ContourFeature[] {
    return levels
      .map((level) => ({
        type: "Feature" as const,
        properties: { [property]: level },
        geometry: {
          type: "MultiPolygon" as const,
          coordinates: polygons(grid, this.geo!, level),
        },
      }))
      .filter((f) => f.geometry.coordinates.length > 0);
  }

  /**
   * eccodes reads the Lambert grid and hands back lat/lon per point, so we
   * never do projection maths ourselves. Values are block-averaged to 12 km on
   * the fly — the full 3 km grid is 1.9M points and we don't need that
   * resolution for a national overview.
   */
  private async decode(
    grib: Buffer,
    spec: FieldSpec
  ): Promise<{ grid: Grid; geo: Geo }> {
    const dir = await mkdtemp(join(tmpdir(), "hrrr-"));
    const file = join(dir, `${spec.grib.name.toLowerCase()}.grib2`);
    try {
      await writeFile(file, grib);
      const { stdout } = await execFileAsync(
        "grib_get_data",
        ["-m", String(MISSING), file],
        { maxBuffer: 256 * 1024 * 1024 }
      );
      return accumulate(stdout, spec.scale);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * Integrate CLWMR over the -5..-12 C band and contour the result.
   *
   * Two passes on purpose — see SCOUT_LADDER_MB. The scout only chooses which
   * levels to read; TMP at those levels still decides band membership per point,
   * so nothing here depends on a lapse-rate assumption.
   */
  private async buildSeeding(run: Date, hour: number): Promise<Slw> {
    const rows = await this.index(run, hour, "wrfprs");
    const url = this.gribUrl(run, hour, "wrfprs");

    const window = await this.scout(rows, url);
    if (!window) {
      // No point in the domain is between -5 and -12 C at any level.
      return {
        frame: frame(run, hour, []),
        stats: emptyStats(run, hour),
      };
    }

    const levels = pressureLevels(window.topMb, window.baseMb);
    const wanted = levels.flatMap((mb) =>
      ["TMP", "CLWMR"].map((name) => pick(rows, name, `${mbLabel(mb)} mb`))
    );
    const grib = await this.fetchRanges(url, wanted);

    // kg/m^2 at the native 3 km grid; block-averaged to 12 km after.
    const path = new Float32Array(POINTS);
    let temps: Float32Array | null = null;
    let topMb: number | null = null;
    let baseMb: number | null = null;

    await this.eachMessage(grib, (name, level, values) => {
      if (name === "t") {
        temps = values;
        return;
      }
      // wrfprs orders each level's records TMP before CLWMR, so `temps` is this
      // level's temperature. Refuse to guess if that ever stops holding.
      if (!temps) {
        throw new Error(`CLWMR at ${level} mb arrived before its temperature`);
      }
      const t = temps;
      let inBand = false;
      for (let i = 0; i < POINTS; i++) {
        const q = values[i];
        if (q <= 0) continue;
        const celsius = t[i] - 273.15;
        if (celsius < SEEDING.coldestC || celsius > SEEDING.warmestC) continue;
        path[i] += (q * LAYER_PA) / GRAVITY;
        inBand = true;
      }
      if (inBand) {
        topMb = topMb === null ? level : Math.min(topMb, level);
        baseMb = baseMb === null ? level : Math.max(baseMb, level);
      }
      temps = null;
    });

    // kg/m^2 -> g/m^2, which is the unit the seeding literature uses and the
    // one the contour levels are expressed in.
    const grid = blockAverage(path, 1000);
    await this.ensureGeo(grib);

    return {
      frame: frame(
        run,
        hour,
        this.features(grid, SEEDING.property, SEEDING.levels)
      ),
      stats: stats(run, hour, grid, topMb, baseMb),
    };
  }

  /**
   * Bound the seeding band with a coarse TMP ladder. Returns the pressure window
   * that can contain it, or null when nothing in the domain is in the band.
   *
   * A level can only hold in-band points if its temperature range across the
   * domain overlaps -5..-12 C, so min/max per ladder level is enough to bracket
   * it. The window is padded a full ladder step because the band can sit
   * entirely between two rungs.
   */
  private async scout(
    rows: IdxRow[],
    url: string
  ): Promise<{ topMb: number; baseMb: number } | null> {
    const grib = await this.fetchRanges(
      url,
      SCOUT_LADDER_MB.map((mb) => pick(rows, "TMP", `${mb} mb`))
    );

    const seen: { mb: number; min: number; max: number }[] = [];
    await this.eachMessage(grib, (_name, level, values) => {
      let min = Infinity;
      let max = -Infinity;
      for (let i = 0; i < POINTS; i++) {
        const c = values[i] - 273.15;
        if (c < min) min = c;
        if (c > max) max = c;
      }
      seen.push({ mb: level, min, max });
    });
    seen.sort((a, b) => a.mb - b.mb);

    const touching = seen.filter(
      (s) => s.max >= SEEDING.coldestC && s.min <= SEEDING.warmestC
    );
    if (touching.length === 0) return null;

    const step = SCOUT_LADDER_MB[1] - SCOUT_LADDER_MB[0];
    return {
      topMb: Math.max(SCOUT_MIN_MB, touching[0].mb - step),
      baseMb: Math.min(SCOUT_MAX_MB, touching[touching.length - 1].mb + step),
    };
  }

  /**
   * The 12 km lat/lon grid, built once from any HRRR record and reused for
   * every field and run — the Lambert grid is fixed. Only this path pays for
   * grib_get_data's geo iterator; values are read with grib_filter, which is
   * ~3x faster because it skips it.
   */
  private async ensureGeo(grib: Buffer) {
    if (this.geo) return;
    const dir = await mkdtemp(join(tmpdir(), "hrrr-geo-"));
    const file = join(dir, "geo.grib2");
    try {
      await writeFile(file, grib);
      // One message is enough, and every message shares the grid.
      const { stdout } = await execFileAsync(
        "grib_get_data",
        ["-m", String(MISSING), "-w", "count=1", file],
        { maxBuffer: 256 * 1024 * 1024 }
      );
      this.geo = accumulate(stdout, 1).geo;
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  /**
   * Stream a multi-message GRIB through grib_filter, one callback per message.
   *
   * grib_filter prints the values array alone. grib_get_data would print a
   * lat/lon for every point of every message — ~68 MB and ~2.5 s each, against
   * ~4 MB and ~0.7 s here — and we already hold the grid. Streaming rather than
   * buffering keeps a 50-record read flat in memory instead of gigabytes.
   */
  private async eachMessage(
    grib: Buffer,
    onMessage: (name: string, level: number, values: Float32Array) => void
  ): Promise<void> {
    const dir = await mkdtemp(join(tmpdir(), "hrrr-msg-"));
    const file = join(dir, "stack.grib2");
    const rules = join(dir, "values.filter");
    try {
      await writeFile(file, grib);
      await writeFile(
        rules,
        `print "${MARKER} [shortName] [level]";\nprint "[values]";\n`
      );
      await streamValues(rules, file, onMessage);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }
}

/** Byte range of a named record, or a clear failure naming what is missing. */
function pick(rows: IdxRow[], name: string, level: string): [number, number] {
  const row = rows.find((r) => r.name === name && r.level === level);
  if (!row) throw new Error(`${name} at ${level} not present in HRRR index`);
  if (!Number.isFinite(row.end)) {
    throw new Error(`Could not bound ${name} at ${level}`);
  }
  return [row.start, row.end];
}

/** The 25 mb levels from `topMb` down to `baseMb`, inclusive. */
function pressureLevels(topMb: number, baseMb: number): number[] {
  const out: number[] = [];
  for (let mb = topMb; mb <= baseMb; mb += LEVEL_STEP_MB) out.push(mb);
  return out;
}

/** The .idx spells whole millibars without a decimal point. */
const mbLabel = (mb: number) => String(mb);

function frame(run: Date, hour: number, features: ContourFeature[]): ContourFrame {
  return {
    type: "FeatureCollection",
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    features,
  };
}

function emptyStats(run: Date, hour: number): SlwStats {
  return {
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    coveragePct: 0,
    seedableKm2: 0,
    peak: 0,
    bandTopMb: null,
    bandBaseMb: null,
  };
}

function stats(
  run: Date,
  hour: number,
  grid: Grid,
  bandTopMb: number | null,
  bandBaseMb: number | null
): SlwStats {
  const floor = SEEDING.levels[0];
  let seedable = 0;
  let peak = 0;
  for (let i = 0; i < grid.values.length; i++) {
    const v = grid.values[i];
    if (v >= floor) seedable++;
    if (v > peak) peak = v;
  }
  const total = grid.values.length;
  return {
    run: run.toISOString(),
    hour,
    validTime: new Date(run.getTime() + hour * 3_600_000).toISOString(),
    // Reported against the same 12 km grid the contours are drawn from, so the
    // number and the picture cannot disagree.
    coveragePct: Math.round((10000 * seedable) / total) / 100,
    seedableKm2: seedable * CELL_KM2,
    peak: Math.round(peak),
    bandTopMb,
    bandBaseMb,
  };
}

/**
 * Concatenate the parts of a multipart/byteranges body in file order.
 *
 * Ordering is explicit rather than assumed: GRIB2 messages are self-contained,
 * but the caller pairs TMP with the CLWMR that follows it, and that pairing is
 * only sound if the parts land in the order the file stores them.
 */
export function concatParts(body: Buffer, contentType: string): Buffer {
  const found = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!found) throw new Error("multipart response without a boundary");
  const boundary = Buffer.from(`--${(found[1] ?? found[2]).trim()}`);

  const parts: { offset: number; data: Buffer }[] = [];
  let pos = body.indexOf(boundary);
  while (pos >= 0) {
    const headEnd = body.indexOf("\r\n\r\n", pos);
    if (headEnd < 0) break;
    const head = body.toString("latin1", pos, headEnd);
    const next = body.indexOf(boundary, headEnd);
    let stop = next < 0 ? body.length : next;
    // The CRLF before the next boundary belongs to the framing, not the record.
    if (body[stop - 2] === 0x0d && body[stop - 1] === 0x0a) stop -= 2;

    const range = /Content-Range:\s*bytes\s+(\d+)-/i.exec(head);
    if (range) {
      parts.push({
        offset: Number(range[1]),
        data: body.subarray(headEnd + 4, stop),
      });
    }
    if (next < 0) break;
    pos = next;
  }
  if (parts.length === 0) throw new Error("multipart response had no parts");

  parts.sort((a, b) => a.offset - b.offset);
  return Buffer.concat(parts.map((p) => p.data));
}

/** Spawn grib_filter and hand back one Float32Array per message, streaming. */
function streamValues(
  rules: string,
  file: string,
  onMessage: (name: string, level: number, values: Float32Array) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("grib_filter", [rules, file]);
    let name = "";
    let level = 0;
    let values: Float32Array | null = null;
    let count = 0;
    let carry = "";
    let failed: Error | null = null;

    const flush = () => {
      if (!values) return;
      if (count !== POINTS) {
        failed ??= new Error(
          `${name} at ${level} mb decoded ${count} values, expected ${POINTS}`
        );
      }
      onMessage(name, level, values);
      values = null;
    };

    const line = (text: string) => {
      if (text.startsWith(MARKER)) {
        flush();
        const parts = text.split(" ");
        name = parts[1];
        level = Number(parts[2]);
        values = new Float32Array(POINTS);
        count = 0;
        return;
      }
      if (!values) return;
      let p = 0;
      while (p < text.length) {
        let q = text.indexOf(" ", p);
        if (q < 0) q = text.length;
        if (q > p && count < POINTS) values[count++] = Number(text.slice(p, q));
        p = q + 1;
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const text = carry + chunk;
      const end = text.lastIndexOf("\n");
      if (end < 0) {
        carry = text;
        return;
      }
      carry = text.slice(end + 1);
      for (const l of text.slice(0, end).split("\n")) if (l) line(l);
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => {
      stderr += c;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (carry) line(carry);
      flush();
      if (code !== 0) {
        return reject(
          new Error(`grib_filter exited ${code}: ${stderr.trim().slice(0, 200)}`)
        );
      }
      if (failed) return reject(failed);
      resolve();
    });
  });
}

/**
 * Block-average a full-resolution field to the 12 km contour grid.
 *
 * Mean rather than max on purpose. Precipitation is the awkward case: it covers
 * ~2% of the domain, so a lone 3 km core is diluted 16x by a mean, and a max
 * would keep its peak. Measured against the 3 km truth for a real f12 frame,
 * the mean conserves total water to 0.3% and overstates the >=7.6 mm/hr area by
 * 10%, while the max inflates that area 3.6x and total water 3.7x. The crushed
 * peak (235 -> 72 mm/hr) costs nothing because the top contour is 7.6 and both
 * agree the cell is heavy.
 */
export function blockAverage(
  values: Float32Array,
  scale: number,
  nx = NX,
  ny = NY
): Grid {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const out = new Float32Array(ox * oy);

  for (let bj = 0; bj < oy; bj++) {
    for (let bi = 0; bi < ox; bi++) {
      let sum = 0;
      for (let dj = 0; dj < BLOCK; dj++) {
        const row = (bj * BLOCK + dj) * nx + bi * BLOCK;
        for (let di = 0; di < BLOCK; di++) sum += values[row + di];
      }
      out[bj * ox + bi] = (sum / (BLOCK * BLOCK)) * scale;
    }
  }
  return { nx: ox, ny: oy, values: out };
}

/**
 * Parse `grib_get_data` output ("lat lon value" per line, row-major) directly
 * into block averages, so the 1.9M-point grid is never held in memory. `scale`
 * converts the GRIB units to the units we contour in, and is applied to the
 * block mean rather than each point — the mean is linear, so it is the same
 * number for a sixteenth of the multiplies. See blockAverage for why the mean.
 * `nx`/`ny` are parameters so this is testable on a grid you can read.
 */
export function accumulate(
  text: string,
  scale: number,
  nx = NX,
  ny = NY
): { grid: Grid; geo: Geo } {
  const ox = Math.floor(nx / BLOCK);
  const oy = Math.floor(ny / BLOCK);
  const n = ox * oy;
  const sv = new Float64Array(n);
  const sla = new Float64Array(n);
  const slo = new Float64Array(n);
  /** Points in the block — every row has a lat/lon, even a missing one. */
  const cnt = new Uint16Array(n);
  /** Points in the block with a real value. Only these may divide `sv`. */
  const vcnt = new Uint16Array(n);

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

    const row = Math.floor(i / nx);
    const col = i % nx;
    i++;

    const bj = Math.floor(row / BLOCK);
    const bi = Math.floor(col / BLOCK);
    if (bj >= oy || bi >= ox) continue;

    const o = bj * ox + bi;

    // The location is good even where the value is not, so the geo grid takes
    // every row. Dropping a whole row here would drag the block's centroid.
    sla[o] += Number(parts[0]);
    let lon = Number(parts[1]);
    if (lon > 180) lon -= 360;
    slo[o] += lon;
    cnt[o]++;

    const value = Number(parts[2]);
    // MISSING is what we asked grib_get_data to print for absent values, so it
    // must be dropped rather than averaged in — it is finite, and 9999 would
    // read as permanent overcast or a cloudburst. Neither field currently has
    // any, so this guards the contract rather than a live failure.
    if (!Number.isFinite(value) || value === MISSING) continue;

    sv[o] += value;
    vcnt[o]++;
  }

  const values = new Float32Array(n);
  const lats = new Float32Array(n);
  const lons = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const c = cnt[k] || 1;
    lats[k] = sla[k] / c;
    lons[k] = slo[k] / c;
    // A block with no readings at all contours as 0, which draws nothing —
    // the honest answer for nodata, and the reason these are vectors.
    values[k] = vcnt[k] ? (sv[k] / vcnt[k]) * scale : 0;
  }

  return {
    grid: { nx: ox, ny: oy, values },
    geo: { nx: ox, ny: oy, lats, lons },
  };
}

export { polygons };
export type { Grid, Geo };

export const Hrrr = new ForecastService();
