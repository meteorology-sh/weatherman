/**
 * Seeded days that have a located flare, one date per line.
 *
 * `node eval/days.mjs [--season=2025] [--region=wtwma]`
 *
 * No region flag prints `region<TAB>date` for every program. The AWS
 * season job feeds these dates to `paint.mjs`.
 */

// Node
import { readFile } from "node:fs/promises";
import { join } from "node:path";

// Local
import { regionsOf, seasonDirs, seasonOf } from "./lib/season.mjs";

const SEASON = seasonOf();
const { data: DATA } = seasonDirs(SEASON);

const REGION = process.argv
  .find((arg) => arg.startsWith("--region="))
  ?.slice(9);

const regions = await regionsOf(SEASON);

const wanted = REGION
  ? regions.filter((region) => region.id === REGION)
  : regions.filter((region) => region.releases);

if (REGION && wanted.length === 0) {
  console.error(
    `unknown region "${REGION}" — try ${regions.map((r) => r.id).join(", ")}`
  );
  process.exit(1);
}

for (const region of wanted) {
  if (!region.releases) continue;
  const record = JSON.parse(
    await readFile(join(DATA, region.releases), "utf8")
  );
  for (const day of record.days) {
    if (!day.seeded) continue;
    if (!day.releases.some((release) => release.located)) continue;
    if (REGION) console.log(day.date);
    else console.log(`${region.id}\t${day.date}`);
  }
}
