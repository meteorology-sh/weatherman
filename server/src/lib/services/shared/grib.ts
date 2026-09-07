/**
 * Running eccodes over a GRIB2 buffer and streaming the values back.
 *
 * One job: turn bytes into Float32Arrays. It knows nothing about HRRR, MRMS,
 * pressure levels or contours — both weather services here decode the same way
 * and only differ in what they do with the numbers.
 *
 * `grib_filter` rather than `grib_get_data` because it prints the values array
 * alone. `grib_get_data` prints a lat/lon for every point of every message,
 * which for a 24.5M-point MRMS grid is ~900 MB of text against ~110 MB here,
 * and three times slower. Callers that need the grid's geometry either compute
 * it (a regular lat/lon grid is arithmetic) or pay for the geo iterator once
 * and cache it (HRRR's Lambert grid never changes).
 */

// Node
import { spawn } from "child_process";
import { mkdtemp, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

/** Marks each message's header line in a multi-record decode. */
export const MARKER = "@@@";

/**
 * `keys` are eccodes key names printed on the header line before each message's
 * values, e.g. `["shortName", "level"]`. They arrive back as raw strings.
 */
export type Decode = {
  keys: readonly string[];
  /** Values per message. A short or long message is an error, never truncated. */
  points: number;
  onMessage: (keys: string[], values: Float32Array) => void;
  /**
   * What a bitmapped-missing point is printed as. eccodes defaults to **9999**,
   * which is safe for a mixing ratio and unsafe for anything measured in
   * meters: HRRR's `HGT:cloud top` carries real values to 15,698 m, so 9999
   * would be read as nodata over genuine deep convection. A field with a
   * bitmap must name a sentinel outside its own physical range.
   */
  missingValue?: number;
};

/**
 * Stream a GRIB2 buffer through grib_filter, one callback per message.
 *
 * Streaming rather than buffering keeps a 50-record read flat in memory instead
 * of gigabytes, and lets the caller fold each message into an accumulator and
 * drop it.
 */
export async function eachMessage(
  grib: Buffer,
  decode: Decode,
  prefix = "grib"
): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), `${prefix}-`));
  const file = join(dir, "stack.grib2");
  const rules = join(dir, "values.filter");
  try {
    await writeFile(file, grib);
    const header = decode.keys.map((k) => `[${k}]`).join(" ");
    const missing =
      decode.missingValue === undefined
        ? ""
        : `set missingValue=${decode.missingValue};\n`;
    await writeFile(
      rules,
      `${missing}print "${MARKER} ${header}";\nprint "[values]";\n`
    );
    await streamValues(rules, file, decode);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Spawn grib_filter and hand back one Float32Array per message, streaming. */
export function streamValues(
  rules: string,
  file: string,
  { points, onMessage }: Decode
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn("grib_filter", [rules, file]);
    let keys: string[] = [];
    let values: Float32Array | null = null;
    let count = 0;
    let carry = "";
    let failed: Error | null = null;

    const flush = () => {
      if (!values) return;
      if (count !== points) {
        failed ??= new Error(
          `message [${keys.join(" ")}] decoded ${count} values, expected ${points}`
        );
      }
      onMessage(keys, values);
      values = null;
    };

    const line = (text: string) => {
      if (text.startsWith(MARKER)) {
        flush();
        keys = text.split(" ").slice(1);
        values = new Float32Array(points);
        count = 0;
        return;
      }
      if (!values) return;
      let p = 0;
      while (p < text.length) {
        let q = text.indexOf(" ", p);
        if (q < 0) q = text.length;
        if (q > p && count < points) values[count++] = Number(text.slice(p, q));
        p = q + 1;
      }
    };

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      const text = carry + chunk;
      const end = text.lastIndexOf("\n");
      if (end < 0) {
        carry = text;
        return;
      }
      carry = text.slice(end + 1);
      for (const l of text.slice(0, end).split("\n")) if (l) line(l);
    });

    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (c: string) => {
      stderr += c;
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (carry) line(carry);
      flush();
      if (code !== 0) {
        return reject(
          new Error(
            `grib_filter exited ${code}: ${stderr.trim().slice(0, 200)}`
          )
        );
      }
      if (failed) return reject(failed);
      resolve();
    });
  });
}
