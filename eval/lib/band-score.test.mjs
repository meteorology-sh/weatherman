// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Local
import { bandOverlap, summarizeOverlaps, unusableKey } from "./band-score.mjs";

const row = (date, site, freezeR, freezeO, topR, topO) => ({
  date,
  site,
  compared: {
    freezingLevel: { reported: freezeR, ours: freezeO, error: freezeO - freezeR },
    minus15Height: { reported: topR, ours: topO, error: topO - topR },
  },
});

describe("bandOverlap", () => {
  it("is 1 when both edges match", () => {
    const overlap = bandOverlap(row("2025-04-19", "KMAF", 4000, 4000, 6400, 6400));
    assert.equal(overlap.fraction, 1);
    assert.equal(overlap.depth, 2400);
  });

  it("penalizes a band drawn too deep against the union", () => {
    // Measured 4000–6400, ours 3500–7000. Shared 2400, union 3500.
    const overlap = bandOverlap(row("2025-04-19", "KMAF", 4000, 3500, 6400, 7000));
    assert.equal(overlap.fraction, 2400 / 3500);
  });

  it("drops a freezing level at or below sea level", () => {
    assert.equal(
      bandOverlap(row("2025-06-01", "KDRT", -12, 4000, 6400, 6400)),
      null
    );
  });

  it("drops a printed pair steeper than dry adiabatic", () => {
    // 4072 to 4944 is 872 m for 15 °C — 17.2 °C/km.
    const bad = row("2025-03-31", "KDRT", 4072, 4119, 4944, 6492);
    assert.equal(unusableKey(bad), "2025-03-31 KDRT");
    assert.equal(bandOverlap(bad), null);
  });
});

describe("summarizeOverlaps", () => {
  it("reports the median and how many clear 90%", () => {
    const overlaps = [0.95, 0.97, 0.8].map((fraction, i) => ({
      date: `2025-04-0${i + 1}`,
      site: "KMAF",
      measured: [4000, 6400],
      ours: [4000, 6400],
      depth: 2400,
      fraction,
    }));
    const summary = summarizeOverlaps(overlaps);
    assert.equal(summary.n, 3);
    assert.equal(summary.median, 0.95);
    assert.equal(summary.over90, 2);
    assert.equal(summary.over80, 3);
  });
});
