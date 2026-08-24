/**
 * Pack the 2025 snapshot — `data/`, `cache/`, `out/` — into one archive that
 * extracts at the repository root.
 *
 * `node eval/pack.mjs`
 *
 * Writes `eval/eval-2025-v1.tar.gz`. Refuses to pack if `verify.mjs` would
 * fail. Does not delete anything.
 */

// Node
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const ARCHIVE = "eval-2025-v1.tar.gz";
const DEST = join(HERE, ARCHIVE);

const verified = spawnSync(process.execPath, [join(HERE, "verify.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
if (verified.status !== 0) process.exit(verified.status ?? 1);

console.log(`packing ${ARCHIVE}`);
const packed = spawnSync(
  "tar",
  ["-czf", DEST, "eval/data", "eval/cache", "eval/out"],
  { cwd: ROOT, stdio: "inherit" }
);
if (packed.status !== 0) process.exit(packed.status ?? 1);

console.log(`wrote eval/${ARCHIVE}`);
