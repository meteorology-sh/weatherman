/**
 * Where the Weatherman server is, and how to ask it about one point.
 *
 * Every script here reads the product's own API rather than recomputing
 * anything, so this is the only place the address is written down.
 */

export const SERVER = process.env.WEATHERMAN_SERVER ?? "http://localhost:3000";

/**
 * How long to wait for one answer.
 *
 * A cold build of five sources off the archive runs 40–60 s, so this is
 * generous rather than tight. **It exists because `fetch` has none.** A build
 * can wedge — an archive connection that stalls never resolves and never
 * rejects — and because concurrent requests for a cycle are collapsed onto one
 * promise, every later request for that cycle waits on the same dead one. A run
 * with no timeout sits there indefinitely, using no CPU and printing nothing,
 * which is indistinguishable from working.
 */
const TIMEOUT_MS = Number(process.env.WEATHERMAN_TIMEOUT_MS ?? 240_000);

/** What the server said about the cell holding this point at this time. */
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
