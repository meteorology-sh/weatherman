/**
 * The two ABI products the join reads, and the rule that they come from one
 * scan.
 *
 * GOES-East sweeps CONUS every 5 minutes and NOAA publishes a separate file per
 * product from each sweep. **They do not land together.** The phase file
 * appears first and the pressure file follows it by roughly a minute, so for
 * about a minute in every five the newest phase scan is one sweep ahead of the
 * newest pressure scan.
 *
 * Asking each product for its own newest file lands inside that window about a
 * fifth of the time, and the join then describes one cloud with its top height
 * measured at one moment and its top phase at another. Five minutes is enough
 * for a cell's cloud to drift into the next cell at ordinary storm speeds, and
 * enough for a turret to freeze over — which is the change the outline exists
 * to show. So the two are never asked separately.
 *
 * **The sweep is resolved once and both products build from it.** The answer is
 * the newest scan both have published, which during that window is up to five
 * minutes older than the newest phase file. That is the trade this module
 * makes: one moment reported slightly late, rather than two moments reported as
 * one.
 */

// Services
import { keysInHour, sceneTime } from "./scene";

/**
 * `ABI-L2-ACHP2KMC` is cloud-top **pressure**, CONUS sector, 2 km — 4.1 MB a
 * scene, a new scene every 5 minutes, keyless.
 *
 * Pressure rather than the `ACHT` cloud-top *temperature* product because there
 * is no CONUS variant of that one: it is published full-disk and mesoscale only.
 * That turns out to be the better accident anyway — pressure is the same
 * variable HRRR's own `PRES:cloud top` carries, so the two sources are
 * interchangeable behind the cloud-top service if the observed feed ever fails.
 */
export const CLOUD_TOP_PRODUCT = "ABI-L2-ACHP2KMC";

/**
 * `ABI-L2-ACTPC` is cloud-top phase, CONUS sector, 2 km — 666 KB a scene, six
 * times smaller than the pressure scene, on the same bucket at the same
 * 5-minute cadence.
 */
export const PHASE_PRODUCT = "ABI-L2-ACTPC";

/** Both halves of a sweep. Nothing here reads one without the other. */
const PAIR = [CLOUD_TOP_PRODUCT, PHASE_PRODUCT] as const;

/**
 * How long a resolved live sweep stands.
 *
 * Matched to one scan, like the caches in the services above this. It is what
 * makes the pairing hold rather than merely be likely: the join awaits both
 * products in one `Promise.all`, so both reach this within microseconds of each
 * other and take the same answer, and a scan's worth of TTL keeps a second
 * caller in the same sweep rather than resolving a fresh one underneath it.
 */
const CACHE_TTL_MS = 5 * 60_000;

/** Resolved archive sweeps never change, so a handful are kept. */
const ARCHIVE_CACHE = 8;

/** One sweep, as the key each product filed it under. */
type Sweep = Record<string, string>;

let cache: { sweep: Sweep; resolvedAt: number } | null = null;
let inflight: Promise<Sweep> | null = null;
const archive = new Map<string, Sweep>();
const archiveInflight = new Map<string, Promise<Sweep>>();

/**
 * The newest scan both products have published, as this product's key.
 *
 * Callers name their own product and get their own file; the sweep behind it is
 * the same one the other product is being handed.
 */
export async function latestPairedKey(product: string): Promise<string> {
  return keyIn(await latestSweep(), product);
}

/**
 * The archived scan nearest `at` that both products published, as this
 * product's key.
 *
 * `tolerance` is the caller's, as it is for a single product: a sweep further
 * away than that means a gap in the record, and answering with the closest
 * thing would caption an unrelated scan with the time that was asked for. It is
 * measured against the *paired* scan, so a sweep only one product filed is not
 * what a replayed hour is built from.
 */
export async function pairedKeyAt(
  product: string,
  at: Date,
  tolerance: number
): Promise<string> {
  if (Number.isNaN(at.getTime())) {
    throw new Error("`at` must be an ISO 8601 timestamp");
  }

  const key = at.toISOString();
  const cached = archive.get(key);
  if (cached) return keyIn(cached, product);

  const running = archiveInflight.get(key);
  if (running) return keyIn(await running, product);

  const work = resolveAt(at, tolerance)
    .then((sweep) => {
      archive.set(key, sweep);
      while (archive.size > ARCHIVE_CACHE) {
        archive.delete(archive.keys().next().value!);
      }
      return sweep;
    })
    .finally(() => archiveInflight.delete(key));

  archiveInflight.set(key, work);
  return keyIn(await work, product);
}

/** A product that is not half of the pair is a caller bug, not a data gap. */
function keyIn(sweep: Sweep, product: string): string {
  const key = sweep[product];
  if (!key)
    throw new Error(`${product} is not one of the paired GOES products`);
  return key;
}

/** The live sweep, resolved once and shared until it ages out. */
async function latestSweep(): Promise<Sweep> {
  if (cache && Date.now() - cache.resolvedAt < CACHE_TTL_MS) return cache.sweep;
  if (inflight) return inflight;

  const work = resolveLatest()
    .then((sweep) => {
      cache = { sweep, resolvedAt: Date.now() };
      return sweep;
    })
    .finally(() => {
      inflight = null;
    });

  inflight = work;
  return work;
}

/**
 * Walk back an hour at a time until an hour holds a scan both products filed.
 *
 * The walk covers the hour boundary — at 00:02 UTC the current hour may hold
 * nothing yet — and gives up rather than silently serving something stale. It
 * accumulates across hours because the newest *shared* scan can be in an
 * earlier hour than the newest scan of either product alone.
 */
async function resolveLatest(): Promise<Sweep> {
  const now = Date.now();
  const filed: Record<string, Map<number, string>> = {
    [CLOUD_TOP_PRODUCT]: new Map(),
    [PHASE_PRODUCT]: new Map(),
  };

  for (let back = 0; back < 4; back++) {
    const hour = new Date(now - back * 3_600_000);
    await Promise.all(
      PAIR.map(async (product) => {
        for (const key of await keysInHour(product, hour)) {
          const t = Date.parse(sceneTime(key));
          if (!Number.isNaN(t)) filed[product].set(t, key);
        }
      })
    );

    const shared = [...filed[CLOUD_TOP_PRODUCT].keys()].filter((t) =>
      filed[PHASE_PRODUCT].has(t)
    );
    if (shared.length) return sweepAt(filed, Math.max(...shared));
  }

  throw new Error(
    "No GOES sweep with both cloud-top pressure and phase published in the " +
      "last 4 hours"
  );
}

/**
 * The archived sweep nearest `at` that both products filed.
 *
 * Lists the hour and the one before it, as a single-product lookup does — a
 * scan starting at 13:56 is the nearest neighbor of 14:00 and lives under the
 * previous hour's prefix.
 */
async function resolveAt(at: Date, tolerance: number): Promise<Sweep> {
  const want = at.getTime();
  const filed: Record<string, Map<number, string>> = {
    [CLOUD_TOP_PRODUCT]: new Map(),
    [PHASE_PRODUCT]: new Map(),
  };

  await Promise.all(
    PAIR.map(async (product) => {
      for (const offset of [-1, 0]) {
        const hour = new Date(want + offset * 3_600_000);
        for (const key of await keysInHour(product, hour)) {
          const t = Date.parse(sceneTime(key));
          if (!Number.isNaN(t)) filed[product].set(t, key);
        }
      }
    })
  );

  let best: number | null = null;
  for (const t of filed[CLOUD_TOP_PRODUCT].keys()) {
    if (!filed[PHASE_PRODUCT].has(t)) continue;
    if (best === null || Math.abs(t - want) < Math.abs(best - want)) best = t;
  }

  if (best === null) {
    throw new Error(`No archived GOES sweep near ${at.toISOString()}`);
  }

  const delta = Math.abs(best - want);
  if (delta > tolerance) {
    throw new Error(
      `Nearest GOES sweep to ${at.toISOString()} is ` +
        `${Math.round(delta / 60_000)} min away — refusing to caption it as ` +
        `that time`
    );
  }

  return sweepAt(filed, best);
}

/** The keys both products filed one scan under. */
function sweepAt(
  filed: Record<string, Map<number, string>>,
  scan: number
): Sweep {
  return {
    [CLOUD_TOP_PRODUCT]: filed[CLOUD_TOP_PRODUCT].get(scan)!,
    [PHASE_PRODUCT]: filed[PHASE_PRODUCT].get(scan)!,
  };
}

/** Drop every resolved sweep. Exported for the tests, which share a module. */
export function forget(): void {
  cache = null;
  inflight = null;
  archive.clear();
  archiveInflight.clear();
}
