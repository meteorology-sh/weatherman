/**
 * HRRR: the model layers, their summaries, and the point sounding.
 *
 * The service itself — what each field means, which builds are cached and for
 * how long, and how a frame is assembled. The machinery it stands on lives
 * next door and is readable without this: `bytes.ts` fetches them, `slw.ts`
 * integrates the seeding band, `profile.ts` turns temperatures into altitudes,
 * `diagnostics.ts` holds the 2D `wrfsfc` fields, and `shared/grid.ts` and
 * `shared/contour.ts` hold the 3 km grid and trace it.
 */

// Node
import { execFile } from "child_process";
import { promisify } from "util";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Services
import {
  bandFeatures,
  features,
  frame,
  polygons,
  smoothFor,
  styleFor,
} from "../shared/contour";
import { eachMessage } from "../shared/grib";
import {
  RunDiscovery,
  assertAt,
  eachHrrrMessage,
  fetchRanges,
  floorHour,
  gribUrl,
  index,
  pick,
} from "./bytes";
import { SEEDING, buildSlw } from "./slw";
import {
  MISSING,
  POINTS,
  accumulate,
  assertInDomain,
  inGrid,
  cellAt,
  OutsideDomain,
  perimeter,
  scaleField,
  DRAWN,
  prepareDraw,
} from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import {
  METERS_TO_FEET,
  PROFILE_LEVELS,
  SOUNDING_LEVELS,
  isothermFieldFt,
  isothermFt,
  levelKey,
  mbLabel,
  pressureLevels,
  temperatureAtMb,
} from "./profile";
import {
  CLOUD_BASE,
  DIAGNOSTICS,
  SFC_MISSING,
  baseStats,
  diagnostics,
  recordsAt,
} from "./diagnostics";
import { cclFt } from "./ccl";
import { windowValues } from "./basewindow";
import {
  BRIEFING_COLD_C,
  CAPE,
  CIN,
  FREEZING,
  LCL,
  MINUS15,
  WARM_DEPTH,
  cinMagnitude,
  isBriefingField,
  warmCloudDepthValues,
} from "./briefing";
import type { BriefingField } from "./briefing";

// Types
import type {
  Grid,
  Geo,
  ContourFrame,
  ContourRing,
  ContourFeature,
} from "../shared/contour";
import type { Cycle, Product } from "./bytes";
import type { Slw, SlwStats } from "./slw";
import type { ProfileGrid, SoundingLevel } from "./profile";
import type {
  CloudBaseStats,
  DiagnosticId,
  Diagnostics,
  Fields,
} from "./diagnostics";

const execFileAsync = promisify(execFile);

/**
 * How many replayed builds to keep.
 *
 * Live frames are evicted when the run rolls, which is the right policy for a
 * feed that moves. A replayed run never rolls, so its entries would otherwise
 * live forever and a long session walking a season would grow without bound.
 */
const ARCHIVE_CACHE = 8;

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

/** Profile grids are ~300 MB each at 3 km, so only the last few hours are kept. */
const PROFILE_CACHE = 3;

/**
 * Diagnostic grids are ~70 MB an hour — nine 3 km fields plus the banded
 * frame — so the same policy applies.
 */
const SURFACE_CACHE = 3;

/** HRRR publishes f00-f18 every cycle. */
export const FORECAST_HOURS = 18;

export type ForecastMeta = {
  /** Model run, ISO 8601 (e.g. "2026-07-16T21:00:00.000Z"). */
  run: string;
  /** Forecast hours available from that run. */
  hours: number[];
};

// The wire shapes the routers answer with. Declared where they are built —
// a contoured frame by the contourer, the seeding summary by the seeding
// band's own module — and re-exported here, because this is the service the
// routers and the app's types.ts are written against.
export type { ContourRing, ContourFeature, ContourFrame };
export type { SlwStats };
export { SEEDING };

/**
 * The profile over one point. `lat`/`lon` are the 3 km cell actually sampled,
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
  /** Cold edge of the seeding band, −18 °C. */
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
  /**
   * The 2D diagnostics over the same cell.
   *
   * They ride on this response rather than on a route of their own because they
   * answer the same click. Two routes would mean two round trips for one point
   * and, on an hour boundary, two different cells.
   */
  diagnostics: Diagnostics;
};

/**
 * The 3 km grid plus the one question another service needs to ask of HRRR's
 * profile: how cold is it at this pressure, over this cell.
 */
export type Column = {
  geo: Geo;
  run: Date;
  hour: number;
  /** Temperature in °C at `mb` over grid cell `cell`. */
  tempAt: (cell: number, mb: number) => number;
};

/**
 * A field on the 3 km grid, with the run it came from.
 *
 * What a join across layers reads. Each of these is a by-product of a build
 * that already runs for a layer of its own — the grid the contours were traced
 * from, before they were traced — so joining costs an array pass rather than a
 * second download.
 */
export type Field = {
  run: Date;
  hour: number;
  geo: Geo;
  values: Float32Array;
};

/**
 * One hour's `wrfsfc` diagnostics: every field on the 3 km grid, plus the
 * cloud-base layer built from one of them.
 *
 * **One build, several answers.** All nine records come out of one file, one
 * index read and one ranged fetch, and both consumers — the cloud-base contours
 * and the point readout — are on the same page at the same hour. Splitting them
 * would mean two index reads and two downloads of the same file to answer one
 * click.
 */
type CachedField = {
  run: Date;
  hour: number;
  grid: Grid;
  property: string;
  levels: readonly number[];
};

type Surface = {
  run: Date;
  hour: number;
  /** Absent for a field the hour does not carry — see `lightning`'s firstHour. */
  fields: Fields;
  base: { grid: Grid; stats: CloudBaseStats };
};

/** The domain-wide profile grid, plus the terrain it stands on. */
type Profile = ProfileGrid & {
  run: Date;
  hour: number;
  levels: number[];
  surfaceFt: Float32Array;
};

/**
 * The model's own edge, ready for a GeoJSON layer to draw.
 *
 * A FeatureCollection of one polygon so it goes on the map like every other
 * layer here, and carries no run or valid time because the grid is the same
 * shape for every run — a timestamp on it would invite the reader to wonder
 * which hour the edge belongs to.
 */
export type DomainFrame = {
  type: "FeatureCollection";
  features: [
    {
      type: "Feature";
      properties: Record<string, never>;
      geometry: { type: "Polygon"; coordinates: [[number, number][]] };
    },
  ];
};

export class ForecastService {
  private geo: Geo | null = null;
  /** The grid never changes between runs, so its edge is built once. */
  private domainFrame: DomainFrame | null = null;
  private runs = new RunDiscovery();
  /**
   * Keyed `${runIso}:${field}:${hour}`. The **grid**, not the contours — a
   * given run+field+hour never changes, and the map crops a window of it per
   * request. evictOldRuns drops it when the run rolls.
   */
  private frames = new Map<string, CachedField>();
  private slw = new Map<string, Slw>();
  private profiles = new Map<string, Profile>();
  private surfaces = new Map<string, Surface>();
  private inflight = new Map<string, Promise<CachedField>>();
  private slwInflight = new Map<string, Promise<Slw>>();
  private profileInflight = new Map<string, Promise<Profile>>();
  private surfaceInflight = new Map<string, Promise<Surface>>();

  /** Most recent cycle whose f00 index is published. */
  latestRun(): Promise<Date> {
    return this.runs.latest();
  }

  /**
   * Resolve which cycle to read, and from where.
   *
   * `at` names the **run**, not the valid time: a replayed request asks for the
   * cycle initialized at that hour, and `hour` still selects f00–f18 within it,
   * exactly as the live map does. Absent `at` is the live path and behaves
   * identically to before this existed.
   */
  private async cycle(at?: Date): Promise<Cycle> {
    if (!at) return { run: await this.latestRun(), origin: "nomads" };
    assertAt(at);
    return { run: floorHour(at), origin: "archive" };
  }

  async meta(at?: Date): Promise<ForecastMeta> {
    const { run } = await this.cycle(at);
    return {
      run: run.toISOString(),
      hours: Array.from({ length: FORECAST_HOURS + 1 }, (_, i) => i),
    };
  }

  async clouds(
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    return this.contours("clouds", hour, at, box, fine);
  }

  async precip(
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    return this.contours("precip", hour, at, box, fine);
  }

  /** Supercooled liquid water contours for the seeding band. */
  async liquid(
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    const built = await this.seeding(hour, at);
    if (!built.grid || !this.geo) return built.frame;
    return frame(
      new Date(built.frame.run),
      hour,
      this.features(
        built.grid,
        SEEDING.property,
        SEEDING.levels,
        box,
        false,
        fine
      )
    );
  }

  /** The same build's summary. Shares the cache, so asking for either warms both. */
  async liquidStats(hour: number, at?: Date): Promise<SlwStats> {
    return (await this.seeding(hour, at)).stats;
  }

  /**
   * Cloud base, banded — the selection variable Texas practice uses.
   *
   * A height above the sea, drawn everywhere the model has a deck. The
   * 12,000 ft AGL seeding criterion is not applied here: it is a test the
   * candidate join runs, and {@link cloudBaseWindow} serves it on its own
   * for the evaluation harness.
   */
  async cloudBase(
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    const built = await this.surface(hour, at);
    return frame(
      built.run,
      hour,
      this.features(
        built.base.grid,
        CLOUD_BASE.property,
        CLOUD_BASE.edges,
        box,
        true,
        fine
      )
    );
  }

  /** The same build's summary. Asking for either warms both. */
  async cloudBaseStats(hour: number, at?: Date): Promise<CloudBaseStats> {
    return (await this.surface(hour, at)).base.stats;
  }

  /**
   * The criterion on its own: 1 where the base sits under 12,000 ft above
   * the ground and nothing elsewhere. What the evaluation harness scores.
   */
  async cloudBaseWindow(
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    const built = await this.surface(hour, at);
    const cycle = await this.cycle(at);
    const surfaceFt = await this.terrain(cycle, hour);
    const values = windowValues(built.base.grid.values, surfaceFt);
    return frame(
      built.run,
      hour,
      this.features(
        { nx: built.base.grid.nx, ny: built.base.grid.ny, values },
        "inWindow",
        [1],
        box,
        false,
        fine,
        false
      )
    );
  }

  /**
   * One 12Z briefing field, banded. Mixed-layer CAPE, CIN, LCL, freezing
   * level, −15 °C, or warm-cloud depth. Cloud base is its own route.
   */
  async briefing(
    field: BriefingField,
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    this.assertHour(hour);
    if (!isBriefingField(field)) {
      throw new Error(`No briefing field ${field}`);
    }

    if (field === "cape" || field === "cin" || field === "lcl") {
      const built = await this.surface(hour, at);
      const spec = field === "cape" ? CAPE : field === "cin" ? CIN : LCL;
      const raw =
        field === "cape"
          ? built.fields.get("mixedCape")
          : field === "cin"
            ? built.fields.get("cin")
            : built.fields.get("lcl");
      if (!raw) throw new Error(`HRRR carried no ${spec.property}`);
      const values = field === "cin" ? cinMagnitude(raw) : raw;
      return frame(
        built.run,
        hour,
        this.features(
          { nx: built.base.grid.nx, ny: built.base.grid.ny, values },
          spec.property,
          spec.edges,
          box,
          true,
          fine
        )
      );
    }

    const band = await this.bandField(hour, at);
    if (field === "freezing") {
      return frame(
        band.run,
        hour,
        this.features(
          { nx: this.geo!.nx, ny: this.geo!.ny, values: band.freezingFt },
          FREEZING.property,
          FREEZING.edges,
          box,
          true,
          fine
        )
      );
    }

    if (field === "minus15") {
      const profile = await this.profile(hour, at);
      const values = isothermFieldFt(profile, BRIEFING_COLD_C);
      return frame(
        profile.run,
        hour,
        this.features(
          { nx: this.geo!.nx, ny: this.geo!.ny, values },
          MINUS15.property,
          MINUS15.edges,
          box,
          true,
          fine
        )
      );
    }

    const built = await this.surface(hour, at);
    const values = warmCloudDepthValues(
      band.freezingFt,
      built.base.grid.values
    );
    return frame(
      built.run,
      hour,
      this.features(
        { nx: built.base.grid.nx, ny: built.base.grid.ny, values },
        WARM_DEPTH.property,
        WARM_DEPTH.edges,
        box,
        true,
        fine
      )
    );
  }

  /**
   * The supercooled-liquid grid the contours were traced from.
   *
   * The three accessors below exist for the candidate service, and they hand
   * back **the grid, not the geometry**. Contours are the last step of each
   * build; joining polygons back together would mean intersecting thousands of
   * rings to recover a per-cell answer the build already had. So the join reads
   * the same arrays and runs its own contour pass once, at the end.
   *
   * `values` is null where the domain holds no seeding band at all — the one
   * case that produces no grid rather than an empty one.
   */
  async liquidField(
    hour: number,
    at?: Date
  ): Promise<Omit<Field, "values"> & { values: Float32Array | null }> {
    const built = await this.seeding(hour, at);
    return {
      run: new Date(built.frame.run),
      hour,
      geo: this.geo!,
      values: built.grid?.values ?? null,
    };
  }

  /** One `wrfsfc` diagnostic on the same grid — cloud base, CAPE, VIL and the rest. */
  async diagnosticField(
    id: DiagnosticId,
    hour: number,
    at?: Date
  ): Promise<Omit<Field, "values"> & { values: Float32Array | undefined }> {
    const built = await this.surface(hour, at);
    return {
      run: built.run,
      hour,
      geo: this.geo!,
      values: built.fields.get(id),
    };
  }

  /**
   * Where the seeding band's two edges sit over every cell, ft MSL.
   *
   * NaN where the column never crosses that temperature, which is a real answer
   * rather than a gap: a profile that never reaches −18 °C has no cold edge, and
   * the cell has no band top rather than one at zero feet.
   */
  async bandField(
    hour: number,
    at?: Date
  ): Promise<{
    run: Date;
    hour: number;
    geo: Geo;
    baseFt: Float32Array;
    topFt: Float32Array;
    /** 0 °C, ft MSL. NaN where the column never crosses freezing. */
    freezingFt: Float32Array;
    /** Terrain, ft MSL. The Texas window is applied in AGL. */
    surfaceFt: Float32Array;
  }> {
    const profile = await this.profile(hour, at);
    return {
      run: profile.run,
      hour,
      geo: this.geo!,
      baseFt: isothermFieldFt(profile, SEEDING.warmestC),
      topFt: isothermFieldFt(profile, SEEDING.coldestC),
      freezingFt: isothermFieldFt(profile, 0),
      surfaceFt: profile.surfaceFt,
    };
  }

  /**
   * The convective condensation level over every cell, ft MSL.
   *
   * Two builds off two products — the pressure-level profile and the surface
   * moisture — so the first caller pays for the slower rather than for the sum.
   * `ccl.ts` carries the arithmetic and the validation behind it.
   *
   * This is a height and not a cloud. It exists over clear ground, so a caller
   * that draws it has to establish separately that there is a cloud there.
   */
  async cclField(hour: number, at?: Date): Promise<Field> {
    const [profile, surface] = await Promise.all([
      this.profile(hour, at),
      this.surface(hour, at),
    ]);
    return {
      run: profile.run,
      hour,
      geo: this.geo!,
      values: cclFt(profile, surface.fields.get("spfh2m")!),
    };
  }

  /**
   * The vertical profile over one point: the altitudes a drone is given.
   *
   * The point is snapped to the 3 km cell the contours are drawn on, so this
   * readout and the amber on the map are answers about the same box.
   */
  async sounding(
    lat: number,
    lon: number,
    hour: number,
    at?: Date
  ): Promise<Sounding> {
    assertInDomain(lat, lon);
    // Two builds off two products, and neither needs the other, so the first
    // click pays for the slower rather than for the sum.
    const [profile, surface] = await Promise.all([
      this.profile(hour, at),
      this.surface(hour, at),
    ]);
    const geo = this.geo!;
    if (!inGrid(geo, lat, lon)) throw new OutsideDomain(lat, lon);
    const cell = cellAt(geo, lat, lon);

    // The grid holds levels up to 100 mb for the cloud-top layer; the readout
    // shows only the ones a drone flies in. See PROFILE_LEVELS.
    const levels: SoundingLevel[] = SOUNDING_LEVELS.map((mb) => ({
      mb,
      tempC: profile.tempC.get(levelKey(mb))![cell],
      heightFt: Math.round(profile.heightFt.get(levelKey(mb))![cell]),
    }))
      // Bottom up, so a search for the lowest crossing walks it in order.
      .sort((a, b) => a.heightFt - b.heightFt);

    const bandBaseFt = isothermFt(levels, SEEDING.warmestC);

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
      bandBaseFt,
      bandTopFt: isothermFt(levels, SEEDING.coldestC),
      baseC: Math.round(levels[0].tempC * 10) / 10,
      topC: Math.round(levels[levels.length - 1].tempC * 10) / 10,
      levels,
      diagnostics: diagnostics(
        surface.fields,
        cell,
        profile.surfaceFt[cell],
        bandBaseFt
      ),
    };
  }

  /**
   * The 3 km grid and a temperature lookup on it — what another service needs
   * to turn a pressure into a temperature.
   *
   * This exists for the cloud-top layer, which gets its cloud *geometry* from
   * GOES and has no thermodynamics of its own. §5 of `MEASUREMENTS.md` is the
   * reason that split is the right way round: HRRR is trustworthy about the
   * temperature profile and shaky about where the cloud is, so the satellite
   * says where the top is and this says how cold it is there.
   *
   * Cloud-top contours are drawn on the satellite's 2 km grid. The join samples
   * those pixels onto this 3 km grid, which is also the liquid field's grid, so
   * a click still answers one cell.
   */
  async column(hour: number, at?: Date): Promise<Column> {
    const profile = await this.profile(hour, at);
    return {
      geo: this.geo!,
      run: profile.run,
      hour,
      tempAt: (cell: number, mb: number) =>
        temperatureAtMb(profile.levels, profile.tempC, cell, mb),
    };
  }

  /**
   * The edge of the model, as one polygon.
   *
   * Every readout on the candidate map answers a click by snapping it to a
   * cell, so where the cells stop is a fact an operator needs before clicking
   * rather than after. Drawn, it is a line; the same edge tested against a
   * point is {@link inGrid}, and both are read off the same cells so the line
   * cannot promise an answer the readout then refuses.
   *
   * Cached for the life of the process: HRRR's Lambert grid is fixed, so this
   * is the same ring for every run. It costs one `wrfsfc` build the first time,
   * which is the build the cloud-base layer pays for anyway.
   */
  async domain(): Promise<DomainFrame> {
    if (this.domainFrame) return this.domainFrame;
    await this.surface(0);
    this.domainFrame = {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Polygon", coordinates: [perimeter(this.geo!)] },
        },
      ],
    };
    return this.domainFrame;
  }

  /** The domain-wide profile grid every click on this hour is answered from. */
  private async profile(hour: number, at?: Date): Promise<Profile> {
    this.assertHour(hour);

    const cycle = await this.cycle(at);
    const key = `${cycle.run.toISOString()}:profile:${hour}`;

    const cached = this.profiles.get(key);
    if (cached) return cached;

    const running = this.profileInflight.get(key);
    if (running) return running;

    const work = this.buildProfile(cycle, hour)
      .then((built) => {
        this.profiles.set(key, built);
        // ~12 MB each, so the map is capped rather than left to grow across the
        // 19 forecast hours. Oldest insertion goes first.
        cap(this.profiles, PROFILE_CACHE);
        this.evictOldRuns(cycle);
        return built;
      })
      .finally(() => this.profileInflight.delete(key));

    this.profileInflight.set(key, work);
    return work;
  }

  /** The hour's 2D diagnostics, and the cloud-base layer built from them. */
  private async surface(hour: number, at?: Date): Promise<Surface> {
    this.assertHour(hour);

    const cycle = await this.cycle(at);
    const key = `${cycle.run.toISOString()}:surface:${hour}`;

    const cached = this.surfaces.get(key);
    if (cached) return cached;

    const running = this.surfaceInflight.get(key);
    if (running) return running;

    const work = this.buildSurface(cycle, hour)
      .then((built) => {
        this.surfaces.set(key, built);
        cap(this.surfaces, SURFACE_CACHE);
        this.evictOldRuns(cycle);
        return built;
      })
      .finally(() => this.surfaceInflight.delete(key));

    this.surfaceInflight.set(key, work);
    return work;
  }

  /**
   * Read every `wrfsfc` diagnostic this hour carries, block-average each to
   * 12 km, and band the cloud base.
   *
   * Messages are matched back to fields by their GRIB2 parameter identity
   * rather than by arrival order — see `DIAGNOSTICS.id` for why `shortName`
   * cannot do it here — and every field asked for must arrive, so a renamed or
   * dropped record fails loudly instead of leaving a hole in the readout.
   */
  private async buildSurface(cycle: Cycle, hour: number): Promise<Surface> {
    const rows = await index(cycle, hour, "wrfsfc");
    const url = gribUrl(cycle, hour, "wrfsfc");

    const wanted = recordsAt(hour);
    const grib = await fetchRanges(
      url,
      wanted.map((id) =>
        pick(rows, DIAGNOSTICS[id].grib.name, DIAGNOSTICS[id].grib.level)
      ),
      cycle.origin
    );

    const byId = new Map(
      wanted.map((id) => [DIAGNOSTICS[id].id as string, id])
    );
    const fields: Fields = new Map();

    await eachMessage(
      grib,
      {
        keys: ["parameterCategory", "parameterNumber", "typeOfLevel"],
        points: POINTS,
        missingValue: SFC_MISSING,
        onMessage: (keys, values) => {
          const id = byId.get(keys.join(":"));
          if (!id)
            throw new Error(`Unexpected HRRR record [${keys.join(" ")}]`);
          const spec = DIAGNOSTICS[id];
          fields.set(id, scaleField(values, spec.scale, spec.missing));
        },
      },
      "hrrr-sfc"
    );

    for (const id of wanted) {
      if (!fields.has(id)) {
        const { name, level } = DIAGNOSTICS[id].grib;
        throw new Error(`HRRR carried no ${name} at ${level}`);
      }
    }

    await this.ensureGeo(grib);
    const geo = this.geo!;
    const grid: Grid = {
      nx: geo.nx,
      ny: geo.ny,
      values: fields.get("cloudBase")!,
    };
    return {
      run: cycle.run,
      hour,
      fields,
      base: {
        grid,
        stats: baseStats(cycle.run, hour, grid),
      },
    };
  }

  /**
   * Read TMP and HGT on the 50 mb ladder, plus the terrain height.
   *
   * Fields are keyed by (name, level) rather than paired by arrival order — the
   * seeding build can rely on TMP preceding CLWMR within a level, but here two
   * fields from two products are being assembled and guessing at the order would
   * silently swap temperature for altitude.
   */
  private async buildProfile(cycle: Cycle, hour: number): Promise<Profile> {
    const rows = await index(cycle, hour, "wrfprs");
    const url = gribUrl(cycle, hour, "wrfprs");
    const levels = PROFILE_LEVELS;

    const grib = await fetchRanges(
      url,
      levels.flatMap((mb) =>
        ["TMP", "HGT"].map((name) => pick(rows, name, `${mbLabel(mb)} mb`))
      ),
      cycle.origin
    );

    const tempC = new Map<number, Float32Array>();
    const heightFt = new Map<number, Float32Array>();

    await eachHrrrMessage(grib, (name, level, values) => {
      if (name === "t") {
        const c = new Float32Array(values.length);
        for (let i = 0; i < values.length; i++) c[i] = values[i] - 273.15;
        tempC.set(levelKey(level), c);
        return;
      }
      if (name === "gh") {
        heightFt.set(levelKey(level), scaleField(values, METERS_TO_FEET));
      }
    });

    for (const mb of levels) {
      if (!tempC.has(levelKey(mb)) || !heightFt.has(levelKey(mb))) {
        throw new Error(`HRRR profile is missing TMP or HGT at ${mb} mb`);
      }
    }

    await this.ensureGeo(grib);

    return {
      run: cycle.run,
      hour,
      levels,
      tempC,
      heightFt,
      surfaceFt: await this.terrain(cycle, hour),
    };
  }

  /**
   * Terrain height, so the readout can say when an isotherm is underground.
   *
   * HRRR extrapolates its pressure levels below ground rather than leaving them
   * missing, so without this a freezing level in Colorado reads as a real
   * altitude when it is 2,000 ft inside a mountain.
   */
  private async terrain(cycle: Cycle, hour: number): Promise<Float32Array> {
    const rows = await index(cycle, hour, "wrfsfc");
    const grib = await fetchRanges(
      gribUrl(cycle, hour, "wrfsfc"),
      [pick(rows, "HGT", "surface")],
      cycle.origin
    );

    let surface: Float32Array | null = null;
    await eachHrrrMessage(grib, (_name, _level, values) => {
      surface = scaleField(values, METERS_TO_FEET);
    });
    if (!surface) throw new Error("HRRR carried no surface height");
    return surface;
  }

  private async contours(
    field: FieldId,
    hour: number,
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<ContourFrame> {
    this.assertHour(hour);

    const cycle = await this.cycle(at);
    const spec = FIELDS[field];

    // The model does not diagnose this field yet (see FIELDS.precip.firstHour).
    // Answer honestly with an empty frame rather than downloading a record we
    // already know decodes to zeros.
    if (hour < spec.firstHour) return frame(cycle.run, hour, []);

    const key = `${cycle.run.toISOString()}:${field}:${hour}`;

    const cached = this.frames.get(key);
    const built = cached ?? (await this.loadField(cycle, hour, spec, key));
    return frame(
      built.run,
      hour,
      this.features(built.grid, built.property, built.levels, box, false, fine)
    );
  }

  private async loadField(
    cycle: Cycle,
    hour: number,
    spec: FieldSpec,
    key: string
  ): Promise<CachedField> {
    const running = this.inflight.get(key);
    if (running) return running;

    const work = this.build(cycle, hour, spec)
      .then((built) => {
        this.frames.set(key, built);
        this.evictOldRuns(cycle);
        return built;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, work);
    return work;
  }

  private async seeding(hour: number, at?: Date): Promise<Slw> {
    this.assertHour(hour);

    const cycle = await this.cycle(at);
    const key = `${cycle.run.toISOString()}:slw:${hour}`;

    const cached = this.slw.get(key);
    if (cached) return cached;

    const running = this.slwInflight.get(key);
    if (running) return running;

    const work = buildSlw(cycle, hour, async (_grid, grib) => {
      await this.ensureGeo(grib);
      return [];
    })
      .then((built) => {
        this.slw.set(key, built);
        this.evictOldRuns(cycle);
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

  /**
   * Drop everything from a run that is no longer current.
   *
   * **Live builds only.** A replayed run never rolls, so evicting against it
   * would throw away the live map's frames the moment someone opened a
   * historical date — and evicting *it* on the next live build would throw away
   * the replay. The two caches coexist instead: live entries are evicted by run,
   * archive entries are capped by count.
   */
  private evictOldRuns(cycle: Cycle) {
    if (cycle.origin === "archive") {
      cap(this.frames, ARCHIVE_CACHE);
      cap(this.slw, ARCHIVE_CACHE);
      return;
    }
    const keep = cycle.run.toISOString();
    for (const key of this.frames.keys()) {
      if (!key.startsWith(keep)) this.frames.delete(key);
    }
    for (const key of this.slw.keys()) {
      if (!key.startsWith(keep)) this.slw.delete(key);
    }
  }

  /** Byte range of one field's record. */
  private async range(
    cycle: Cycle,
    hour: number,
    grib: FieldSpec["grib"]
  ): Promise<[number, number]> {
    const rows = await index(cycle, hour, "wrfsfc");
    return pick(rows, grib.name, grib.level);
  }

  private async build(
    cycle: Cycle,
    hour: number,
    spec: FieldSpec
  ): Promise<CachedField> {
    const range = await this.range(cycle, hour, spec.grib);
    const grib = await fetchRanges(
      gribUrl(cycle, hour, "wrfsfc"),
      [range],
      cycle.origin
    );

    const { grid, geo } = await this.decode(grib, spec);
    if (!this.geo) this.geo = geo;

    return {
      run: cycle.run,
      hour,
      grid,
      property: spec.property,
      levels: spec.levels,
    };
  }

  /**
   * Contour a window of the grid the decode already holds.
   *
   * `smooth` is whether the values vary continuously, which every HRRR field
   * here does except the base window — that one is a gate with no gradient for
   * a ring to follow, so it keeps the cell-edge midpoints.
   */
  private features(
    grid: Grid,
    property: string,
    levels: readonly number[],
    box: LonLatBox = DRAWN,
    disjoint = false,
    fine = false,
    smooth = true
  ): ContourFeature[] {
    const drawn = prepareDraw(grid, this.geo!, box, fine);
    const style = smooth ? smoothFor(fine) : styleFor(fine);
    return disjoint
      ? bandFeatures(drawn.grid, drawn.geo, property, levels, style)
      : features(drawn.grid, drawn.geo, property, levels, style);
  }

  /**
   * eccodes reads the Lambert grid and hands back lat/lon per point, so we
   * never do projection maths ourselves. Values stay on the native 3 km grid.
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
   * The 3 km lat/lon grid, built once from any HRRR record and reused for
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
}

/** Drop oldest insertions until the map is within `limit`. */
function cap<V>(map: Map<string, V>, limit: number) {
  while (map.size > limit) map.delete(map.keys().next().value!);
}

export { polygons };
export type { Grid, Geo };

export const Hrrr = new ForecastService();
