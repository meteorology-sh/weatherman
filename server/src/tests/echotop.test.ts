// Node
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  EchoTopService,
  echoTopCovered,
  echoTopFtValues,
  heightFt,
  pastFreezingValues,
  tallestOver,
  KM_TO_FT,
  NO_COVERAGE_KM,
  NO_ECHO_KM,
} from "../lib/services/mrms/echotop";
import { identify } from "../lib/services/mrms/objects";
import { NoticeBoard } from "../lib/services/shared/notices";

// Types
import type { Grid, Geo } from "../lib/services/shared/contour";

function scene(rows: number[][]) {
  const ny = rows.length;
  const nx = rows[0].length;
  const values = new Float32Array(nx * ny);
  const lats = new Float32Array(nx * ny);
  const lons = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      values[k] = rows[j][i];
      lats[k] = 30 + 0.01 * j;
      lons[k] = -100 + 0.01 * i;
    }
  }
  return {
    grid: { nx, ny, values } as Grid,
    geo: { nx, ny, lats, lons } as Geo,
  };
}

describe("heightFt", () => {
  it("converts kilometers MSL to feet", () => {
    assert.equal(heightFt(10), Math.round(10 * KM_TO_FT));
  });

  it("is null for no echo and for no coverage", () => {
    assert.equal(heightFt(NO_ECHO_KM), null);
    assert.equal(heightFt(NO_COVERAGE_KM), null);
    assert.equal(heightFt(0), null);
  });
});

describe("echoTopFtValues", () => {
  it("converts kilometers to feet on the same cells", () => {
    const out = echoTopFtValues(new Float32Array([10, NO_ECHO_KM]));
    assert.equal(out[0], Math.round(10 * KM_TO_FT));
    assert.ok(Number.isNaN(out[1]));
  });
});

describe("pastFreezingValues", () => {
  it("marks a column whose 18 dBZ top is at or above freezing", () => {
    const echoKm = new Float32Array([4]); // ~13,123 ft
    const freeze = new Float32Array([10000]);
    assert.equal(pastFreezingValues(echoKm, freeze)[0], 1);
  });

  it("leaves a column whose top sits below freezing blank", () => {
    const echoKm = new Float32Array([2]);
    const freeze = new Float32Array([12000]);
    assert.ok(Number.isNaN(pastFreezingValues(echoKm, freeze)[0]));
  });

  it("leaves no-echo and no-coverage blank", () => {
    const echoKm = new Float32Array([NO_ECHO_KM, NO_COVERAGE_KM]);
    const freeze = new Float32Array([8000, 8000]);
    const out = pastFreezingValues(echoKm, freeze);
    assert.ok(Number.isNaN(out[0]));
    assert.ok(Number.isNaN(out[1]));
  });

  it("leaves a column with no freezing level blank", () => {
    const echoKm = new Float32Array([8]);
    const freeze = new Float32Array([Number.NaN]);
    assert.ok(Number.isNaN(pastFreezingValues(echoKm, freeze)[0]));
  });
});

describe("tallestOver", () => {
  it("returns the highest 18 dBZ top on the storm, in feet", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 30, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_ECHO_KM);
    echo[storm.cells[0]] = 8.5;
    const hit = tallestOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.echoTopFt, Math.round(8.5 * KM_TO_FT));
    assert.equal(hit.lat, geo.lats[storm.cells[0]]);
    assert.equal(hit.lon, geo.lons[storm.cells[0]]);
  });

  it("ignores no-echo sentinels rather than treating them as a height", () => {
    const { grid, geo } = scene([
      [0, 40],
      [40, 40],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_ECHO_KM);
    echo[storm.cells[0]] = 6;
    const hit = tallestOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.echoTopFt, Math.round(6 * KM_TO_FT));
  });

  it("does not take a taller top off the storm", () => {
    const { grid, geo } = scene([
      [0, 0, 0],
      [0, 30, 0],
      [0, 0, 0],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_ECHO_KM);
    echo[0] = 16;
    echo[storm.cells[0]] = 7;
    const hit = tallestOver(storm, geo, geo, echo);
    assert.ok(hit);
    assert.equal(hit.echoTopFt, Math.round(7 * KM_TO_FT));
  });

  it("is null when every storm cell has no 18 dBZ top", () => {
    const { grid, geo } = scene([
      [0, 30],
      [30, 30],
    ]);
    const [storm] = identify(grid, geo, 20, "2025-08-11T18:00:00.000Z");
    const echo = new Float32Array(geo.lats.length).fill(NO_COVERAGE_KM);
    assert.equal(tallestOver(storm, geo, geo, echo), null);
  });
});

describe("EchoTopService.tallest", () => {
  it("does not wait on a cold live scene", async (t) => {
    const svc = new EchoTopService();
    t.mock.method(globalThis, "fetch", async () => {
      throw new Error("echo-top is not warm");
    });
    const { grid, geo } = scene([
      [0, 40],
      [40, 40],
    ]);
    const [storm] = identify(grid, geo, 20, "2026-08-31T00:00:00.000Z");
    const t0 = Date.now();
    const hit = await svc.tallest(storm, geo);
    assert.equal(hit, null);
    assert.ok(Date.now() - t0 < 500);
  });
});

/** A 4×2 mosaic, south row first, covered everywhere with no echo. */
function mosaic(validTime: string, emptySouthwest = false) {
  const nx = 4;
  const ny = 2;
  const values = new Float32Array(nx * ny).fill(NO_ECHO_KM);
  const lats = new Float32Array(nx * ny);
  const lons = new Float32Array(nx * ny);
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      lats[j * nx + i] = j === 0 ? 30 : 40;
      lons[j * nx + i] = -110 + 10 * i;
    }
  }
  if (emptySouthwest) {
    values[0] = NO_COVERAGE_KM;
    values[1] = NO_COVERAGE_KM;
  }
  return {
    grid: { nx, ny, values } as Grid,
    geo: { nx, ny, lats, lons } as Geo,
    validTime,
  };
}

type Scene = ReturnType<typeof mosaic>;

/** The service's private seams: the GRIB read and the archive listing. */
type Internals = {
  build(key?: string): Promise<Scene>;
  sceneAt(at: Date): Promise<string>;
  cache: unknown;
};

const ARCHIVE_KEY =
  "CONUS/EchoTop_18_00.50/20260911/MRMS_EchoTop_18_00.50_20260911-021439.grib2.gz";

/** A service whose live file and archived copy are the scenes given. */
function withFeeds(
  t: TestContext,
  live: () => Promise<Scene>,
  archived: () => Promise<Scene>
) {
  const notices = new NoticeBoard();
  const svc = new EchoTopService(notices);
  const inner = svc as unknown as Internals;
  t.mock.method(inner, "sceneAt", async () => ARCHIVE_KEY);
  t.mock.method(inner, "build", async (key?: string) =>
    key ? archived() : live()
  );
  return { svc, inner, notices };
}

describe("echoTopCovered", () => {
  // No echo is a radar that looked and saw nothing.
  it("counts no echo and a real top as covered, and no coverage as not", () => {
    assert.equal(echoTopCovered(NO_ECHO_KM), true);
    assert.equal(echoTopCovered(8.5), true);
    assert.equal(echoTopCovered(NO_COVERAGE_KM), false);
  });
});

describe("EchoTopService live feed", () => {
  it("draws the live file and says nothing when it looks right", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => mosaic("2026-09-11T02:18:00.000Z"),
      async () => mosaic("2026-09-11T02:14:00.000Z")
    );

    const scene = await svc.mosaic();

    assert.equal(scene.validTime, "2026-09-11T02:18:00.000Z");
    assert.deepEqual(notices.list(), []);
  });

  it("draws the archived copy when the live data looks wrong", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => mosaic("2026-09-11T02:18:00.000Z", true),
      async () => mosaic("2026-09-11T02:14:00.000Z")
    );

    const scene = await svc.mosaic();

    assert.equal(scene.validTime, "2026-09-11T02:14:00.000Z");
    const [notice] = notices.list();
    assert.equal(
      notice.detail,
      "The live data looks wrong. Showing NOAA's archived copy."
    );
    assert.equal(notice.delayMinutes, 4);
  });

  it("keeps the live file when the archive looks wrong too", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => mosaic("2026-09-11T02:18:00.000Z", true),
      async () => mosaic("2026-09-11T02:14:00.000Z", true)
    );

    const scene = await svc.mosaic();

    assert.equal(scene.validTime, "2026-09-11T02:18:00.000Z");
    const [notice] = notices.list();
    assert.equal(notice.detail, "The live data looks wrong.");
    assert.equal(notice.delayMinutes, null);
  });

  it("draws the archived copy when the live request fails", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => {
        throw new Error("MRMS echo-top unreachable: socket hang up");
      },
      async () => mosaic("2026-09-11T02:14:00.000Z")
    );

    const scene = await svc.mosaic();

    assert.equal(scene.validTime, "2026-09-11T02:14:00.000Z");
    const [notice] = notices.list();
    assert.equal(
      notice.detail,
      "The live request failed. Showing NOAA's archived copy."
    );
    assert.equal(typeof notice.delayMinutes, "number");
  });

  it("throws the live failure when neither can be read", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => {
        throw new Error("MRMS echo-top unreachable: socket hang up");
      },
      async () => {
        throw new Error("No archived MRMS echo-top near then");
      }
    );

    await assert.rejects(svc.mosaic(), /socket hang up/);
    assert.equal(notices.list()[0].detail, "The live request failed.");
  });

  it("goes back to the live file, and clears, once it looks right", async (t) => {
    let whole = false;
    const { svc, inner, notices } = withFeeds(
      t,
      async () => mosaic("2026-09-11T02:18:00.000Z", !whole),
      async () => mosaic("2026-09-11T02:14:00.000Z")
    );

    await svc.mosaic();
    assert.equal(notices.list().length, 1);

    whole = true;
    inner.cache = null;
    const scene = await svc.mosaic();

    assert.equal(scene.validTime, "2026-09-11T02:18:00.000Z");
    assert.deepEqual(notices.list(), []);
  });
});
