/**
 * The `at` query parameter, shared by every router that can replay.
 *
 * Shared infrastructure with no source of its own, like `contour.ts` and
 * `grib.ts` beside it: all three routers accept the same parameter and must read it the
 * same way, and three copies of this would drift.
 *
 * **Absent means live.** That is the whole contract — a request without `at`
 * behaves exactly as it did before replay existed, so the live map is not
 * routed through a historical code path to get today's weather.
 *
 * Whether the time is *reachable* is a question for the service, not for this:
 * how recent a cycle may be depends on that source's publication lag, and each
 * one knows its own. This only refuses input that is not a timestamp at all.
 */
export function parseAt(value: unknown): Date | undefined {
  if (value === undefined || value === "") return undefined;
  if (typeof value !== "string") {
    throw new Error("`at` must be a single ISO 8601 timestamp");
  }
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) {
    throw new Error(`\`at\` is not a valid timestamp: ${value}`);
  }
  return at;
}

/**
 * The analysis hour a timestamp is closest to.
 *
 * **The model and the instruments do not run at the same rate, and one `at`
 * has to serve both.** ABI scans every 5 minutes and the radar mosaic arrives
 * every 2, so both can answer about 18:43 directly. HRRR analyses once an
 * hour, so it cannot, and truncating sends 18:43 to the 18z analysis — the
 * further of the two, 43 minutes away, when 19z is 17.
 *
 * So the join rounds this half and leaves the observed half on the true
 * timestamp. A whole hour rounds to itself, which is every request the replay
 * page makes.
 *
 * This is the closest reading of the atmosphere at that moment, which is a
 * different thing from what a forecaster could have had in front of them: HRRR
 * posts ~50 minutes after the hour, so nobody had 19z at 18:43. That gap is a
 * limit on operating from this, not on measuring against it.
 */
export function nearestHour(at: Date): Date {
  const hour = new Date(at);
  hour.setUTCMinutes(0, 0, 0);
  if (at.getUTCMinutes() >= 30) hour.setUTCHours(hour.getUTCHours() + 1);
  return hour;
}
