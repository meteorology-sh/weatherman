/**
 * Getting bytes out of HRRR, from either of its two origins.
 *
 * One job: resolve which cycle to read, find a record's byte range in the
 * `.idx`, and fetch it. It knows nothing about what the records mean — no
 * fields, no contours, no seeding band — so the service above it can be read
 * without the fetching, and the fetching can be read without the meteorology.
 *
 * **Every quiet failure this app has hit against the archive lives here**, next
 * to the code that avoids it: S3 ignoring multi-range requests, the
 * `CLWMR`/`CLMR` rename, and the publication lag. `MEASUREMENTS.md` §5 records
 * why each one is silent rather than loud.
 */

// Services
import { eachMessage } from "./grib";
import { POINTS } from "./grid";

const HRRR = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/hrrr/prod";

/**
 * The keyless HRRR archive, and the only way to run this app in a season other
 * than the one you are standing in. NOMADS keeps roughly two days; this goes
 * back years, which is what a corpus of real Texas seeding days needs.
 *
 * The path *after* the base is identical to NOMADS', so `gribUrl` differs by one
 * string. Everything else about the archive differs in ways that fail quietly —
 * see `fetchRanges` and `CLWMR_NAME`.
 */
const HRRR_ARCHIVE = "https://noaa-hrrr-bdp-pds.s3.amazonaws.com";

/**
 * Where a cycle's files come from. Not a preference — the two origins need
 * different request shapes and different field names, so the choice has to
 * travel with the run rather than being read from a flag at the bottom.
 */
export type Origin = "nomads" | "archive";

/** A resolved HRRR cycle: which run, and where its files live. */
export type Cycle = { run: Date; origin: Origin };

/**
 * The two HRRR products we read. `wrfsfc` carries the 2D diagnostics; `wrfprs`
 * carries the 3D fields on 25 mb pressure levels and is ~430 MB, which is why
 * nothing here ever downloads a whole file — only byte ranges named by the .idx.
 */
export type Product = "wrfsfc" | "wrfprs";

/**
 * Cloud water mixing ratio is named differently by the two origins.
 *
 * Same parameter, same eccodes `shortName` (`clwmr`) once decoded — only the
 * `.idx` lookup sees the difference, and it fails as though the field were
 * missing rather than renamed. Confirmed against a 2025-05-15 archive index.
 */
export const CLWMR_NAME: Record<Origin, string> = {
  nomads: "CLWMR",
  archive: "CLMR",
};

/**
 * How recent a replayed cycle may be.
 *
 * The archive is mirrored promptly — measured on 2026-08-13, the 05z index was
 * already there at 06:27 UTC — so this is not an archive-lag allowance. It is
 * just the cycle's own publication delay: HRRR posts ~50 min after the hour, so
 * asking for a cycle less than an hour old gets a 404 that reads like a bug.
 * Live requests omit `at` and discover the newest published run instead.
 */
const ARCHIVE_LAG_MS = 60 * 60_000;

/** How long a discovered live run is trusted before it is looked up again. */
const RUN_TTL_MS = 5 * 60_000;

/**
 * A row of the `.idx`. It lists start offsets only, so a record ends where the
 * next begins and the final record cannot be bounded (`end: NaN`) — callers
 * that select it must say so rather than requesting an open range on a 430 MB
 * file.
 */
export type IdxRow = {
  name: string;
  level: string;
  start: number;
  end: number;
};

/** The cycle a replayed timestamp names: its hour, truncated. */
export function floorHour(at: Date): Date {
  return new Date(
    Date.UTC(
      at.getUTCFullYear(),
      at.getUTCMonth(),
      at.getUTCDate(),
      at.getUTCHours()
    )
  );
}

/**
 * The archive holds published cycles only.
 *
 * A future timestamp has no files at all, and the newest cycles are still on
 * NOMADS rather than mirrored — asking the archive for the last couple of hours
 * gets a 404 that reads like a bug. Refuse both plainly instead.
 */
export function assertAt(at: Date) {
  if (Number.isNaN(at.getTime())) {
    throw new Error("`at` must be an ISO 8601 timestamp");
  }
  if (Date.now() - at.getTime() < ARCHIVE_LAG_MS) {
    throw new Error(
      "`at` must name a cycle at least an hour old — HRRR posts ~50 min after " +
        "the hour. Omit `at` for the current run."
    );
  }
}

export function gribUrl(cycle: Cycle, hour: number, product: Product) {
  const { run, origin } = cycle;
  const d = run.toISOString().slice(0, 10).replace(/-/g, "");
  const cc = String(run.getUTCHours()).padStart(2, "0");
  const fh = String(hour).padStart(2, "0");
  const base = origin === "archive" ? HRRR_ARCHIVE : HRRR;
  return `${base}/hrrr.${d}/conus/hrrr.t${cc}z.${product}f${fh}.grib2`;
}

export function idxUrl(cycle: Cycle, hour: number, product: Product) {
  return `${gribUrl(cycle, hour, product)}.idx`;
}

/** The `.idx` as rows, each bounded by the start of the next. */
export async function index(
  cycle: Cycle,
  hour: number,
  product: Product
): Promise<IdxRow[]> {
  const res = await fetch(idxUrl(cycle, hour, product));
  if (!res.ok) {
    throw new Error(`HRRR index unavailable: ${res.status}`);
  }
  const rows = (await res.text())
    .trim()
    .split("\n")
    .map((l) => l.split(":"));
  return rows.map((r, i) => ({
    name: r[3],
    level: r[4],
    start: Number(r[1]),
    end: rows[i + 1] ? Number(rows[i + 1][1]) - 1 : NaN,
  }));
}

/** Byte range of a named record, or a clear failure naming what is missing. */
export function pick(
  rows: IdxRow[],
  name: string,
  level: string
): [number, number] {
  const row = rows.find((r) => r.name === name && r.level === level);
  if (!row) throw new Error(`${name} at ${level} not present in HRRR index`);
  if (!Number.isFinite(row.end)) {
    throw new Error(`Could not bound ${name} at ${level}`);
  }
  return [row.start, row.end];
}

/** Most recent cycle whose f00 index is published. Re-checked every 5 min. */
export class RunDiscovery {
  private cache: { run: Date; checkedAt: number } | null = null;

  async latest(): Promise<Date> {
    if (this.cache && Date.now() - this.cache.checkedAt < RUN_TTL_MS) {
      return this.cache.run;
    }

    const now = new Date();
    // HRRR posts ~50 min after the hour; walk back until an index exists.
    for (let back = 1; back <= 6; back++) {
      const run = new Date(
        Date.UTC(
          now.getUTCFullYear(),
          now.getUTCMonth(),
          now.getUTCDate(),
          now.getUTCHours() - back
        )
      );
      const res = await fetch(idxUrl({ run, origin: "nomads" }, 0, "wrfsfc"), {
        method: "HEAD",
      });
      if (res.ok) {
        this.cache = { run, checkedAt: Date.now() };
        return run;
      }
    }
    throw new Error("No published HRRR run found in the last 6 cycles");
  }
}

/**
 * Fetch byte ranges and return them concatenated in file order.
 *
 * NOMADS honours multi-range requests, and GRIB2 records are self-contained,
 * so N ranges come back in one round trip and concatenate straight into a
 * valid N-message GRIB2 file. That is what keeps a 50-record read to a single
 * request instead of 50. The archive cannot do this — see below.
 */
export async function fetchRanges(
  url: string,
  ranges: [number, number][],
  origin: Origin = "nomads"
): Promise<Buffer> {
  if (origin === "archive") return fetchRangesOneByOne(url, ranges);

  const res = await fetch(url, {
    headers: {
      Range: `bytes=${ranges.map(([a, b]) => `${a}-${b}`).join(",")}`,
    },
  });
  if (!res.ok) throw new Error(`HRRR fetch failed: ${res.status}`);
  const body = Buffer.from(await res.arrayBuffer());
  const type = res.headers.get("content-type") ?? "";
  // A single range comes back raw; several come back multipart.
  return type.toLowerCase().startsWith("multipart/")
    ? concatParts(body, type)
    : body;
}

/**
 * Fetch byte ranges from the archive, **one request per range**, asserting that
 * each comes back `206`.
 *
 * This is not a stylistic difference from the NOMADS path. **S3 ignores
 * multi-range requests**: it answers a 16-range header with `200 OK` and the
 * entire ~398 MB object, not a `416` and not an error. The identical code path
 * would silently download 400x too much and then decode all 708 records, and
 * the result would be *correct* — which is exactly why it has to be caught here
 * rather than noticed later. Asserting `206` turns a silent cost into a loud
 * failure.
 *
 * GRIB2 records are self-contained, so the parts concatenate into a valid
 * multi-message file **in the order requested**, which the caller relies on:
 * the seeding build pairs each TMP record with the CLWMR that follows it.
 */
export async function fetchRangesOneByOne(
  url: string,
  ranges: [number, number][]
): Promise<Buffer> {
  const parts: Buffer[] = [];
  for (const [start, end] of ranges) {
    const res = await fetch(url, {
      headers: { Range: `bytes=${start}-${end}` },
    });
    if (res.status !== 206) {
      throw new Error(
        `HRRR archive ignored the byte range (got ${res.status}, expected 206) — ` +
          `refusing to download the whole object`
      );
    }
    parts.push(Buffer.from(await res.arrayBuffer()));
  }
  return Buffer.concat(parts);
}

/**
 * Concatenate the parts of a multipart/byteranges body in file order.
 *
 * Ordering is explicit rather than assumed: GRIB2 messages are self-contained,
 * but the caller pairs TMP with the CLWMR that follows it, and that pairing is
 * only sound if the parts land in the order the file stores them.
 */
export function concatParts(body: Buffer, contentType: string): Buffer {
  const found = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentType);
  if (!found) throw new Error("multipart response without a boundary");
  const boundary = Buffer.from(`--${(found[1] ?? found[2]).trim()}`);

  const parts: { offset: number; data: Buffer }[] = [];
  let pos = body.indexOf(boundary);
  while (pos >= 0) {
    const headEnd = body.indexOf("\r\n\r\n", pos);
    if (headEnd < 0) break;
    const head = body.toString("latin1", pos, headEnd);
    const next = body.indexOf(boundary, headEnd);
    let stop = next < 0 ? body.length : next;
    // The CRLF before the next boundary belongs to the framing, not the record.
    if (body[stop - 2] === 0x0d && body[stop - 1] === 0x0a) stop -= 2;

    const range = /Content-Range:\s*bytes\s+(\d+)-/i.exec(head);
    if (range) {
      parts.push({
        offset: Number(range[1]),
        data: body.subarray(headEnd + 4, stop),
      });
    }
    if (next < 0) break;
    pos = next;
  }
  if (parts.length === 0) throw new Error("multipart response had no parts");

  parts.sort((a, b) => a.offset - b.offset);
  return Buffer.concat(parts.map((p) => p.data));
}

/**
 * Stream a multi-message HRRR GRIB, one callback per message.
 *
 * The decoding itself lives in ./grib, which the radar service uses too; this
 * only names the keys HRRR is read by and turns the level back into a number.
 */
export function eachHrrrMessage(
  grib: Buffer,
  onMessage: (name: string, level: number, values: Float32Array) => void
): Promise<void> {
  return eachMessage(
    grib,
    {
      keys: ["shortName", "level"],
      points: POINTS,
      onMessage: ([name, level], values) =>
        onMessage(name, Number(level), values),
    },
    "hrrr-msg"
  );
}
