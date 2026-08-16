/**
 * Just enough PDF to read a text-based operations report.
 *
 * The WTWMA daily reports are text PDFs with FlateDecode content streams, so
 * the text can be pulled out with `zlib` and a regex. This is not a PDF
 * library and must never grow into one: it reads literal strings out of the
 * content stream and treats the text-positioning operators as whitespace,
 * which is enough to recover a narrative and a table and nothing more.
 *
 * A scanned report would come back empty rather than wrong — there are no
 * literal strings in a page that is one big image. `parseReport` checks for
 * the table it needs and says so.
 */

// Node
import { inflateSync } from "node:zlib";

/** Text-showing operators, and the ones that move the cursor to a new line. */
const TOKEN = /\((?:\\.|[^\\()])*\)|\bTd\b|\bTD\b|\bT\*\b|\bTJ\b|\bTj\b/gs;

/** `\(`, `\)`, `\\`, and the octal escapes the degree sign arrives as. */
function unescape(body) {
  return body
    .replace(/\\([0-7]{1,3})/g, (_, oct) =>
      String.fromCharCode(parseInt(oct, 8))
    )
    .replace(/\\([()\\])/g, "$1");
}

/**
 * Every literal string in the document, in stream order.
 *
 * Streams that fail to inflate are skipped rather than thrown on: a PDF
 * carries images and metadata in the same envelope, and only the ones holding
 * text operators are of any interest here.
 */
export function extractText(buffer) {
  const out = [];

  for (const match of buffer.toString("latin1").matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = buffer.indexOf("endstream", start, "latin1");
    if (end < 0) continue;

    let content;
    try {
      content = inflateSync(buffer.subarray(start, end)).toString("latin1");
    } catch {
      continue;
    }
    if (!content.includes("Tj") && !content.includes("TJ")) continue;

    const parts = [];
    for (const token of content.matchAll(TOKEN)) {
      const text = token[0];
      if (text.startsWith("(")) parts.push(unescape(text.slice(1, -1)));
      else if (text !== "TJ" && text !== "Tj") parts.push(" ");
    }
    if (parts.join("").trim()) out.push(parts.join(""));
  }

  // The reports tag runs of text with a language, and the tag lands in the
  // stream as a literal. It is not content and it splits sentences in half.
  return out
    .join("\n")
    .replace(/en-US/g, " ")
    .replace(/[ \t]+/g, " ");
}
