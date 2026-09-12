/**
 * Which season a script works on, and where that season's files live.
 *
 * **Every season keeps its own directories**: `data/<season>/` for its region
 * list, report manifests and parsed flight records, `cache/<season>/` for the
 * reports themselves, and `out/<season>/` for the days painted from them.
 * Nothing in them carries from one year to the next — permit areas, radial
 * origins and report layouts all move — so no season reads another's. The
 * county boundaries are geography rather than a season, and stay in `data/`
 * for every season to share.
 *
 * `--season=YYYY`, or `EVAL_SEASON` for a process started without arguments,
 * picks one. Without either a script works on the latest season `data/`
 * holds.
 */

// Node
import { readdirSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const EVAL = join(dirname(fileURLToPath(import.meta.url)), "..");

/** The county boundaries every season is checked against. */
export const COUNTIES = join(EVAL, "data", "counties-tx.geojson");

/** Every season `data/` holds, oldest first. */
export function seasons() {
  let entries;
  try {
    entries = readdirSync(join(EVAL, "data"), { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
  return entries
    .filter((entry) => entry.isDirectory() && /^\d{4}$/.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

/** The season this process was asked for. Exits naming the ones there are. */
export function seasonOf(argv = process.argv, env = process.env) {
  const asked =
    argv.find((arg) => arg.startsWith("--season="))?.slice(9) ??
    env.EVAL_SEASON;
  const known = seasons();
  if (asked) {
    if (known.includes(asked)) return asked;
    console.error(
      `no season ${asked} in eval/data/ — try ${known.join(", ") || "none"}`
    );
    process.exit(1);
  }
  if (!known.length) {
    console.error(
      "no season in eval/data/ — a season is a directory, eval/data/YYYY/"
    );
    process.exit(1);
  }
  return known.at(-1);
}

/** A season's three directories. */
export function seasonDirs(season) {
  return {
    season,
    data: join(EVAL, "data", season),
    cache: join(EVAL, "cache", season),
    out: join(EVAL, "out", season),
  };
}

/** A season's region list, from its own `regions.json`. */
export async function regionsOf(season) {
  const { regions } = JSON.parse(
    await readFile(join(seasonDirs(season).data, "regions.json"), "utf8")
  );
  return regions;
}
