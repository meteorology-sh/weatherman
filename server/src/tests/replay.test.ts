import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";

import { parseAt } from "../lib/services/shared/replay";
import {
  assertAt,
  floorHour,
  fetchRangesOneByOne,
} from "../lib/services/hrrr/bytes";
import { archiveKeyTime } from "../lib/services/mrms/radar";

describe("parseAt", () => {
  it("reads an absent parameter as live", () => {
    assert.equal(parseAt(undefined), undefined);
  });

  it("reads an empty parameter as live", () => {
    // A cleared input posts `at=`, and that means "back to now", not an error.
    assert.equal(parseAt(""), undefined);
  });

  it("parses an ISO timestamp", () => {
    assert.equal(
      parseAt("2025-05-15T18:00:00Z")!.toISOString(),
      "2025-05-15T18:00:00.000Z"
    );
  });

  it("refuses a string that is not a timestamp", () => {
    assert.throws(() => parseAt("notatime"), /not a valid timestamp/);
  });

  it("refuses a repeated parameter", () => {
    // Express hands `?at=a&at=b` over as an array; taking the first would pick
    // one of two dates the caller asked for.
    assert.throws(() => parseAt(["2025-05-15", "2025-05-16"]), /single ISO/);
  });
});

describe("floorHour", () => {
  it("truncates to the cycle the timestamp falls in", () => {
    assert.equal(
      floorHour(new Date("2025-05-15T18:47:31.500Z")).toISOString(),
      "2025-05-15T18:00:00.000Z"
    );
  });

  it("leaves an exact hour alone", () => {
    assert.equal(
      floorHour(new Date("2025-05-15T18:00:00Z")).toISOString(),
      "2025-05-15T18:00:00.000Z"
    );
  });
});

describe("assertAt", () => {
  it("accepts a published past cycle", () => {
    assert.doesNotThrow(() => assertAt(new Date("2025-05-15T18:00:00Z")));
  });

  it("refuses the future", () => {
    assert.throws(
      () => assertAt(new Date(Date.now() + 3_600_000)),
      /at least an hour old/
    );
  });

  it("refuses a cycle too new to have been published", () => {
    // HRRR posts ~50 min after the hour, so the current hour is a 404 waiting
    // to happen rather than a replayable cycle.
    assert.throws(
      () => assertAt(new Date(Date.now() - 60_000)),
      /at least an hour old/
    );
  });
});

describe("archiveKeyTime", () => {
  it("reads the scan time out of an MRMS key", () => {
    assert.equal(
      archiveKeyTime(
        "CONUS/MergedBaseReflectivityQC_00.50/20250515/" +
          "MRMS_MergedBaseReflectivityQC_00.50_20250515-181439.grib2.gz"
      ),
      "2025-05-15T18:14:39.000Z"
    );
  });

  it("returns nothing for a key that carries no time", () => {
    assert.equal(archiveKeyTime("CONUS/whatever/index.html"), "");
  });
});

describe("fetchRangesOneByOne", () => {
  it("issues one request per range and concatenates in order", async (t) => {
    const asked: string[] = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (_url: string, init: RequestInit) => {
        const range = (init.headers as Record<string, string>).Range;
        asked.push(range);
        return {
          status: 206,
          arrayBuffer: async () => new Uint8Array([asked.length]).buffer,
        } as unknown as Response;
      }
    );

    const out = await fetchRangesOneByOne("http://x/f.grib2", [
      [0, 9],
      [10, 19],
    ]);

    assert.deepEqual(asked, ["bytes=0-9", "bytes=10-19"]);
    assert.deepEqual([...out], [1, 2]);
  });

  it("refuses a 200, because S3 answers a range it ignored with the whole object", async (t) => {
    // The failure this guards is silent: S3 returns 200 and ~398 MB rather than
    // a 416, and the decode downstream still succeeds. Only the status says so.
    t.mock.method(globalThis, "fetch", async () => {
      return {
        status: 200,
        arrayBuffer: async () => new ArrayBuffer(8),
      } as unknown as Response;
    });

    await assert.rejects(
      () => fetchRangesOneByOne("http://x/f.grib2", [[0, 9]]),
      /ignored the byte range .*expected 206/
    );
  });
});

// Keep the global fetch mock from leaking into other files in the same run.
mock.reset();
