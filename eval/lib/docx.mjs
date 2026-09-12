/**
 * The text of a Word document, for the programs that publish `.docx`.
 *
 * **It reads the one part of the archive that holds the words and nothing
 * else**, for the reason `pdf.mjs` stays dependency-free: the reports are the
 * record, and a reader whose output cannot be checked by hand is a second
 * source of error under it. A `.docx` is a zip archive; `word/document.xml`
 * inside it is the body, and its paragraphs and table cells are what the
 * report parsers read.
 *
 * Each paragraph and each table cell ends in whitespace, so a flight table
 * reads as the same run of `time plane position county` a PDF's text layer
 * gives. Word splits a word into runs wherever an edit touched it; the runs of
 * one paragraph are joined without a gap, so `Flight Inform` and `ation`
 * arrive as one word.
 */

// Node
import { inflateRawSync } from "node:zlib";

const END_OF_DIRECTORY = 0x06054b50;
const DIRECTORY_ENTRY = 0x02014b50;
const LOCAL_ENTRY = 0x04034b50;

/** Name → where the entry's bytes are, from the archive's central directory. */
function directory(buffer) {
  // The end record is the last 22 bytes plus a comment of up to 65,535.
  let end = -1;
  const floor = Math.max(0, buffer.length - 22 - 0xffff);
  for (let at = buffer.length - 22; at >= floor; at--) {
    if (buffer.readUInt32LE(at) === END_OF_DIRECTORY) {
      end = at;
      break;
    }
  }
  if (end < 0) throw new Error("not a zip archive");

  const count = buffer.readUInt16LE(end + 10);
  let at = buffer.readUInt32LE(end + 16);
  const entries = new Map();
  for (let n = 0; n < count; n++) {
    if (buffer.readUInt32LE(at) !== DIRECTORY_ENTRY) {
      throw new Error("damaged zip directory");
    }
    const nameLength = buffer.readUInt16LE(at + 28);
    const extraLength = buffer.readUInt16LE(at + 30);
    const commentLength = buffer.readUInt16LE(at + 32);
    entries.set(buffer.toString("utf8", at + 46, at + 46 + nameLength), {
      method: buffer.readUInt16LE(at + 10),
      // The directory's size is authoritative: a local header written before
      // its data was compressed carries zero there.
      size: buffer.readUInt32LE(at + 20),
      offset: buffer.readUInt32LE(at + 42),
    });
    at += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

/** One entry's bytes, inflated. */
function contents(buffer, entry) {
  if (buffer.readUInt32LE(entry.offset) !== LOCAL_ENTRY) {
    throw new Error("damaged zip entry");
  }
  const start =
    entry.offset +
    30 +
    buffer.readUInt16LE(entry.offset + 26) +
    buffer.readUInt16LE(entry.offset + 28);
  const body = buffer.subarray(start, start + entry.size);
  if (entry.method === 0) return body;
  if (entry.method === 8) return inflateRawSync(body);
  throw new Error(`zip compression method ${entry.method} is not read`);
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** The body text of a `.docx`, paragraphs and cells separated by whitespace. */
export function extractDocxText(buffer) {
  const entry = directory(buffer).get("word/document.xml");
  if (!entry) throw new Error("not a Word document — no word/document.xml");
  return contents(buffer, entry)
    .toString("utf8")
    .replace(/<w:(?:tab|br|cr)\b[^>]*\/>/g, " ")
    .replace(/<\/w:(?:p|tc)>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => ENTITIES[name])
    .replace(/&#(x?)([0-9a-fA-F]+);/g, (_, hex, code) =>
      String.fromCodePoint(parseInt(code, hex ? 16 : 10))
    )
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n");
}
