/**
 * Pack the gitignored 2025 v1 tree — `cache/` (the reports) and `out/` (the
 * painted days, balloon runs and between-hours run) — into one archive that
 * extracts at the repository root.
 *
 * `node eval/pack.mjs`
 *
 * Writes `eval/eval-2025-v1.tar.gz` and `eval/v1.sha256`. Refuses to pack if
 * `verify.mjs` would fail. Does not delete anything.
 */

// Node
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const ARCHIVE = "eval-2025-v1.tar.gz";
const DEST = join(HERE, ARCHIVE);
const SUMS = join(HERE, "v1.sha256");

const verified = spawnSync(process.execPath, [join(HERE, "verify.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
if (verified.status !== 0) process.exit(verified.status ?? 1);

console.log(`packing ${ARCHIVE}`);
const packed = spawnSync(
  "tar",
  ["-czf", DEST, "eval/cache", "eval/out"],
  { cwd: ROOT, stdio: "inherit" }
);
if (packed.status !== 0) process.exit(packed.status ?? 1);

const hash = await sha256(DEST);
await writeFile(SUMS, `${hash}  ${ARCHIVE}\n`);
console.log(`wrote eval/${ARCHIVE}`);
console.log(`sha256 ${hash}`);

function sha256(path) {
  return new Promise((resolve, reject) => {
    const sum = createHash("sha256");
    const stream = createReadStream(path);
    stream.on("data", (chunk) => sum.update(chunk));
    stream.on("error", reject);
    stream.on("end", () => resolve(sum.digest("hex")));
  });
}
