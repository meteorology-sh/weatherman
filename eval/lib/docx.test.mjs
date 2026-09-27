// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";

// Local
import { extractDocxText } from "./docx.mjs";

/** A zip archive of the given entries, stored or deflated. CRCs are not read. */
function zip(files, { deflate = false } = {}) {
  const locals = [];
  const entries = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const nameBytes = Buffer.from(name, "utf8");
    const raw = Buffer.from(text, "utf8");
    const body = deflate ? deflateRawSync(raw) : raw;
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(deflate ? 8 : 0, 8);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    locals.push(local, nameBytes, body);

    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(deflate ? 8 : 0, 10);
    entry.writeUInt32LE(body.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(nameBytes.length, 28);
    entry.writeUInt32LE(offset, 42);
    entries.push(entry, nameBytes);
    offset += 30 + nameBytes.length + body.length;
  }
  const directory = Buffer.concat(entries);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const BODY =
  '<?xml version="1.0"?><w:document><w:body>' +
  "<w:p><w:r><w:t>SEEDING REPORT – May 10, 2024</w:t></w:r></w:p>" +
  "<w:p><w:r><w:t>Flight Inform</w:t></w:r><w:r><w:t>ation</w:t></w:r></w:p>" +
  "<w:tbl><w:tr>" +
  "<w:tc><w:p><w:r><w:t>2154</w:t></w:r></w:p></w:tc>" +
  "<w:tc><w:p><w:r><w:t>49P</w:t></w:r></w:p></w:tc>" +
  "<w:tc><w:p><w:r><w:t>198° @ 56 nm</w:t></w:r></w:p></w:tc>" +
  "<w:tc><w:p><w:r><w:t>Tom Green</w:t></w:r></w:p></w:tc>" +
  "</w:tr></w:tbl>" +
  "<w:p><w:r><w:t>Crockett (12G&amp;1H)</w:t><w:tab/><w:t>&#8220;x&#x201D;</w:t></w:r></w:p>" +
  "</w:body></w:document>";

describe("extractDocxText", () => {
  it("reads a stored archive", () => {
    const text = extractDocxText(zip({ "word/document.xml": BODY }));
    assert.match(text, /SEEDING REPORT – May 10, 2024/);
  });

  it("reads a deflated archive among other parts", () => {
    const text = extractDocxText(
      zip(
        { "[Content_Types].xml": "<Types/>", "word/document.xml": BODY },
        { deflate: true }
      )
    );
    assert.match(text, /SEEDING REPORT/);
  });

  it("joins the runs of one paragraph into one word", () => {
    const text = extractDocxText(zip({ "word/document.xml": BODY }));
    assert.match(text, /Flight Information/);
  });

  it("reads a table row as one run of fields", () => {
    const text = extractDocxText(zip({ "word/document.xml": BODY }));
    assert.match(text, /2154\s+49P\s+198° @ 56 nm\s+Tom Green/);
  });

  it("decodes entities and tabs", () => {
    const text = extractDocxText(zip({ "word/document.xml": BODY }));
    assert.match(text, /Crockett \(12G&1H\) “x”/);
  });

  it("refuses an archive with no document body", () => {
    assert.throws(
      () => extractDocxText(zip({ "word/styles.xml": "<w:styles/>" })),
      /no word\/document\.xml/
    );
  });

  it("refuses something that is not an archive", () => {
    assert.throws(
      () => extractDocxText(Buffer.from("%PDF-1.7 ...")),
      /not a zip/
    );
  });
});
