/**
 * The candidate field: one layer instead of four an operator intersects by eye.
 *
 * Every other layer here answers one question about the sky. This one asks all
 * of them at once, per 12 km cell, and draws only where every answer is yes:
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
 */

// Services
import { features } from "../shared/contour";
import { Hrrr } from "../hrrr/forecast";
import { SEEDING } from "../hrrr/slw";
import { Goes } from "../goes/cloudtop";
import { GoesPhase } from "../goes/phase";
import { Mrms } from "../mrms/radar";
import { assertInDomain, inGrid, cellAt, OutsideDomain } from "../shared/grid";
import {
  emptyPoint,
  emptyStats,
  join,
  readPoint,
  sampleRadar,
  summarize,
  topHoldsLiquid,
} from "./join";

// Types
import type { Grid, Geo, ContourFeature } from "../shared/contour";
import type { CandidatePoint, CandidateStats, Inputs } from "./join";

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
// written against this service, not against the arithmetic behind it.
export type { CandidatePoint, CandidateStats, Rejected, Verdict } from "./join";
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
 * lands on a cell and the readout still says which one.
 */
type Cells = { geo: Geo; inputs: Inputs | null };

type Scene = {
  frame: CandidateFrame;
  /** The same build, traced around the ground the satellite confirms. */
  confirmed: CandidateFrame;
  stats: CandidateStats;
  cells: Cells;
};

export class CandidateService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();

  async field(at?: Date): Promise<CandidateFrame> {
    return (await this.scene(at)).frame;
  }

  /** The same build's summary. Asking for either warms both. */
  async fieldStats(at?: Date): Promise<CandidateStats> {
    return (await this.scene(at)).stats;
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
  async confirmedField(at?: Date): Promise<CandidateFrame> {
    return (await this.scene(at)).confirmed;
  }

  /**
   * The same build, read over one clicked point.
   *
   * The summary is about the whole domain, which is a statement about the
   * country rather than about the cloud an operator is looking at. This is the
   * same five tests asked of one 12 km cell: what is in it, what ruled it out,
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
    return inputs ? readPoint(inputs, cell, where) : emptyPoint(where);
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
   * Warm all five inputs, then join them.
   *
   * In parallel, and that is the difference between a cold build costing the
   * slowest source and costing their sum. They overlap more than they look:
   * the band edges and the satellite's temperatures come from the same HRRR
   * profile grid, and the service collapses those onto one download.
   */
  private async build(at?: Date): Promise<Scene> {
    const [liquid, base, band, tops, radar, phase] = await Promise.all([
      Hrrr.liquidField(ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("cloudBase", ANALYSIS_HOUR, at),
      Hrrr.bandField(ANALYSIS_HOUR, at),
      Goes.topField(at),
      Mrms.reflectivityField(at),
      observedPhase(at),
    ]);

    const run = liquid.run;
    const validTime = new Date(
      run.getTime() + ANALYSIS_HOUR * 3_600_000
    ).toISOString();
    const geo = band.geo;

    // No point in the domain is in the seeding band at any level, so there is
    // no liquid grid to join and nothing can be a candidate.
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
        cells: { geo, inputs: null },
      };
    }

    const inputs = {
      slw: liquid.values,
      cloudBaseFt: base.values!,
      bandTopFt: band.topFt,
      topColdnessC: tops.cells.values,
      dbz: sampleRadar(radar.grid, geo),
      topPhase: phase.cells,
    };
    const joined = join(inputs);

    const grid: Grid = { nx: geo.nx, ny: geo.ny, values: joined.values };

    // The same values, kept only where the satellite still sees liquid at the
    // cloud top. Zero elsewhere, so the trace encloses the confirmed ground and
    // nothing else — it is a mask over the field, never a second field.
    const confirmedValues = new Float32Array(joined.values.length);
    for (let i = 0; i < joined.values.length; i++) {
      if (joined.values[i] > 0 && topHoldsLiquid(inputs.topPhase, i)) {
        confirmedValues[i] = joined.values[i];
      }
    }
    const confirmedGrid: Grid = {
      nx: geo.nx,
      ny: geo.ny,
      values: confirmedValues,
    };

    // The convective and steering numbers over the ground that passed. They are
    // read here rather than in `join` because they answer a different question:
    // join decides *whether* a cell is a candidate, this describes the ones that
    // are, and nothing it reads may change the decision.
    const [mixedCape, vil, stormU, stormV] = await Promise.all([
      Hrrr.diagnosticField("mixedCape", ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("vil", ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("stormU", ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("stormV", ANALYSIS_HOUR, at),
    ]);

    return {
      frame: {
        type: "FeatureCollection",
        run: run.toISOString(),
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        features: features(grid, geo, CANDIDATE.property, CANDIDATE.levels),
      },
      confirmed: {
        type: "FeatureCollection",
        run: run.toISOString(),
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        features: features(
          confirmedGrid,
          geo,
          CONFIRMED.property,
          CONFIRMED.levels
        ),
      },
      stats: summarize(joined, {
        run,
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        phaseTime: phase.validTime,
        cloudBaseFt: base.values!,
        bandBaseFt: band.baseFt,
        mixedCape: mixedCape.values,
        vil: vil.values,
        stormU: stormU.values,
        stormV: stormV.values,
      }),
      cells: { geo, inputs },
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
