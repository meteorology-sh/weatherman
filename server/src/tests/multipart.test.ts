// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import { concatParts } from "../lib/services/hrrr/bytes";

const BOUNDARY = "SEP";
const TYPE = `multipart/byteranges; boundary=${BOUNDARY}`;

/**
 * A multipart/byteranges body the way NOMADS frames one: a part per range, each
 * introduced by the boundary and its own headers, then a closing `--SEP--`.
 */
function body(parts: { offset: number; data: string }[], boundary = BOUNDARY) {
  const chunks = parts.map(
    (p) =>
      `--${boundary}\r\n` +
      `Content-Type: application/octet-stream\r\n` +
      `Content-Range: bytes ${p.offset}-${p.offset + p.data.length - 1}/999\r\n` +
      `\r\n${p.data}\r\n`
  );
  return Buffer.from(chunks.join("") + `--${boundary}--\r\n`);
}

describe("concatParts", () => {
  it("returns the record bytes with the framing stripped", () => {
    const out = concatParts(body([{ offset: 0, data: "GRIB-A" }]), TYPE);

    assert.equal(out.toString(), "GRIB-A");
  });

  it("joins several ranges into one buffer", () => {
    const out = concatParts(
      body([
        { offset: 0, data: "AAA" },
        { offset: 10, data: "BBB" },
      ]),
      TYPE
    );

    assert.equal(out.toString(), "AAABBB");
  });

  // This is the load-bearing one. The caller pairs each TMP record with the
  // CLWMR that follows it, so a body returned out of order would silently
  // integrate cloud water against the wrong level's temperature.
  it("orders parts by file offset, not by the order they arrive", () => {
    const out = concatParts(
      body([
        { offset: 20, data: "CCC" },
        { offset: 0, data: "AAA" },
        { offset: 10, data: "BBB" },
      ]),
      TYPE
    );

    assert.equal(out.toString(), "AAABBBCCC");
  });

  it("keeps binary payloads byte-exact", () => {
    const raw = Buffer.from([
      0x47, 0x52, 0x49, 0x42, 0x00, 0xff, 0x0d, 0x0a, 0x42,
    ]);
    const framed = Buffer.concat([
      Buffer.from(`--${BOUNDARY}\r\nContent-Range: bytes 0-8/999\r\n\r\n`),
      raw,
      Buffer.from(`\r\n--${BOUNDARY}--\r\n`),
    ]);

    assert.deepEqual(concatParts(framed, TYPE), raw);
  });

  it("accepts a quoted boundary", () => {
    const out = concatParts(
      body([{ offset: 0, data: "AAA" }], "b-1"),
      'multipart/byteranges; boundary="b-1"'
    );

    assert.equal(out.toString(), "AAA");
  });

  it("throws when the content type carries no boundary", () => {
    assert.throws(
      () =>
        concatParts(body([{ offset: 0, data: "AAA" }]), "multipart/byteranges"),
      /without a boundary/
    );
  });

  // Better to fail loudly than to hand eccodes an empty file and let it explain.
  it("throws when nothing parses as a part", () => {
    assert.throws(
      () => concatParts(Buffer.from("not multipart at all"), TYPE),
      /no parts/
    );
  });
});
