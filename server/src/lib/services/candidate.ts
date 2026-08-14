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
import { features } from "./contour";
import { Hrrr } from "./forecast";
import { SEEDING } from "./slw";
import { Goes } from "./cloudtop";
import { Mrms } from "./radar";
import { emptyStats, join, sampleRadar, summarize } from "./join";

// Types
import type { Grid, ContourFeature } from "./contour";
import type { CandidateStats } from "./join";

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

// The join's own shapes, re-exported: the routers and the app's types.ts are
// written against this service, not against the arithmetic behind it.
export type { CandidateStats, Rejected } from "./join";
export { CEILING_FT } from "./join";

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
  features: ContourFeature[];
};

type Scene = { frame: CandidateFrame; stats: CandidateStats };

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
    const [liquid, base, band, tops, radar] = await Promise.all([
      Hrrr.liquidField(ANALYSIS_HOUR, at),
      Hrrr.diagnosticField("cloudBase", ANALYSIS_HOUR, at),
      Hrrr.bandField(ANALYSIS_HOUR, at),
      Goes.topField(at),
      Mrms.reflectivityField(at),
    ]);

    const run = liquid.run;
    const validTime = new Date(
      run.getTime() + ANALYSIS_HOUR * 3_600_000
    ).toISOString();
    const geo = band.geo;

    // No point in the domain is in the seeding band at any level, so there is
    // no liquid grid to join and nothing can be a candidate.
    if (!liquid.values) {
      return {
        frame: {
          type: "FeatureCollection",
          run: run.toISOString(),
          validTime,
          sceneTime: tops.validTime,
          radarTime: radar.validTime,
          features: [],
        },
        stats: emptyStats(run, validTime, tops.validTime, radar.validTime),
      };
    }

    const joined = join({
      slw: liquid.values,
      cloudBaseFt: base.values!,
      bandTopFt: band.topFt,
      topColdnessC: tops.cells.values,
      dbz: sampleRadar(radar.grid, geo),
    });

    const grid: Grid = { nx: geo.nx, ny: geo.ny, values: joined.values };

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
        features: features(grid, geo, CANDIDATE.property, CANDIDATE.levels),
      },
      stats: summarize(joined, {
        run,
        validTime,
        sceneTime: tops.validTime,
        radarTime: radar.validTime,
        cloudBaseFt: base.values!,
        bandBaseFt: band.baseFt,
        mixedCape: mixedCape.values,
        vil: vil.values,
        stormU: stormU.values,
        stormV: stormV.values,
      }),
    };
  }
}

export const Seedability = new CandidateService();
