// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Local
import { instant } from "./reports.mjs";

describe("instant", () => {
  it("keeps an afternoon row on the report's own day", () => {
    assert.equal(instant("2025-06-21", "1907"), "2025-06-21T19:07:00.000Z");
    assert.equal(instant("2025-06-21", "2231"), "2025-06-21T22:31:00.000Z");
  });

  it("carries a row past midnight to the next day", () => {
    assert.equal(instant("2025-08-11", "1859"), "2025-08-11T18:59:00.000Z");
    assert.equal(instant("2025-08-11", "0005"), "2025-08-12T00:05:00.000Z");
  });

  it("carries a sortie that is nothing but times after 00Z", () => {
    // South Texas flew 6 May at 0030Z and 0032Z and at no other time, so
    // there is no earlier row on the day to measure these against.
    assert.equal(instant("2025-05-06", "0030"), "2025-05-07T00:30:00.000Z");
    assert.equal(instant("2025-05-06", "0032"), "2025-05-07T00:32:00.000Z");
    // The Rolling Plains flew 29 May the same way.
    assert.equal(instant("2025-05-29", "0044"), "2025-05-30T00:44:00.000Z");
    assert.equal(instant("2025-05-29", "0052"), "2025-05-30T00:52:00.000Z");
  });

  it("crosses a month and a year", () => {
    assert.equal(instant("2025-05-31", "0044"), "2025-06-01T00:44:00.000Z");
    assert.equal(instant("2025-12-31", "0100"), "2026-01-01T01:00:00.000Z");
  });

  it("splits the day at midday", () => {
    // Seeding runs 15Z through 06Z, so nothing is printed between these two
    // and the boundary is only ever read on one side or the other.
    assert.equal(instant("2025-06-21", "1200"), "2025-06-21T12:00:00.000Z");
    assert.equal(instant("2025-06-21", "1159"), "2025-06-22T11:59:00.000Z");
  });
});
