/**
 * Reading one ABI scene off the archive: finding it, downloading it, and
 * opening it far enough to get at a variable and the geometry it sits on.
 *
 * Two products are read from this bucket — cloud-top pressure and cloud-top
 * phase — and everything except *which variable to pull out* is the same for
 * both. The listing prefix is the product name, the file name carries the scan
 * time, the projection lives in the same four datasets, and the HDF5 runtime is
 * loaded once for all of it.
 *
 * Nothing here knows what a cloud is. It hands back numbers on a grid and the
 * services decide what they mean.
 */

// Services
import { abiGrid } from "./abi";

// Types
import type { AbiGrid } from "./abi";

/** GOES-19 is GOES-East. Keyless, and the same bucket for every product. */
export const BUCKET = "https://noaa-goes19.s3.amazonaws.com";

/**
 * The slice of h5wasm these services use.
 *
 * Declared locally rather than imported: h5wasm is ESM-only and this server is
 * CommonJS, so it is loaded through a dynamic `import()` (see `hdf5()` below)
 * and never appears in a static import position that could be downlevelled to
 * `require()`. Naming the surface we depend on also keeps that surface small
 * and obvious.
 */
type H5Attr = { value: unknown };
export type H5Dataset = {
  shape: number[];
  value: ArrayLike<number>;
  attrs: Record<string, H5Attr>;
};
export type H5File = { get(name: string): H5Dataset; close(): void };
type H5Module = {
  ready: Promise<{
    FS: { writeFile(p: string, d: Uint8Array): void; unlink(p: string): void };
  }>;
  File: new (name: string, mode: string) => H5File;
};

let h5: Promise<H5Module> | null = null;

/**
 * Load h5wasm once, lazily.
 *
 * Lazily because it drags a WebAssembly runtime in with it, and a server whose
 * other routes never touch HDF5 should not pay for that at boot.
 */
function hdf5(): Promise<H5Module> {
  h5 ??= import("h5wasm/node").then(
    (m) => ((m as { default?: H5Module }).default ?? m) as unknown as H5Module
  );
  return h5;
}

/**
 * Open a downloaded scene, hand it to `read`, and clean up afterwards.
 *
 * h5wasm reads from its own in-memory filesystem, so the buffer is written
 * there under a unique name and unlinked in a `finally` — two builds can be in
 * flight at once and a fixed name would have them overwrite each other.
 */
export async function readScene<T>(
  buffer: Buffer,
  read: (file: H5File) => T
): Promise<T> {
  const mod = await hdf5();
  const { FS } = await mod.ready;
  const path = `goes-${Date.now()}-${Math.random().toString(36).slice(2)}.nc`;

  FS.writeFile(path, new Uint8Array(buffer));
  let file: H5File | null = null;
  try {
    file = new mod.File(path, "r");
    return read(file);
  } finally {
    file?.close();
    FS.unlink(path);
  }
}

/**
 * The fixed grid a scene's pixels sit on, built from the scene itself.
 *
 * Every constant comes out of the file rather than a table in a comment. The
 * scale factor, the fill value and the projection geometry are all attributes
 * GOES publishes per scene, and hardcoding them would be the pixel-archaeology
 * version of the mistake these layers exist to undo.
 *
 * The shape is taken from the variable being read rather than from `x` and `y`,
 * so a product published at a different resolution geolocates correctly without
 * anything here being told about it.
 */
export function gridOf(file: H5File, variable: string): AbiGrid {
  const proj = file.get("goes_imager_projection");
  const x = file.get("x");
  const y = file.get("y");
  const [ny, nx] = file.get(variable).shape;

  return abiGrid({
    lonOriginDeg: scalar(proj, "longitude_of_projection_origin"),
    perspectiveHeight: scalar(proj, "perspective_point_height"),
    semiMajor: scalar(proj, "semi_major_axis"),
    semiMinor: scalar(proj, "semi_minor_axis"),
    sweep: text(proj, "sweep_angle_axis"),
    xScale: scalar(x, "scale_factor"),
    xOffset: scalar(x, "add_offset"),
    yScale: scalar(y, "scale_factor"),
    yOffset: scalar(y, "add_offset"),
    nx,
    ny,
  });
}

/** A numeric attribute, which HDF5 hands back as a length-1 typed array. */
export function scalar(node: H5Dataset, name: string): number {
  const attr = node.attrs[name];
  if (!attr) throw new Error(`GOES scene has no ${name} attribute`);
  const v = attr.value;
  const n = typeof v === "number" ? v : Number((v as ArrayLike<number>)[0]);
  if (!Number.isFinite(n)) throw new Error(`GOES ${name} is not a number`);
  return n;
}

export function text(node: H5Dataset, name: string): string {
  const attr = node.attrs[name];
  if (!attr) throw new Error(`GOES scene has no ${name} attribute`);
  const v = attr.value;
  return String(Array.isArray(v) ? v[0] : v);
}

/** Every key under a prefix. The listing is XML and only the keys are wanted. */
async function list(prefix: string): Promise<string[]> {
  const res = await fetch(
    `${BUCKET}/?list-type=2&prefix=${encodeURIComponent(prefix)}`
  );
  if (!res.ok) throw new Error(`GOES listing failed: ${res.status}`);
  const xml = await res.text();
  return Array.from(xml.matchAll(/<Key>([^<]+)<\/Key>/g)).map((m) => m[1]);
}

export async function download(key: string): Promise<Buffer> {
  const res = await fetch(`${BUCKET}/${key}`);
  if (!res.ok) throw new Error(`GOES scene fetch failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Where one product files the scenes it scanned in a given hour. */
function prefix(product: string, t: Date): string {
  return (
    `${product}/${t.getUTCFullYear()}/` +
    `${String(dayOfYear(t)).padStart(3, "0")}/` +
    `${String(t.getUTCHours()).padStart(2, "0")}/`
  );
}

/**
 * Every scene key a product published in the hour containing `t`.
 *
 * The listing prefix is hour-resolved, so an hour is the smallest thing that
 * can be asked for and every walk over the archive is a walk over hours.
 *
 * This is the only way into the listing, and it hands back an hour rather than
 * a chosen scene on purpose: **which** scan gets read is `sweep.ts`'s decision,
 * because it is a decision about both products at once and no single product
 * can make it alone.
 */
export async function keysInHour(product: string, t: Date): Promise<string[]> {
  return list(prefix(product, t));
}

/**
 * Scan start time from the file name, e.g. `..._s20262250051179_e..._c....nc`
 * -> `2026-08-13T00:51:17.900Z`.
 *
 * The name is the only place the scan time appears without opening the file,
 * and the key has to be compared against others before one is downloaded.
 */
export function sceneTime(key: string): string {
  const m = /_s(\d{4})(\d{3})(\d{2})(\d{2})(\d{2})(\d)/.exec(key);
  if (!m) throw new Error(`Unparseable GOES scene name: ${key}`);
  const [, year, doy, hh, mm, ss, tenths] = m;
  const t = new Date(
    Date.UTC(
      Number(year),
      0,
      1,
      Number(hh),
      Number(mm),
      Number(ss),
      Number(tenths) * 100
    )
  );
  t.setUTCDate(t.getUTCDate() + Number(doy) - 1);
  return t.toISOString();
}

/** Day of year, 1-based — the directory GOES files are filed under. */
export function dayOfYear(t: Date): number {
  const start = Date.UTC(t.getUTCFullYear(), 0, 1);
  return Math.floor((t.getTime() - start) / 86_400_000) + 1;
}
