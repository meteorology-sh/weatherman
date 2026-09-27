/**
 * Where the Weatherman server is, and how to ask it about one point.
 *
 * Every script here reads the product's own API rather than recomputing
 * anything, so this is the only place the address is written down.
 */

export const SERVER = process.env.WEATHERMAN_SERVER ?? "http://localhost:3000";

/**
 * Every API this process may talk to, from `WEATHERMAN_SERVERS`.
 *
 * **One address is one event loop.** A Weatherman API is a single Node process
 * and a cold build occupies it for 40-60 s, so two requests to one address
 * queue rather than overlap and concurrency there buys nothing. Work is spread
 * by handing each task its own address instead, which is why a season starts
 * one container per painter.
 *
 * Comma-separated. Falls back to the single `SERVER`, so a script that reads
 * this runs unchanged against one API.
 */
export const SERVERS = (process.env.WEATHERMAN_SERVERS ?? SERVER)
  .split(",")
  .map((address) => address.trim())
  .filter(Boolean);

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

/**
 * The radar storm containing this point, or the nearest one, at this hour.
 * Null when that window has no echo at 20 dBZ.
 */
export async function stormNear(lat, lon, at) {
  const url = new URL("/candidate/storm", SERVER);
  url.searchParams.set("lat", lat);
  url.searchParams.set("lon", lon);
  url.searchParams.set("at", at);
  url.searchParams.set("fine", "1");

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) {
    throw new Error(`${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  return res.json();
}
