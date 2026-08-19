/**
 * Just enough PDF to read a text-based operations report.
 *
 * The programmes file two kinds of document and this reads both. Which kind a
 * file is decides how the text comes out, and `extractText` settles that by
 * decoding the pages and asking what they were drawn with rather than by
 * reading a font dictionary — every programme declares a glyph font somewhere,
 * so declaring one says nothing.
 *
 * `literalText` is the whole of the reader West Texas, Trans-Pecos and the
 * Panhandle need. It pulls literal strings out of the content streams and
 * treats the text-positioning operators as whitespace, which is enough to
 * recover a narrative and a table.
 *
 * **South Texas and the Rolling Plains cannot be read that way**, and the
 * reason is the same fact twice. Their reports subset the font and encode text
 * as glyph indices, so the bytes in the stream are not characters and have to
 * go through the font's `ToUnicode` table to become any. Having done that,
 * those documents also place every glyph with its own `Td`, so the rule that a
 * cursor move is a space would put one between every letter — the spaces are
 * in the glyph stream instead, and the cursor is worth reading only for where
 * a line ends. That is what `glyphText` does, and it is where this stops: it
 * resolves fonts far enough to decode text and knows nothing about widths,
 * colour or anything drawn.
 *
 * A scanned report comes back empty rather than wrong either way — there are
 * no strings at all in a page that is one big image. `parseReport` checks for
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
 * Every inflatable stream in the file, in order.
 *
 * A stream that will not inflate is skipped rather than thrown on: a PDF
 * carries images and metadata in the same envelope, and only the ones holding
 * text operators are of any interest here.
 */
function* streams(buffer, source) {
  for (const match of source.matchAll(/stream\r?\n/g)) {
    const start = match.index + match[0].length;
    const end = buffer.indexOf("endstream", start, "latin1");
    if (end < 0) continue;
    try {
      yield inflateSync(buffer.subarray(start, end)).toString("latin1");
    } catch {
      continue;
    }
  }
}

/** The reader for reports whose content streams hold real characters. */
function literalText(buffer, source) {
  const out = [];

  for (const content of streams(buffer, source)) {
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

/* -------------------------------------------------------------------------
 * Enough of the object graph to get from a page to the fonts it draws with.
 * ---------------------------------------------------------------------- */

/** Every `N 0 obj`, as the offset its body starts at. */
function objects(source) {
  const at = new Map();
  for (const match of source.matchAll(/(\d+)\s+\d+\s+\bobj\b/g)) {
    at.set(Number(match[1]), match.index + match[0].length);
  }
  return at;
}

/**
 * An object's dictionary.
 *
 * Cut at `stream` as well as at `endobj`: the body of a stream object is
 * binary that can hold either word, and only the dictionary in front of it is
 * ever read here.
 */
function objectBody(source, start) {
  if (start === undefined) return "";
  const ends = [
    source.indexOf("stream", start),
    source.indexOf("endobj", start),
  ].filter((index) => index >= 0);
  return source.slice(start, ends.length ? Math.min(...ends) : undefined);
}

/** The raw text of one key: a nested dictionary, an array, a reference, a name. */
function value(body, key) {
  const found = body.search(new RegExp(`/${key}(?![A-Za-z0-9])`));
  if (found < 0) return null;

  let at = found + key.length + 1;
  while (/\s/.test(body[at])) at += 1;

  if (body.startsWith("<<", at)) {
    let depth = 0;
    for (let scan = at; scan < body.length; scan += 1) {
      if (body.startsWith("<<", scan)) depth += 1;
      else if (body.startsWith(">>", scan)) {
        depth -= 1;
        if (depth === 0) return body.slice(at, scan + 2);
      } else continue;
      scan += 1;
    }
    return body.slice(at);
  }
  if (body[at] === "[") {
    const close = body.indexOf("]", at);
    return body.slice(at, close < 0 ? undefined : close + 1);
  }
  return body.slice(at).match(/^\/?[^\s/<>[\]]*/)[0] === ""
    ? null
    : body.slice(at).match(/^(?:\d+\s+\d+\s+R|\/?[^\s/<>[\]]*)/)[0];
}

/** A `12 0 R` becomes the object it names; anything else is already the value. */
function deref(source, at, raw) {
  const ref = /^(\d+)\s+\d+\s+R$/.exec((raw ?? "").trim());
  return ref ? objectBody(source, at.get(Number(ref[1]))) : raw;
}

/** One object's stream, inflated. */
function streamOf(buffer, source, at, number) {
  const start = at.get(number);
  if (start === undefined) return "";

  const opens = source.indexOf("stream", start);
  if (opens < 0) return "";
  let from = opens + "stream".length;
  if (source[from] === "\r") from += 1;
  if (source[from] === "\n") from += 1;

  const to = source.indexOf("endstream", from);
  const body = buffer.subarray(from, to < 0 ? undefined : to);
  try {
    return inflateSync(body).toString("latin1");
  } catch {
    return body.toString("latin1");
  }
}

/** `<0041>` and friends — a CMap destination is UTF-16BE. */
function utf16be(hex) {
  let out = "";
  for (let at = 0; at + 4 <= hex.length; at += 4) {
    out += String.fromCharCode(parseInt(hex.slice(at, at + 4), 16));
  }
  return out;
}

/**
 * A font's `ToUnicode` CMap: glyph number to the character it draws.
 *
 * Both forms of `bfrange` are read. The one with a list spells out a
 * destination per glyph; the one with a single destination means consecutive
 * glyphs draw consecutive characters, which is how a subset font encodes a
 * run of digits.
 */
function toUnicode(text) {
  const map = new Map();

  for (const [, block] of text.matchAll(/beginbfchar([^]*?)endbfchar/g)) {
    for (const [, from, to] of block.matchAll(
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]*)>/g
    )) {
      map.set(parseInt(from, 16), utf16be(to));
    }
  }

  for (const [, block] of text.matchAll(/beginbfrange([^]*?)endbfrange/g)) {
    const RANGE =
      /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]*)>|\[([^\]]*)\])/g;
    for (const [, low, high, single, list] of block.matchAll(RANGE)) {
      const first = parseInt(low, 16);
      const last = parseInt(high, 16);

      if (list !== undefined) {
        const items = [...list.matchAll(/<([0-9A-Fa-f]*)>/g)].map((item) =>
          utf16be(item[1])
        );
        for (let code = first; code <= last && code - first < items.length;) {
          map.set(code, items[code - first]);
          code += 1;
        }
        continue;
      }
      const base = parseInt(single, 16);
      for (let code = first; code <= last; code += 1) {
        map.set(code, String.fromCharCode(base + (code - first)));
      }
    }
  }

  return map;
}

/** The fonts a page can draw with, by the name its content stream calls them. */
function fontsOf(buffer, source, at, page) {
  const resources = deref(source, at, value(page, "Resources"));
  const fonts = deref(source, at, value(resources ?? "", "Font"));
  const map = new Map();
  if (!fonts) return map;

  for (const [, name, number] of fonts.matchAll(
    /\/([^\s/<>[\]]+)\s+(\d+)\s+\d+\s+R/g
  )) {
    const font = objectBody(source, at.get(Number(number)));
    const cmap = /^(\d+)/.exec(value(font, "ToUnicode") ?? "");
    map.set(name, {
      // Identity-H addresses glyphs with two bytes; a simple font uses one.
      wide: /\/Identity-H/.test(font),
      glyphs: cmap
        ? toUnicode(streamOf(buffer, source, at, Number(cmap[1])))
        : null,
    });
  }

  return map;
}

/* -------------------------------------------------------------------------
 * The reader for reports that draw glyphs.
 * ---------------------------------------------------------------------- */

/**
 * Everything the decoder reacts to: the page transform being pushed, popped or
 * changed, a font being selected, a text matrix, a cursor move, and a string
 * being shown as either a literal or hex.
 */
const DRAW = new RegExp(
  [
    String.raw`\/([^\s/<>[\]]+)\s+[-\d.]+\s+(Tf)`,
    String.raw`([-\d.]+(?:\s+[-\d.]+){5})\s+(Tm|cm)`,
    String.raw`([-\d.]+)\s+([-\d.]+)\s+(Td|TD)`,
    String.raw`(T\*)|\b(q)\b|\b(Q)\b`,
    String.raw`\(((?:\\.|[^\\()])*)\)`,
    String.raw`<([0-9A-Fa-f\s]*)>`,
  ].join("|"),
  "gs"
);

/** `[a b c d e f]`, applied one after the other. */
function compose(inner, outer) {
  const [a, b, c, d, e, f] = inner;
  const [A, B, C, D, E, F] = outer;
  return [
    a * A + b * C,
    a * B + b * D,
    c * A + d * C,
    c * B + d * D,
    e * A + f * C + E,
    e * B + f * D + F,
  ];
}

/** Two bytes to a glyph number for a wide font, one for a narrow one. */
function codes(bytes, wide) {
  const out = [];
  const step = wide ? 2 : 1;
  for (let at = 0; at + step <= bytes.length; at += step) {
    out.push(
      wide
        ? (bytes.charCodeAt(at) << 8) | bytes.charCodeAt(at + 1)
        : bytes.charCodeAt(at)
    );
  }
  return out;
}

/**
 * A string, as the characters the selected font draws.
 *
 * A glyph number with no `ToUnicode` entry, and a string shown before any font
 * is selected, both come back empty. There is nothing to fall back to: in a
 * document that draws glyphs the bytes are indices into a subset nobody
 * published, so printing them raw yields text that looks like text and says
 * something else. A simple font with no table is the one case where the byte
 * really is the character.
 */
function show(bytes, font) {
  if (!font) return "";
  return codes(bytes, font.wide)
    .map(
      (code) =>
        font.glyphs?.get(code) ?? (font.wide ? "" : String.fromCharCode(code))
    )
    .join("");
}

/**
 * One page, decoded.
 *
 * The only geometry read is which line of the page the text sits on. A page
 * that positions every glyph gives no word breaks from its cursor — the spaces
 * are glyphs like any other — but a line ending is still a line ending, and
 * without it a whole page arrives as one run and no table can be read out of
 * it.
 *
 * **Comparing two lines means putting them in the same coordinates first.**
 * A report drawn out of Word wraps parts of a page in their own transform, and
 * a heading split across two runs by the editor can end up in two of them. The
 * page transform is tracked alongside the text matrix for that reason: without
 * it the two halves of `Flight Information` look forty units apart and the
 * heading the table is found by is broken in half.
 */
function pageText(content, fonts) {
  const out = [];
  const drawn = { wide: 0, narrow: 0 };
  const IDENTITY = [1, 0, 0, 1, 0, 0];
  let font = null;
  let ctm = IDENTITY;
  let saved = [];
  let matrix = IDENTITY;
  let offset = [0, 0];
  let last = null;

  const baseline = () => {
    const [, b, , d, , f] = compose(matrix, ctm);
    return offset[0] * b + offset[1] * d + f;
  };

  for (const token of content.matchAll(DRAW)) {
    const [, name, tf, six, which, tx, ty, td, star, push, pop, literal, hex] =
      token;

    if (tf) {
      font = fonts.get(name) ?? null;
    } else if (which === "cm") {
      ctm = compose(six.trim().split(/\s+/).map(Number), ctm);
    } else if (which === "Tm") {
      matrix = six.trim().split(/\s+/).map(Number);
      offset = [0, 0];
    } else if (push) {
      saved.push(ctm);
    } else if (pop) {
      ctm = saved.pop() ?? IDENTITY;
    } else if (td) {
      offset = [offset[0] + Number(tx), offset[1] + Number(ty)];
    } else if (star) {
      offset = [0, offset[1] - 1];
    } else {
      const bytes =
        literal !== undefined
          ? unescape(literal)
          : hexBytes(hex.replace(/\s+/g, ""));

      if (font) drawn[font.wide ? "wide" : "narrow"] += bytes.length;

      const line = baseline();
      // A run set a fraction of a point off its neighbour is on the same line.
      // Word does that to a table cell often enough that a strict comparison
      // puts every row of a flight table on a line of its own.
      if (last !== null && Math.abs(line - last) > 1) out.push("\n");
      last = line;
      out.push(show(bytes, font));
    }
  }

  return { text: out.join(""), drawn };
}

/** `<0036>` as the two bytes it stands for. */
function hexBytes(hex) {
  const even = hex.length % 2 ? `${hex}0` : hex;
  let out = "";
  for (let at = 0; at + 2 <= even.length; at += 2) {
    out += String.fromCharCode(parseInt(even.slice(at, at + 2), 16));
  }
  return out;
}

/**
 * The reader for reports whose content streams hold glyph numbers.
 *
 * Reports how much of the document it drew with each kind of font as well as
 * what it read, because that is what says whether it was the right reader.
 */
function glyphText(buffer, source) {
  const at = objects(source);
  const out = [];
  const drawn = { wide: 0, narrow: 0 };

  for (const [, start] of at) {
    const page = objectBody(source, start);
    if (!/\/Type\s*\/Page(?![sA-Za-z])/.test(page)) continue;

    const fonts = fontsOf(buffer, source, at, page);
    const contents = value(page, "Contents") ?? "";
    const numbers = [...contents.matchAll(/(\d+)\s+\d+\s+R/g)].map((ref) =>
      Number(ref[1])
    );

    let text = "";
    for (const number of numbers) {
      const read = pageText(streamOf(buffer, source, at, number), fonts);
      text += read.text;
      drawn.wide += read.drawn.wide;
      drawn.narrow += read.drawn.narrow;
    }
    if (text.trim()) out.push(text);
  }

  // The reports tag runs of text with a language, the same as they do when
  // the text is characters, and the tag is not content either way.
  return {
    text: out
      .join("\n")
      .replace(/en-US/g, " ")
      .replace(/[ \t]+/g, " "),
    drawn,
  };
}

/**
 * The report's text, however the document chose to store it.
 *
 * **Which reader is right is settled by asking the document, not by guessing
 * from its fonts.** Every programme's reports declare an `Identity-H` font
 * somewhere, so declaring one says nothing; what separates them is how much of
 * the page is drawn with it. West Texas, Trans-Pecos and the Panhandle draw
 * between 1.5% and 4.1% of their characters that way and are read as
 * characters. South Texas and the Rolling Plains draw 98.7% and 100%, and
 * reading those as characters gives pages of bytes that are not text at all.
 *
 * **A document that draws glyphs and also hides its page objects in an object
 * stream comes back empty.** Object streams are not unpacked here, so no page
 * is found, nothing is drawn, and the simple reader is handed a document it
 * cannot read either. Empty is the right answer: the bytes those pages show
 * are glyph numbers, and reading them as characters is how a file like that
 * produces pages of plausible-looking nonsense. The 2025 South Texas season
 * document is the one in hand, and it holds the same twelve days as the
 * dailies beside it, which are read normally.
 */
export function extractText(buffer) {
  const source = buffer.toString("latin1");
  const glyphs = glyphText(buffer, source);
  return glyphs.drawn.wide > glyphs.drawn.narrow
    ? glyphs.text
    : literalText(buffer, source);
}
