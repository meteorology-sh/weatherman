/**
 * The candidate field: one layer instead of four an operator intersects by eye.
 *
 * Every other layer here answers one question about the sky. This one asks all
 * of them at once, per 3 km cell, and draws only where every answer is yes:
 * the model has supercooled liquid in the seeding band, the satellite agrees
 * there is cloud whose top reaches that band, the model gives a cloud base low
 * enough that the band is inside the cloud rather than above it, and the radar
 * is not already watching the cell rain itself out.
 *
 * **The join is an array pass, not a geometric operation.** Contouring is the
 * last step of each source's build, so this reads the grids those builds already
 * produced — before they became polygons — and traces one set of contours at the
 * end. Intersecting thousands of rings to recover a per-cell answer each build
 * already had would be slower and less exact.
 *
 * **It exists only at the analysis hour.** Satellites cannot forecast, so a
 * join that leans on an observed cloud top cannot be run at f06. There is no
 * `hour` parameter, and `at` replays the whole join at a past hour instead.
 *
 * The same build also runs the Texas-target join in `target.ts`. That is a
 * second question on the same arrays, not a retune of the opportunity field.
 * The point readout returns both. Geometry for the target waits on the 2025
 * score.
 */

// Services
import { features, smoothFor, styleFor } from "../shared/contour";
import { Hrrr } from "../hrrr/forecast";
import { SEEDING } from "../hrrr/slw";
import { Goes } from "../goes/cloudtop";
import { GoesPhase } from "../goes/phase";
import { EchoTops, echoTopFtValues, sampleEchoTopKm } from "../mrms/echotop";
import { Mrms } from "../mrms/radar";
import {
  assertInDomain,
  inGrid,
  cellAt,
  OutsideDomain,
  DRAWN,
  prepareDraw,
} from "../shared/grid";
import type { LonLatBox } from "../shared/grid";
import { nearestHour } from "../shared/replay";
import {
  emptyPoint,
  emptyStats,
  join,
  readPoint,
  sampleRadar,
  summarize,
  topHoldsLiquid,
} from "./join";
import {
  flyValues,
  join as targetJoin,
  readTarget,
  summarize as summarizeTarget,
} from "./target";
import {
  baseFeatures,
  mergedBaseValues,
  readMergedBase,
  summarizeMergedBase,
} from "./cloudbase";
import type {
  MergedBaseInputs,
  MergedBasePoint,
  MergedBaseStats,
} from "./cloudbase";
import type {
  TargetInputs,
  TargetJoin,
  TargetPoint,
  TargetStats,
} from "./target";

// Types
import type { Geo, ContourFeature } from "../shared/contour";
import type {
  CandidatePoint as SeedabilityPoint,
  CandidateStats,
  Inputs,
} from "./join";

/**
 * The analysis hour. The candidate map is "right now", and every HRRR input
 * here is a state the analysis holds rather than a flux needing a timestep.
 */
const ANALYSIS_HOUR = 0;

/** Two minutes. Every input has its own cache; this only collapses the join. */
const CACHE_TTL_MS = 2 * 60_000;

/** Replayed hours never change, so a handful are kept keyed by the hour asked for. */
const ARCHIVE_CACHE = 8;

/** The scalar the contours are traced on. */
const CANDIDATE = {
  /**
   * Supercooled liquid water path, g/m², in cells that pass every test.
   *
   * The candidate field **is** the liquid-water field with the other criteria
   * applied, so it carries the same quantity on the same levels. That is what
   * makes the two layers readable against each other: amber with no green over
   * it is liquid the join threw away, and the sidebar says which test threw it.
   */
  property: "seedableSlwPath",
  levels: SEEDING.levels,
} as const;

/**
 * The outline drawn around candidate ground the satellite still sees liquid at
 * the top of.
 *
 * **One level, not four.** The field's own bands say how much liquid is there;
 * this says only *which* of that ground has an observation behind it, and that
 * is one boundary rather than a second ramp. Tracing all four would put a
 * nested set of rings on top of a nested set of fills and say nothing the fills
 * do not already say.
 *
 * It is the lowest of the field's own levels, so the outline encloses exactly
 * the ground the field draws and cannot appear where there is no candidate.
 */
const CONFIRMED = {
  property: CANDIDATE.property,
  levels: [SEEDING.levels[0]],
} as const;

// The join's own shapes, re-exported: the routers and the app's types.ts are
// written against this service, not against the arithmetic behind it. The
// point is both products: seeding-opportunity verdict plus the Texas target.
export type { CandidateStats, Rejected, Verdict } from "./join";
export type { TargetStats, TargetVerdict } from "./target";
export type { BaseSource, MergedBasePoint, MergedBaseStats } from "./cloudbase";
export { BASE_CEILING_FT } from "./cloudbase";
export type CandidatePoint = SeedabilityPoint & TargetPoint & MergedBasePoint;
export { CEILING_FT } from "../shared/aircraft";

export type CandidateFrame = {
  type: "FeatureCollection";
  /** HRRR cycle the model half came from, ISO 8601. */
  run: string;
  /** Analysis valid time, ISO 8601. */
  validTime: string;
  /** Start of the satellite scan the observed half came from. */
  sceneTime: string;
  /** Time of the radar scan that vetoed. */
  radarTime: string;
  /** Start of the phase scan cross-checking it. Null when none could be read. */
  phaseTime: string | null;
  features: ContourFeature[];
};

/**
 * A build: the picture, its summary, and the arrays both came from.
 *
 * `cells` is what answers a click. It is references to grids the source
 * services already hold in their own caches — not copies — so keeping it costs
 * nothing and means the answer over a point is read from the same arrays the
 * contours were traced from. Re-fetching each source per click would let the
 * panel report a scan the map is not drawing.
 *
 * `inputs` is null where the domain holds no seeding band at all and there is
 * no liquid grid to join. The grid itself is there either way, so a click still
 * lands on a cell and the readout still says which one. The Texas target does
 * not need the liquid grid, so `target` is always present.
 */
type Cells = {
  geo: Geo;
  inputs: Inputs | null;
  target: TargetInputs;
  /** The merged cloud-base layer's three grids, for the fill and the click. */
  base: MergedBaseInputs;
};

type Scene = {
  frame: CandidateFrame;
  /** The same build, traced around the ground the satellite confirms. */
  confirmed: CandidateFrame;
  stats: CandidateStats;
  targetStats: TargetStats;
  targetJoined: TargetJoin;
  baseStats: MergedBaseStats;
  cells: Cells;
  values: Float32Array | null;
  confirmedValues: Float32Array | null;
};

export class CandidateService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();

  async field(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<CandidateFrame> {
    const scene = await this.scene(at);
    if (!scene.values) return scene.frame;
    const geo = scene.cells.geo;
    const drawn = prepareDraw(
      { nx: geo.nx, ny: geo.ny, values: scene.values },
      geo,
      box,
      fine
    );
    return {
      ...scene.frame,
      features: features(
        drawn.grid,
        drawn.geo,
        CANDIDATE.property,
        CANDIDATE.levels,
        smoothFor(fine)
      ),
    };
  }

  /**
   * Cells that pass the Texas tests: base low enough to seed, 18 dBZ
   * echo top past freezing nearby, rain nearby. One fill, the same
   * answer as FLY on a click.
   */
  async targetField(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false,
    round = false
  ): Promise<CandidateFrame> {
    const scene = await this.scene(at);
    const geo = scene.cells.geo;
    const values = flyValues(scene.targetJoined);
    const drawn = prepareDraw(
      { nx: geo.nx, ny: geo.ny, values },
      geo,
      box,
      fine,
      undefined,
      true
    );
    return {
      ...scene.frame,
      features: features(
        drawn.grid,
        drawn.geo,
        "fly",
        [1],
        // A gate, so the values are 1 or nothing. There is no gradient to
        // interpolate a ring along, hence `styleFor` and not `smoothFor`.
        // The map asks for the corners to be taken off the staircase that
        // leaves; the evaluation measures against it and does not.
        styleFor(fine, round)
      ),
    };
  }

  /**
   * Cloud base as one fill: the model's base where it has one, the CCL where it
   * does not, under a measured echo top, below 18,000 ft MSL.
   *
   * `cloudbase.ts` carries what the merge means and why the echo top gates it.
   * This replaces the HRRR-only cloud-base layer on `/forecast/cloudbase`,
   * which is why it is here and not there: the echo top is an observation, and
   * an observation cannot be forecast to f06.
   */
  async baseField(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<CandidateFrame> {
    const scene = await this.scene(at);
    const geo = scene.cells.geo;
    const values = mergedBaseValues(scene.cells.base);
    const drawn = prepareDraw(
      { nx: geo.nx, ny: geo.ny, values },
      geo,
      box,
      fine
    );
    return {
      ...scene.frame,
      // Disjoint bands — `cloudbase.ts` owns the trace and says why.
      features: baseFeatures(drawn.grid, drawn.geo, smoothFor(fine)),
    };
  }

  /**
   * The cloud-base layer's summary, off the same build the fill came from.
   *
   * A box counts only those cells. The merge itself is per cell and reads no
   * neighbors, so unlike the target join there is nothing a box can cut off.
   */
  async baseStats(at?: Date, box?: LonLatBox): Promise<MergedBaseStats> {
    const scene = await this.scene(at);
    if (!box) return scene.baseStats;
    return summarizeMergedBase(scene.cells.base, {
      run: new Date(scene.frame.run),
      validTime: scene.frame.validTime,
      radarTime: scene.frame.radarTime,
      geo: scene.cells.geo,
      box,
    });
  }

  /** The same build's summary. Asking for either warms both. */
  async fieldStats(at?: Date): Promise<CandidateStats> {
    return (await this.scene(at)).stats;
  }

  /**
   * How much of the asked ground looks like a Texas target.
   *
   * No box means the whole domain. A box counts only those cells, but the
   * join still ran on the full grid so a cell just inside the box can see a
   * neighbor just outside it. Flare hit-rate without this number is how a
   * join that paints Texas cheats.
   */
  async targetStats(at?: Date, box?: LonLatBox): Promise<TargetStats> {
    const scene = await this.scene(at);
    if (!box) return scene.targetStats;
    return summarizeTarget(scene.cells.target, scene.targetJoined, {
      run: new Date(scene.frame.run),
      validTime: scene.frame.validTime,
      sceneTime: scene.frame.sceneTime,
      radarTime: scene.frame.radarTime,
      geo: scene.cells.geo,
      box,
    });
  }

  /**
   * The outline of candidate ground whose cloud top the satellite still sees
   * as liquid, off the same cached build the field came from.
   *
   * A separate frame rather than a property on the field's own polygons,
   * because a contour polygon spans many cells and confirmation is per cell —
   * one polygon routinely covers both. Two traces of the same array is the only
   * way to draw the distinction where it actually falls.
   */
  async confirmedField(
    at?: Date,
    box: LonLatBox = DRAWN,
    fine = false
  ): Promise<CandidateFrame> {
    const scene = await this.scene(at);
    if (!scene.confirmedValues) return scene.confirmed;
    const geo = scene.cells.geo;
    const drawn = prepareDraw(
      { nx: geo.nx, ny: geo.ny, values: scene.confirmedValues },
      geo,
      box,
      fine
    );
    return {
      ...scene.confirmed,
      features: features(
        drawn.grid,
        drawn.geo,
        CONFIRMED.property,
        CONFIRMED.levels,
        smoothFor(fine)
      ),
    };
  }

  /**
   * The same build, read over one clicked point.
   *
   * The summary is about the whole domain, which is a statement about the
   * country rather than about the cloud an operator is looking at. This is the
   * same five tests asked of one 3 km cell: what is in it, what ruled it out,
   * and when each source saw it.
   */
  async point(lat: number, lon: number, at?: Date): Promise<CandidatePoint> {
    assertInDomain(lat, lon);
    const { frame, cells } = await this.scene(at);
    const { geo, inputs } = cells;
    if (!inGrid(geo, lat, lon)) throw new OutsideDomain(lat, lon);
    const cell = cellAt(geo, lat, lon);

    const where = {
      run: frame.run,
      validTime: frame.validTime,
      sceneTime: frame.sceneTime,
      radarTime: frame.radarTime,
      phaseTime: frame.phaseTime,
      // The cell, not the click: the click is finer than the grid, and echoing
      // it back would imply a precision this answer does not have.
      lat: Math.round(geo.lats[cell] * 100) / 100,
      lon: Math.round(geo.lons[cell] * 100) / 100,
    };

    // No seeding band anywhere in the domain, so there is nothing to seed in
    // this cell either — a real answer about it rather than a missing one.
    // The Texas target does not need that band and is still asked.
    return {
      ...(inputs ? readPoint(inputs, cell, where) : emptyPoint(where)),
      ...readTarget(cells.target, cell),
      ...readMergedBase(cells.base, cell),
    };
  }

  private async scene(at?: Date): Promise<Scene> {
    if (at) return this.replay(at);

    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.scene;
    }
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

  /**
   * A past hour, keyed by the hour that was asked for.
   *
   * No TTL — the inputs are archived scans and a run that will not be rerun.
   * The replay page always sends the same string for an hour, so two requests
   * for one hour share a build.
   */
  private async replay(at: Date): Promise<Scene> {
    const key = at.toISOString();

    const cached = this.archive.get(key);
    if (cached) return cached;

    const running = this.archiveInflight.get(key);
    if (running) return running;

    const work = this.build(at)
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

  /**
   * Warm the inputs, then run both joins.
   *
   * In parallel, and that is the difference between a cold build costing the
   * slowest source and costing their sum. They overlap more than they look:
   * the band edges and the satellite's temperatures come from the same HRRR
   * profile grid, and the service collapses those onto one download.
   */
  private async build(at?: Date): Promise<Scene> {
    // The model half rounds to its analysis hour and the observed half keeps
    // the timestamp it was given. See `nearestHour` for why they differ: a
    // request at 18:43 gets the 19z analysis, the ABI scan nearest 18:43 and
    // the mosaic nearest 18:43, rather than putting all three on 18:00.
    const cycle = at && nearestHour(at);

    // Each service puts its own feed on the notice board, and draws its
    // archived copy when the live one fails.
    const [liquid, base, ccl, band, tops, radar, phase, echo] =
      await Promise.all([
        Hrrr.liquidField(ANALYSIS_HOUR, cycle),
        Hrrr.diagnosticField("cloudBase", ANALYSIS_HOUR, cycle),
        Hrrr.cclField(ANALYSIS_HOUR, cycle),
        Hrrr.bandField(ANALYSIS_HOUR, cycle),
        Goes.topField(at),
        Mrms.reflectivityField(at),
        observedPhase(at),
        EchoTops.mosaic(at).catch(() => null),
      ]);

    const run = liquid.run;
    const validTime = new Date(
      run.getTime() + ANALYSIS_HOUR * 3_600_000
    ).toISOString();
    const geo = band.geo;
    const dbz = sampleRadar(radar.grid, geo);
    // Measured 18 dBZ top, same sample the echo-past-freezing fill is
    // drawn from. Modeled echo top is a different height and was why
    // a click on that fill could read "below freezing".
    const echoTopFt = echo
      ? echoTopFtValues(sampleEchoTopKm(echo.grid, geo))
      : new Float32Array(geo.lats.length).fill(Number.NaN);

    // The Texas target does not need the liquid grid. It runs even when the
    // domain holds no seeding band, because that is a different question.
    const target: TargetInputs = {
      cloudBaseFt: base.values!,
      cclFt: ccl.values,
      surfaceFt: band.surfaceFt,
      freezingFt: band.freezingFt,
      echoTopFt,
      dbz,
      nx: geo.nx,
      ny: geo.ny,
    };
    const targetJoined = targetJoin(target);
    const targetStats = summarizeTarget(target, targetJoined, {
      run,
      validTime,
      sceneTime: tops.validTime,
      radarTime: radar.validTime,
      geo,
    });

    // The cloud-base layer: HRRR's own base where it has one, the CCL where it
    // does not, under a measured echo top. Independent of the seeding band, so
    // it is built here and not inside either join.
    const baseCells: MergedBaseInputs = {
      cloudBaseFt: base.values!,
      cclFt: ccl.values,
      echoTopFt,
    };
    const baseStats = summarizeMergedBase(baseCells, {
      run,
      validTime,
      radarTime: radar.validTime,
      geo,
    });

    // No point in the domain is in the seeding band at any level, so there is
    // no liquid grid to join and nothing can be a candidate. The target still
    // has an answer.
    if (!liquid.values) {
      const empty: CandidateFrame = {
        type: "FeatureCollection",
        run: run.toISOString(),
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        features: [],
      };
      return {
        frame: empty,
        confirmed: empty,
        stats: emptyStats(
          run,
          validTime,
          tops.validTime,
          radar.validTime,
          phase.validTime
        ),
        targetStats,
        targetJoined,
        baseStats,
        cells: { geo, inputs: null, target, base: baseCells },
        values: null,
        confirmedValues: null,
      };
    }

    const inputs = {
      slw: liquid.values,
      cloudBaseFt: base.values!,
      bandTopFt: band.topFt,
      topColdnessC: tops.cells.values,
      dbz,
      topPhase: phase.cells,
    };
    const joined = join(inputs);

    // The same values, kept only where the satellite still sees liquid at the
    // cloud top. Zero elsewhere, so the trace encloses the confirmed ground and
    // nothing else — it is a mask over the field, never a second field.
    const confirmedValues = new Float32Array(joined.values.length);
    for (let i = 0; i < joined.values.length; i++) {
      if (joined.values[i] > 0 && topHoldsLiquid(inputs.topPhase, i)) {
        confirmedValues[i] = joined.values[i];
      }
    }

    // The convective and steering numbers over the ground that passed. They are
    // read here rather than in `join` because they answer a different question:
    // join decides *whether* a cell is a candidate, this describes the ones that
    // are, and nothing it reads may change the decision.
    const [mixedCape, vil, stormU, stormV] = await Promise.all([
      Hrrr.diagnosticField("mixedCape", ANALYSIS_HOUR, cycle),
      Hrrr.diagnosticField("vil", ANALYSIS_HOUR, cycle),
      Hrrr.diagnosticField("stormU", ANALYSIS_HOUR, cycle),
      Hrrr.diagnosticField("stormV", ANALYSIS_HOUR, cycle),
    ]);

    return {
      frame: {
        type: "FeatureCollection",
        run: run.toISOString(),
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        features: [],
      },
      confirmed: {
        type: "FeatureCollection",
        run: run.toISOString(),
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        features: [],
      },
      values: joined.values,
      confirmedValues,
      stats: summarize(joined, {
        run,
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        cloudBaseFt: base.values!,
        surfaceFt: band.surfaceFt,
        bandBaseFt: band.baseFt,
        mixedCape: mixedCape.values,
        vil: vil.values,
        stormU: stormU.values,
        stormV: stormV.values,
      }),
      targetStats,
      targetJoined,
      baseStats,
      cells: { geo, inputs, target, base: baseCells },
    };
  }
}

export const Seedability = new CandidateService();

/**
 * The observed phase scene, or nothing.
 *
 * **The cross-check may not take the field down with it.** Every other input
 * here decides whether a cell is a candidate, so losing one means the answer
 * would be wrong and the build should fail. Phase decides nothing: it is read
 * beside the answer, and a scene that will not download is a build that reports
 * one fewer thing rather than a build with no map in it. The panel says the
 * check is missing instead of quietly showing zeroes.
 */
async function observedPhase(
  at?: Date
): Promise<{ cells: Float32Array | null; validTime: string | null }> {
  try {
    const scene = await GoesPhase.phaseField(at);
    return { cells: scene.cells.values, validTime: scene.validTime };
  } catch {
    return { cells: null, validTime: null };
  }
}
