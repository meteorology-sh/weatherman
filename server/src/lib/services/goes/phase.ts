/**
 * Observed cloud-top phase — whether the top of the cloud is still liquid or
 * has frozen.
 *
 * Every other statement this app makes about liquid water comes from HRRR, and
 * a model's opinion about phase is a simulation however good it is. This is the
 * one observation of phase available nationally and free: the satellite
 * classifies each pixel's cloud top as clear, liquid, supercooled liquid, mixed
 * or ice, and that is a measurement rather than a diagnosis.
 *
 * **It is an observed check on the model, not a replacement for it**, and the
 * limit is worth being exact about. The classification is of the cloud *top*.
 * It says nothing about phase down in the seeding band, which is where seeding
 * happens and where nothing free measures anything. What it can do is catch a
 * disagreement: the model claiming supercooled liquid in a cloud whose top the
 * satellite already sees glaciated, or a supercooled top over a cell the model
 * says holds no liquid at all.
 *
 * **A passive radiometer sees one deck.** Under multi-layer cloud this reports
 * the phase of whatever is on top — cirrus over a growing turret reads as ice,
 * and the turret underneath is invisible to it. That is the same limitation
 * `MEASUREMENTS.md` §4 records for `PRES:cloud top`, and it is why phase is
 * reported and never allowed to rule a cell out.
 *
 * There is no layer and no route. The join reads this and the panel reports it.
 */

// Services
import { Hrrr } from "../hrrr/forecast";
import { pixelAt } from "./abi";
import { download, gridOf, readScene, sceneTime, scalar, text } from "./scene";
import { PHASE_PRODUCT, latestPairedKey, pairedKeyAt } from "./sweep";

// Types
import type { Grid, Geo } from "../shared/contour";
import type { AbiGrid } from "./abi";

/**
 * Cloud-top phase. The constant and the reason for it live in `sweep.ts`, which
 * owns both halves of a scan — this service reads one of them and never chooses
 * which scan it reads. That is what keeps the phase this file reports and the
 * cloud-top height the other reports from being measured at different moments.
 */
const PRODUCT = PHASE_PRODUCT;

/** One scene's cadence, matching the cloud-top service for the same reason. */
const CACHE_TTL_MS = 5 * 60_000;

/** Wider than the radar's, because ABI scans CONUS every 5 minutes. */
const SCENE_TOLERANCE_MS = 30 * 60_000;

/** Replayed scenes never change, so a handful are kept keyed by their S3 key. */
const ARCHIVE_CACHE = 8;

/** The analysis hour, as everywhere the observed sources are read. */
const ANALYSIS_HOUR = 0;

/** GOES pixels across one 12 km cell, as the cloud-top service resamples. */
const WINDOW = 6;

/**
 * What the satellite can say about a cloud top, in the words this app uses.
 *
 * The scene publishes its own class names and the numbers it stores them as;
 * `classify` reads both out of the file and maps them onto these, so nothing
 * here depends on the order the product happens to list them in.
 *
 * The numbers are how a class rides on a `Float32Array` beside every other
 * field on the 12 km grid, and they are nobody's vocabulary but this file's —
 * the join and the panel speak in names.
 */
export const PHASE = {
  clear: 0,
  liquid: 1,
  supercooled: 2,
  mixed: 3,
  ice: 4,
  unknown: 5,
} as const;

export type CloudPhase = keyof typeof PHASE;

/** The code back to its name, for everything downstream of the grid. */
export const PHASE_NAMES = Object.keys(PHASE) as CloudPhase[];

/**
 * Coldest first, and `unknown` last.
 *
 * This is the order a tie between two classes over one 12 km cell is settled
 * in. Ties are broken toward the colder class so the answer never flatters the
 * model: reading "ice" where it was a coin toss between ice and supercooled
 * costs a candidate its confirmation, and reading "supercooled" the same way
 * would manufacture one.
 */
const COLDEST_FIRST: CloudPhase[] = [
  "ice",
  "mixed",
  "supercooled",
  "liquid",
  "unknown",
];

/** The scene's own class names, as `flag_meanings` spells them. */
const PUBLISHED: Record<string, CloudPhase> = {
  clear_sky: "clear",
  liquid_water: "liquid",
  super_cooled_liquid_water: "supercooled",
  mixed_phase: "mixed",
  ice: "ice",
  unknown: "unknown",
};

type Scene = { cells: Grid; validTime: string };

export class CloudPhaseService {
  private cache: { scene: Scene; fetchedAt: number } | null = null;
  private inflight: Promise<Scene> | null = null;
  private archive = new Map<string, Scene>();
  private archiveInflight = new Map<string, Promise<Scene>>();

  /**
   * Observed cloud-top phase on the 12 km grid, as the codes above.
   *
   * The scan's own time rides along because the join reports it: an observed
   * check is only worth what its currency is, and a phase scan from 40 minutes
   * ago is not a check on what the model says is happening now.
   */
  async phaseField(at?: Date): Promise<Scene> {
    return this.scene(at);
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
   * A past scene, keyed by the S3 object rather than the requested time, so
   * neighbouring requests share one build. No TTL — a scan from last May will
   * not be rescanned.
   */
  private async replay(at: Date): Promise<Scene> {
    const key = await pairedKeyAt(PRODUCT, at, SCENE_TOLERANCE_MS);

    const cached = this.archive.get(key);
    if (cached) return cached;

    const running = this.archiveInflight.get(key);
    if (running) return running;

    const work = this.build(key, at)
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

  private async build(key?: string, at?: Date): Promise<Scene> {
    const sceneKey = key ?? (await latestPairedKey(PRODUCT));

    // The profile grid is only wanted for its geometry — this product carries
    // no temperature and needs none. It is the same build the cloud-top layer
    // and the join already wait on, so asking for it here costs nothing.
    const [buffer, column] = await Promise.all([
      download(sceneKey),
      Hrrr.column(ANALYSIS_HOUR, at),
    ]);

    const { grid, phase } = await this.decode(buffer);
    const values = resample(grid, phase, column.geo);

    return {
      cells: { nx: column.geo.nx, ny: column.geo.ny, values },
      validTime: sceneTime(sceneKey),
    };
  }

  /**
   * Read the scene: the projection constants, and one class per pixel already
   * translated out of the product's numbering into ours.
   */
  private async decode(
    buffer: Buffer
  ): Promise<{ grid: AbiGrid; phase: Uint8Array }> {
    return readScene(buffer, (file) => {
      const grid = gridOf(file, "Phase");
      const node = file.get("Phase");

      const lookup = classify(
        text(node, "flag_meanings"),
        node.attrs["flag_values"]?.value as ArrayLike<number> | undefined
      );
      const fill = scalar(node, "_FillValue");

      const raw = node.value;
      const phase = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) {
        // A pixel the product declined to classify is `unknown`, which is the
        // honest answer and a different one from clear sky.
        phase[i] =
          raw[i] === fill
            ? PHASE.unknown
            : (lookup.get(raw[i]) ?? PHASE.unknown);
      }

      return { grid, phase };
    });
  }
}

export const GoesPhase = new CloudPhaseService();

/**
 * The scene's stored numbers, mapped onto ours.
 *
 * Built from `flag_meanings` and `flag_values` rather than from a table here,
 * so a product that renumbers or reorders its classes still decodes. A class
 * name we do not recognise maps to `unknown` rather than being guessed at.
 *
 * `flag_values` is absent from some scenes, in which case the values are the
 * positions — which is what the product publishes when it publishes both.
 */
export function classify(
  meanings: string,
  values?: ArrayLike<number>
): Map<number, number> {
  const names = meanings.trim().split(/\s+/);
  const lookup = new Map<number, number>();

  for (let i = 0; i < names.length; i++) {
    const stored = values && i < values.length ? Number(values[i]) : i;
    lookup.set(stored, PHASE[PUBLISHED[names[i]] ?? "unknown"]);
  }

  return lookup;
}

/**
 * Fold the 2 km scene onto the 12 km grid every other field sits on.
 *
 * Mapped **grid cell → pixel**, like the cloud-top service and for the same
 * reason: the forward geostationary projection is exact arithmetic, so each
 * cell indexes straight into the image.
 *
 * **A class cannot be averaged, so this counts instead.** A cell is clear
 * unless most of its pixels hold cloud, and it then takes the commonest class
 * among the cloudy ones. Commonest rather than a share above some cutoff,
 * because a cutoff would be a number nothing in the literature sets.
 *
 * **The majority rule has the same shape as the cloud-top layer's and does not
 * give the same answer.** There a pixel counts as cloudy when the height
 * retrieval produced a pressure; here it counts when the classifier called it
 * anything other than clear sky, which includes the pixels it declined to
 * classify. The two retrievals also fail over different ground, and the height
 * one is weakest over low warm liquid cloud. So a cell can carry an observed
 * liquid top while the cloud-top layer reports clear sky over it, and the panel
 * prints both — see `MEASUREMENTS.md` §4.
 */
export function resample(
  grid: AbiGrid,
  phase: Uint8Array,
  geo: Geo
): Float32Array {
  const out = new Float32Array(geo.lats.length).fill(PHASE.unknown);
  const half = Math.floor(WINDOW / 2);
  const counts = new Int32Array(PHASE_NAMES.length);

  for (let cell = 0; cell < geo.lats.length; cell++) {
    const at = pixelAt(grid, geo.lats[cell], geo.lons[cell]);
    if (!at) continue;
    const [col, row] = at;

    counts.fill(0);
    let seen = 0;
    for (let dy = -half; dy < WINDOW - half; dy++) {
      const r = row + dy;
      if (r < 0 || r >= grid.ny) continue;
      for (let dx = -half; dx < WINDOW - half; dx++) {
        const c = col + dx;
        if (c < 0 || c >= grid.nx) continue;
        seen++;
        counts[phase[r * grid.nx + c]]++;
      }
    }

    // Off the edge of the scan. Not clear sky and not cloud: unlooked at.
    if (seen === 0) continue;

    const cloudy = seen - counts[PHASE.clear];
    if (cloudy * 2 < seen) {
      out[cell] = PHASE.clear;
      continue;
    }

    let best: CloudPhase = "unknown";
    let most = -1;
    for (const name of COLDEST_FIRST) {
      if (counts[PHASE[name]] > most) {
        most = counts[PHASE[name]];
        best = name;
      }
    }
    out[cell] = PHASE[best];
  }

  return out;
}
