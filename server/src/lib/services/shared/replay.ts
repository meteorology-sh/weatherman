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
