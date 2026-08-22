/**
 * The other Texas programmes' 2025 reports, on disk.
 *
 * `node eval/records.mjs [--region=transpecos]` — downloads what
 * `data/<region>-2025.json` lists into `eval/cache/<region>/`, skipping
 * anything already there. With no region it does every programme that has a
 * manifest.
 *
 * **It fetches and nothing else.** `releases.mjs` and `panhandle.mjs` both
 * download and parse, because parsing is what they are for; this is the way to
 * pull a programme's documents down without parsing them — to look at a layout
 * before writing against it, or to warm the cache for a run that will parse
 * every region in turn.
 *
 * **A document is checked for being a PDF and kept whole.** The sources are
 * three different hosts with three different ideas of a URL — a storage bucket
 * that serves by id, a site that serves by file id, and a Google Doc exported
 * on request — so the manifest carries the resolved URL rather than a template
 * this script would have to know how to fill.
 */

// Node
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const CACHE = join(HERE, "cache");
const DATA = join(HERE, "data");

const ONLY = process.argv.find((arg) => arg.startsWith("--region="))?.slice(9);

/** Every programme with a manifest of documents, in the order they are listed. */
const { regions } = JSON.parse(
  await readFile(join(DATA, "regions.json"), "utf8")
);

const wanted = regions.filter(
  (region) => region.reports && (!ONLY || region.id === ONLY)
);

if (!wanted.length) {
  console.error(
    ONLY
      ? `no manifest for "${ONLY}" — try ${regions
          .filter((region) => region.reports)
          .map((region) => region.id)
          .join(", ")}`
      : "no region has a manifest"
  );
  process.exit(1);
}

/** A PDF starts `%PDF`. Anything else is an error page wearing a .pdf name. */
function isPdf(body) {
  return body.subarray(0, 4).toString("latin1") === "%PDF";
}

for (const region of wanted) {
  const manifest = JSON.parse(
    await readFile(join(DATA, region.reports), "utf8")
  );

  // WTWMA's manifest is the parser's input rather than a download list, and
  // `releases.mjs` fetches those reports as part of reading them.
  if (!manifest.documents) {
    console.log(`${region.id.padEnd(11)} downloaded by releases.mjs\n`);
    continue;
  }

  const into = join(CACHE, region.id);
  await mkdir(into, { recursive: true });
  const have = new Set(await readdir(into));

  let fetched = 0;
  let bytes = 0;
  const failures = [];

  const count = manifest.documents.length;
  console.log(`${region.name} — ${count} document${count === 1 ? "" : "s"}`);

  for (const document of manifest.documents) {
    if (have.has(document.file)) continue;
    try {
      const res = await fetch(document.url);
      if (!res.ok) throw new Error(`${res.status}`);
      const body = Buffer.from(await res.arrayBuffer());
      if (!isPdf(body)) throw new Error(`not a PDF (${body.length} bytes)`);
      await writeFile(join(into, document.file), body);
      fetched += 1;
      bytes += body.length;
      console.log(
        `  ${document.file.padEnd(34)} ${(body.length / 1024).toFixed(0)} kB`
      );
    } catch (failure) {
      failures.push(`${document.file}: ${failure.message}`);
      console.log(`  ${document.file.padEnd(34)} ${failure.message}`);
    }
  }

  console.log(
    `  ${fetched} fetched, ${manifest.documents.length - fetched - failures.length} already here, ` +
      `${failures.length} failed, ${(bytes / 1024 / 1024).toFixed(1)} MB\n`
  );
}
