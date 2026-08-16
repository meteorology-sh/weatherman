/**
 * Asking the join what it said about the cell a flare was released into.
 *
 * Shared by `points.mjs`, which does one day and prints it, and `season.mjs`,
 * which does every day and pools them. Two copies of this would drift, and the
 * pooled figure has to be the same arithmetic as the single-day one or the
 * season table is not a sum of the cases.
 */

export const SERVER = process.env.WEATHERMAN_SERVER ?? "http://localhost:3000";

/**
 * The HRRR cycle a release is scored against.
 *
 * `at` names the cycle and the join runs at the analysis hour only, so a
 * release is compared against whichever analysis it sits closest to — 1843Z is
 * 17 minutes from the 19z analysis and 43 from the 18z, so it belongs to 19z.
 * The gap is carried on every row because it is the largest source of slop in
 * the whole test.
 */
export function cycleFor(at) {
  const time = new Date(at);
  const cycle = new Date(time);
  cycle.setUTCMinutes(0, 0, 0);
  if (time.getUTCMinutes() >= 30) cycle.setUTCHours(cycle.getUTCHours() + 1);
  return {
    cycle: cycle.toISOString(),
    gapMinutes: Math.round(Math.abs(time - cycle) / 60000),
  };
}

/**
 * How long to wait for one answer.
 *
 * A cold build of five sources off the archive runs 40–60 s, so this is
 * generous rather than tight. **It exists because `fetch` has none.** A build
 * can wedge — an archive connection that stalls never resolves and never
 * rejects — and because concurrent requests for a cycle are collapsed onto one
 * promise, every later request for that cycle waits on the same dead one. A
 * sweep with no timeout sits there indefinitely, using no CPU and printing
 * nothing, which is indistinguishable from working.
 */
const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

export async function point(lat, lon, at) {
  const url = new URL("/candidate/point", SERVER);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("at", at);

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return { outsideDomain: true };
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}

/**
 * How far each input the join used sat from the moment the flare left.
 *
 * Read back off the answer rather than assumed, because only the server knows
 * which scan it actually reached: it picks the nearest one either side and
 * refuses anything more than 30 minutes away, so the gap is a result and not a
 * property of the request.
 */
export function gapsFor(at, answer) {
  if (!answer || answer.error || answer.outsideDomain) return null;
  const t = new Date(at).getTime();
  const minutes = (iso) =>
    iso ? Math.round((new Date(iso).getTime() - t) / 60000) : null;

  return {
    model: minutes(answer.validTime),
    satellite: minutes(answer.sceneTime),
    radar: minutes(answer.radarTime),
  };
}

/** A release with no position cannot be asked about; it is counted, not dropped. */
export function locatedReleases(day) {
  return day.releases
    .filter((release) => release.located)
    .map((release) => ({ ...release, ...cycleFor(release.at) }))
    .sort((a, b) => a.cycle.localeCompare(b.cycle) || a.at.localeCompare(b.at));
}

/**
 * Every located release of one day, asked of the join.
 *
 * **Worked cycle by cycle, in order.** Every cycle is a cold build of five
 * sources behind an archive that answers one byte range per request, so the
 * first release of an hour pays 30–60 s and the rest come off the same cached
 * join in milliseconds. Sorting by cycle is the difference between one build
 * per hour and one per release.
 *
 * `onRow` is called as each answer lands so a caller can print progress
 * without this having to know how it wants to look.
 */
export async function evaluateDay(day, onRow, { precise = false } = {}) {
  const rows = [];

  // A wedged build fails every release of that cycle, not just the first, and
  // each failure costs the full timeout. Once a cycle has timed out there is
  // nothing to learn by asking it again, so the rest of its releases are
  // failed straight away and the day carries on to the next cycle.
  const wedged = new Set();

  for (const release of locatedReleases(day)) {
    // Hourly asks share one build per cycle. A precise ask is its own build,
    // because the scene is cached under the timestamp it was asked for — so
    // this trades one download per hour for one per flare, and buys a radar
    // scan from the minute of the release instead of the top of the hour.
    const asked = precise ? release.at : release.cycle;

    let answer;
    if (!precise && wedged.has(release.cycle)) {
      answer = { error: "cycle timed out earlier" };
    } else {
      try {
        answer = await point(release.lat, release.lon, asked);
      } catch (error) {
        answer = { error: error.message };
        if (error.name === "TimeoutError") wedged.add(release.cycle);
      }
    }
    const row = { release, asked, answer, gaps: gapsFor(release.at, answer) };
    rows.push(row);
    onRow?.(row);
  }

  return rows;
}

/** What a row counts as: a verdict, or the reason there is no verdict. */
export function outcome(answer) {
  if (answer.error) return "error";
  if (answer.outsideDomain) return "outsideDomain";
  return answer.verdict;
}

export function tally(rows) {
  const counts = {};
  for (const { answer } of rows) {
    const key = outcome(answer);
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * The readings that make a verdict mean something.
 *
 * **`rejectedOnlyByRadar` is exact, not inferred.** The join runs its tests in
 * a fixed order and charges a cell to the first one it fails, so a verdict of
 * `raining` is a statement that every other test passed.
 */
export function summarize(rows) {
  const answered = rows
    .map((row) => row.answer)
    .filter((answer) => !answer.error && !answer.outsideDomain);

  const raining = answered.filter((a) => a.verdict === "raining");
  const tops = answered.map((a) => a.cloudTopC).filter((c) => c !== null);
  const phases = {};
  for (const answer of answered) {
    if (answer.topPhase)
      phases[answer.topPhase] = (phases[answer.topPhase] ?? 0) + 1;
  }

  return {
    releases: rows.length,
    answered: answered.length,
    verdicts: tally(rows),
    rejectedOnlyByRadar: raining.length,
    radarRejectedSlwGM2: raining.map((a) => a.slwGM2).sort((a, b) => a - b),
    withBandLiquid: answered.filter((a) => a.slwGM2 > 0).length,
    // A top warmer than the band's warm edge means the band was above the
    // cloud entirely — there was nothing in it to seed yet.
    topWarmerThanBand: tops.filter((c) => c > -5).length,
    noModelledCloudBase: answered.filter((a) => a.cloudBaseFt === null).length,
    topPhases: phases,
    peakSlwGM2: Math.max(0, ...answered.map((a) => a.slwGM2)),
  };
}
