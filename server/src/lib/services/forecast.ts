// Node
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Services
import { features, polygons } from "./contour";
import { eachMessage } from "./grib";

// Types
import type { Grid, Geo, ContourRing, ContourFeature } from "./contour";

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
  /**
   * The band worth seeding.
   *
   * **Warm edge, −5 °C: a physical threshold.** Silver iodide barely nucleates
   * ice above it, so liquid warmer than this is not seedable with AgI at all.
   *
   * **Cold edge, −18 °C: a judgement, and a deliberately generous one.** AgI
   * keeps working to roughly −20 °C; what falls off below about −12 °C is not
   * the seeding agent but the *supply* — natural ice nuclei activate and take
   * the liquid first, so there is progressively less of it to find. −12 °C is
   * where the literature puts the point of diminishing returns, and this
   * product used it until 2026-08-12. It was tightened deliberately and it cut
   * both ways: it kept the map focused on the richest band, and it also
   * discarded real supercooled liquid at −13 to −18 °C that AgI would convert.
   * Widened on the principle that a tool for *finding* candidates should show
   * what is there and let the operator judge, rather than pre-filter to what is
   * likeliest.
   *
   * Both edges are read by the SLW integral and the sounding, so they move
   * together.
   */
  warmestC: -5,
  coldestC: -18,
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
export const SCOUT_LADDER_MB = [300, 400, 500, 600, 700, 800, 900, 1000];

/**
 * How far the ladder may look, and these bounds are load-bearing: a band that
 * falls outside them is not truncated, it *disappears* — the scout finds no
 * touching level and the service answers "no supercooled liquid water anywhere
 * in the domain", which is a false negative rather than a small error.
 *
 * They are set from the temperature, not from an altitude convention. Measured
 * on a real August analysis, the warmest 12 km cell at 400 mb was **−13.4 °C** —
 * only 1.4 °C of margin against the −12 °C edge of the band, which is thin
 * enough that a hotter airmass could push the band's top above a 400 mb ceiling.
 * 300 mb (~30,000 ft) puts ~10 °C between the band and the ceiling. The floor is
 * HRRR's own lowest level rather than 1000 mb, because in a winter airmass the
 * band reaches the ground and 1000 mb is not the ground.
 */
const SCOUT_MIN_MB = 300;
const SCOUT_MAX_MB = 1000;

/**
 * HRRR's lowest pressure level, below 1000 mb and off the 25 mb ladder.
 *
 * It matters in exactly the case a mid-latitude-winter product cares about most:
 * an orographic snowpack event with supercooled liquid at 950–1013 mb. Skipping
 * it drops the bottom 13 mb of every column.
 */
const SURFACE_MB = 1013.2;

/**
 * The vertical profile behind the point readout: where 0, −5 and −12 °C sit
 * over one spot, in feet.
 *
 * The contours say *where* to fly; this says *how high*, which is the number the
 * drone is actually given (DRONE_DESIGN R2). It reads HRRR rather than a second
 * model on purpose — a sounding from somewhere else would disagree with the
 * amber on screen about where the band is, and an operator cannot act on two
 * answers.
 *
 * 50 mb rather than wrfprs' native 25 mb: 32 records is ~32 s to build, 64
 * would be ~64 s, and temperature is near-linear across a 50 mb layer (~500 m),
 * so interpolating within one costs tens of feet. The whole 300 mb–surface range
 * is read rather than the band window, because the isotherms move hundreds of
 * millibars between seasons — see SCOUT_MIN_MB for the measurement behind those
 * bounds.
 *
 * One build serves every click on that hour — it is a national profile grid,
 * not a point query — so the cost is paid once per run, not per click.
 */
const SOUNDING = {
  minMb: SCOUT_MIN_MB,
  maxMb: SCOUT_MAX_MB,
  stepMb: 50,
  /** Metres to feet: HGT is geopotential metres, operators fly in feet. */
  metresToFeet: 3.28084,
} as const;

/**
 * Ceiling of the grid the profile actually reads, well above the sounding's own.
 *
 * **Build wide, display narrow.** The sounding panel wants 300 mb because that
 * is where a drone's target altitudes live and levels above it are noise on the
 * readout. The cloud-top layer wants far more: **[verified] on a live GOES
 * scene, 47.6% of cloudy 12 km cells had tops above 300 mb** — anvil and cirrus
 * sit at 100–300 mb routinely. Reading only to 300 mb clamped every one of them
 * to the same temperature and piled 52% of the grid into a single −40…−30 °C
 * bin.
 *
 * So the grid is read to 100 mb and each consumer takes the slice it needs. The
 * cost is 8 more records (~8 s on a cold build, once per run) and it is paid by
 * whichever feature asks first.
 */
const PROFILE_MIN_MB = 100;

/** Every level the profile grid holds: 100–1000 by 50, plus HRRR's lowest. */
export const PROFILE_LEVELS: number[] = (() => {
  const out: number[] = [];
  for (let mb = PROFILE_MIN_MB; mb <= SOUNDING.maxMb; mb += SOUNDING.stepMb) {
    out.push(mb);
  }
  // HRRR's lowest level is below 1000 mb and off the ladder; in a winter
  // airmass the band reaches it, so the column has to.
  out.push(SURFACE_MB);
  return out;
})();

/**
 * The levels the *sounding readout* shows: 300–1000 by 50, plus 1013.2.
 *
 * A subset of PROFILE_LEVELS, not a separate fetch. Everything above 300 mb is
 * read into the grid and simply not displayed, so this panel is unchanged by
 * the widening above.
 */
export const SOUNDING_LEVELS: number[] = PROFILE_LEVELS.filter(
  (mb) => mb >= SOUNDING.minMb
);

/** Profile grids are ~12 MB an hour, so only the last few hours are kept. */
const PROFILE_CACHE = 3;

/** HRRR publishes f00-f18 every cycle. */
export const FORECAST_HOURS = 18;

export type ForecastMeta = {
  /** Model run, ISO 8601 (e.g. "2026-07-16T21:00:00.000Z"). */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
};

export type { ContourRing, ContourFeature };

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

/** One level of the point profile, in the units an operator reads. */
export type SoundingLevel = {
  mb: number;
  tempC: number;
  heightFt: number;
};

/**
 * The profile over one point. `lat`/`lon` are the 12 km cell actually sampled,
 * not the click — reporting the click back would imply a precision the grid
 * does not have.
 */
export type Sounding = {
  run: string;
  hour: number;
  validTime: string;
  lat: number;
  lon: number;
  /** Terrain height at that cell, ft. Isotherms below it are underground. */
  surfaceFt: number;
  /** 0 °C, ft MSL. Null when the column never crosses it. */
  freezingFt: number | null;
  /** Warm edge of the seeding band, −5 °C. */
  bandBaseFt: number | null;
  /** Cold edge of the seeding band, −12 °C. */
  bandTopFt: number | null;
  /**
   * Temperature at the bottom and top of the column that was read.
   *
   * These exist so a missing isotherm can be explained rather than reported as
   * "there is nothing here". A null `bandBaseFt` means one of two opposite
   * things — the column is already colder than −5 °C at its base (a real
   * answer: too cold, the band is at or below the ground) or it never gets that
   * cold at all (the band is above the column, i.e. we did not look high
   * enough). Without these two numbers the panel cannot tell them apart, and it
   * printed "no altitude here to seed at" for both.
   */
  baseC: number;
  topC: number;
  /** Every level read, bottom up. Small enough to show, and it is the evidence. */
  levels: SoundingLevel[];
};

/**
 * The 12 km grid plus the one question another service needs to ask of HRRR's
 * profile: how cold is it at this pressure, over this cell.
 */
export type Column = {
  geo: Geo;
  run: Date;
  hour: number;
  /** Temperature in °C at `mb` over grid cell `cell`. */
  tempAt: (cell: number, mb: number) => number;
};

type IdxRow = { name: string; level: string; start: number; end: number };

type Slw = { frame: ContourFrame; stats: SlwStats };

/** Block-averaged temperature and height at each level, for the whole domain. */
type Profile = {
  run: Date;
  hour: number;
  levels: number[];
  tempC: Map<number, Float32Array>;
  heightFt: Map<number, Float32Array>;
  surfaceFt: Float32Array;
};

export class ForecastService {
  private geo: Geo | null = null;
  private runCache: { run: Date; checkedAt: number } | null = null;
  /**
   * Keyed `${runIso}:${field}:${hour}`. A given run+field+hour never changes,
   * so this never expires; evictOldRuns drops it when the run rolls.
   */
  private frames = new Map<string, ContourFrame>();
  private slw = new Map<string, Slw>();
  private profiles = new Map<string, Profile>();
  private inflight = new Map<string, Promise<ContourFrame>>();
  private slwInflight = new Map<string, Promise<Slw>>();
  private profileInflight = new Map<string, Promise<Profile>>();

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
      const res = await fetch(this.idxUrl(run, 0, "wrfsfc"), {
        method: "HEAD",
      });
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

  /**
   * The vertical profile over one point: the altitudes a drone is given.
   *
   * The point is snapped to the 12 km cell the contours are drawn on, so this
   * readout and the amber on the map are answers about the same box.
   */
  async sounding(lat: number, lon: number, hour: number): Promise<Sounding> {
    this.assertPoint(lat, lon);
    const profile = await this.profile(hour);
    const geo = this.geo!;
    const cell = nearestCell(geo, lat, lon);

    // The grid holds levels up to 100 mb for the cloud-top layer; the readout
    // shows only the ones a drone flies in. See PROFILE_LEVELS.
    const levels: SoundingLevel[] = SOUNDING_LEVELS.map((mb) => ({
      mb,
      tempC: profile.tempC.get(levelKey(mb))![cell],
      heightFt: Math.round(profile.heightFt.get(levelKey(mb))![cell]),
    }))
      // Bottom up, so a search for the lowest crossing walks it in order.
      .sort((a, b) => a.heightFt - b.heightFt);

    return {
      run: profile.run.toISOString(),
      hour,
      validTime: new Date(
        profile.run.getTime() + hour * 3_600_000
      ).toISOString(),
      lat: Math.round(geo.lats[cell] * 100) / 100,
      lon: Math.round(geo.lons[cell] * 100) / 100,
      surfaceFt: Math.round(profile.surfaceFt[cell]),
      freezingFt: isothermFt(levels, 0),
      bandBaseFt: isothermFt(levels, SEEDING.warmestC),
      bandTopFt: isothermFt(levels, SEEDING.coldestC),
      baseC: Math.round(levels[0].tempC * 10) / 10,
      topC: Math.round(levels[levels.length - 1].tempC * 10) / 10,
      levels,
    };
  }

  /** The same build's summary. Shares the cache, so asking for either warms both. */
  async liquidStats(hour: number): Promise<SlwStats> {
    return (await this.seeding(hour)).stats;
  }

  /**
   * The 12 km grid and a temperature lookup on it — what another service needs
   * to turn a pressure into a temperature.
   *
   * This exists for the cloud-top layer, which gets its cloud *geometry* from
   * GOES and has no thermodynamics of its own. §5 of `MEASUREMENTS.md` is the
   * reason that split is the right way round: HRRR is trustworthy about the
   * temperature profile and shaky about where the cloud is, so the satellite
   * says where the top is and this says how cold it is there.
   *
   * It hands back the same `geo` every contoured layer here is drawn on, so a
   * cloud-top contour and a supercooled-liquid contour are statements about the
   * same 12 km boxes and can be read against each other.
   */
  async column(hour: number): Promise<Column> {
    const profile = await this.profile(hour);
    return {
      geo: this.geo!,
      run: profile.run,
      hour,
      tempAt: (cell: number, mb: number) =>
        temperatureAtMb(profile.levels, profile.tempC, cell, mb),
    };
  }

  /** The domain-wide profile grid every click on this hour is answered from. */
  private async profile(hour: number): Promise<Profile> {
    this.assertHour(hour);

    const run = await this.latestRun();
    const key = `${run.toISOString()}:profile:${hour}`;

    const cached = this.profiles.get(key);
    if (cached) return cached;

    const running = this.profileInflight.get(key);
    if (running) return running;

    const work = this.buildProfile(run, hour)
      .then((built) => {
        this.profiles.set(key, built);
        // ~12 MB each, so the map is capped rather than left to grow across the
        // 19 forecast hours. Oldest insertion goes first.
        while (this.profiles.size > PROFILE_CACHE) {
          this.profiles.delete(this.profiles.keys().next().value!);
        }
        this.evictOldRuns(run);
        return built;
      })
      .finally(() => this.profileInflight.delete(key));

    this.profileInflight.set(key, work);
    return work;
  }

  /**
   * Read TMP and HGT on the 50 mb ladder, plus the terrain height.
   *
   * Fields are keyed by (name, level) rather than paired by arrival order — the
   * seeding build can rely on TMP preceding CLWMR within a level, but here two
   * fields from two products are being assembled and guessing at the order would
   * silently swap temperature for altitude.
   */
  private async buildProfile(run: Date, hour: number): Promise<Profile> {
    const rows = await this.index(run, hour, "wrfprs");
    const url = this.gribUrl(run, hour, "wrfprs");
    const levels = PROFILE_LEVELS;

    const grib = await this.fetchRanges(
      url,
      levels.flatMap((mb) =>
        ["TMP", "HGT"].map((name) => pick(rows, name, `${mbLabel(mb)} mb`))
      )
    );

    const tempC = new Map<number, Float32Array>();
    const heightFt = new Map<number, Float32Array>();

    await this.eachMessage(grib, (name, level, values) => {
      if (name === "t") {
        // The block mean is linear, so averaging kelvin and subtracting once is
        // the same number as converting 1.9M points first.
        const grid = blockAverage(values, 1);
        for (let i = 0; i < grid.values.length; i++) grid.values[i] -= 273.15;
        tempC.set(levelKey(level), grid.values);
        return;
      }
      if (name === "gh") {
        heightFt.set(
          levelKey(level),
          blockAverage(values, SOUNDING.metresToFeet).values
        );
      }
    });

    for (const mb of levels) {
      if (!tempC.has(levelKey(mb)) || !heightFt.has(levelKey(mb))) {
        throw new Error(`HRRR profile is missing TMP or HGT at ${mb} mb`);
      }
    }

    await this.ensureGeo(grib);

    return {
      run,
      hour,
      levels,
      tempC,
      heightFt,
      surfaceFt: await this.terrain(run, hour),
    };
  }

  /**
   * Terrain height, so the readout can say when an isotherm is underground.
   *
   * HRRR extrapolates its pressure levels below ground rather than leaving them
   * missing, so without this a freezing level in Colorado reads as a real
   * altitude when it is 2,000 ft inside a mountain.
   */
  private async terrain(run: Date, hour: number): Promise<Float32Array> {
    const rows = await this.index(run, hour, "wrfsfc");
    const grib = await this.fetchRanges(this.gribUrl(run, hour, "wrfsfc"), [
      pick(rows, "HGT", "surface"),
    ]);

    let surface: Float32Array | null = null;
    await this.eachMessage(grib, (_name, _level, values) => {
      surface = blockAverage(values, SOUNDING.metresToFeet).values;
    });
    if (!surface) throw new Error("HRRR carried no surface height");
    return surface;
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

  /**
   * The HRRR domain is CONUS, so a point outside it has no profile. Refusing is
   * the honest answer; nearestCell would otherwise happily return an edge cell
   * and report Kansas' sounding for a click on Hawaii.
   */
  private assertPoint(lat: number, lon: number) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      throw new Error("Sounding needs a numeric lat and lon");
    }
    if (lat < 21 || lat > 53 || lon < -135 || lon > -60) {
      throw new Error(`No HRRR data at ${lat}, ${lon} — the domain is CONUS`);
    }
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
    const row = rows.find(
      (r) => r.name === grib.name && r.level === grib.level
    );
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
      headers: {
        Range: `bytes=${ranges.map(([a, b]) => `${a}-${b}`).join(",")}`,
      },
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

  /** One nested MultiPolygon per level, against the grid built by ensureGeo. */
  private features(
    grid: Grid,
    property: string,
    levels: readonly number[]
  ): ContourFeature[] {
    return features(grid, this.geo!, property, levels);
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
   * Stream a multi-message GRIB, one callback per message.
   *
   * The decoding itself lives in ./grib, which the radar service uses too; this
   * only names the keys HRRR is read by and turns the level back into a number.
   */
  private eachMessage(
    grib: Buffer,
    onMessage: (name: string, level: number, values: Float32Array) => void
  ): Promise<void> {
    return eachMessage(
      grib,
      {
        keys: ["shortName", "level"],
        points: POINTS,
        onMessage: ([name, level], values) =>
          onMessage(name, Number(level), values),
      },
      "hrrr-msg"
    );
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

/**
 * Index of the grid cell nearest a point.
 *
 * A plain scan of the 12 km grid — 118k cells, well under a millisecond, and it
 * needs no assumption about how the Lambert projection lays out. Longitude is
 * scaled by cos(lat) so "nearest" means nearest on the ground rather than
 * nearest in degrees, which at 45 N would be 40% wrong east-west.
 */
export function nearestCell(geo: Geo, lat: number, lon: number): number {
  const scale = Math.cos((lat * Math.PI) / 180);
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < geo.lats.length; i++) {
    const dy = geo.lats[i] - lat;
    const dx = (geo.lons[i] - lon) * scale;
    const d = dy * dy + dx * dx;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * Height of an isotherm, interpolated between the two levels that bracket it.
 *
 * `levels` must run bottom up. The **lowest** crossing wins: an inversion can
 * put a column above and below freezing more than once, and the altitude that
 * matters for flying into the band is the first one reached on the way up.
 * Returns null when the column never crosses the temperature at all, which is a
 * real answer — "the whole profile is colder than −12 °C" is not the same as
 * "the band is at zero feet".
 */
export function isothermFt(
  levels: readonly SoundingLevel[],
  targetC: number
): number | null {
  for (let i = 0; i < levels.length - 1; i++) {
    const below = levels[i];
    const above = levels[i + 1];
    // Temperature falls with height, so a crossing is warmer-then-colder.
    if (below.tempC < targetC || above.tempC > targetC) continue;
    const span = below.tempC - above.tempC;
    if (span === 0) return below.heightFt;
    const f = (below.tempC - targetC) / span;
    return Math.round(below.heightFt + f * (above.heightFt - below.heightFt));
  }
  return null;
}

/**
 * Temperature at an arbitrary pressure over one cell, interpolated between the
 * two profile levels that bracket it.
 *
 * **Both ends clamp rather than extrapolate**, and the top one is the case that
 * matters. A cloud top above 300 mb — deep convection — is genuinely colder
 * than the 300 mb air, so returning the 300 mb temperature *understates* how
 * cold that top is. That is the safe direction to be wrong in: it can only move
 * a top toward the warm end of the ramp, never invent a cold one, and a top
 * that high is already past the coldest contour. Extrapolating up a lapse rate
 * we did not read would be the unsafe direction.
 *
 * `levels` must run from low pressure to high, as `SOUNDING_LEVELS` does.
 */
export function temperatureAtMb(
  levels: readonly number[],
  tempC: Map<number, Float32Array>,
  cell: number,
  mb: number
): number {
  const at = (level: number) => tempC.get(levelKey(level))![cell];

  const first = levels[0];
  const last = levels[levels.length - 1];
  if (mb <= first) return at(first);
  if (mb >= last) return at(last);

  let k = 0;
  while (k < levels.length - 2 && levels[k + 1] < mb) k++;
  const lo = levels[k];
  const hi = levels[k + 1];
  const f = (mb - lo) / (hi - lo);
  return at(lo) + f * (at(hi) - at(lo));
}

/**
 * The 25 mb levels from `topMb` down to `baseMb`, inclusive — plus HRRR's
 * lowest level when the window reaches the bottom of the ladder, since that one
 * is 13 mb below 1000 and would otherwise be skipped.
 */
function pressureLevels(topMb: number, baseMb: number): number[] {
  const out: number[] = [];
  for (let mb = topMb; mb <= baseMb; mb += LEVEL_STEP_MB) out.push(mb);
  if (baseMb >= SCOUT_MAX_MB) out.push(SURFACE_MB);
  return out;
}

/** The .idx spells whole millibars without a decimal point. */
const mbLabel = (mb: number) => String(mb);

/**
 * Key a level by whole millibars.
 *
 * The .idx names HRRR's lowest level `1013.2 mb`, but eccodes prints its
 * `level` key as the rounded `1013` — so a map keyed on the raw values misses
 * on exactly the level that was added to reach the winter band, and the build
 * fails with "missing TMP or HGT at 1013.2 mb". The label and the key are
 * different things: `mbLabel` addresses the index, this addresses the decode.
 */
const levelKey = (mb: number) => Math.round(mb);

function frame(
  run: Date,
  hour: number,
  features: ContourFeature[]
): ContourFrame {
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
