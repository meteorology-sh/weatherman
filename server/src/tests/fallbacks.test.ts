// Node
import { describe, it, beforeEach } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";

// Services
import { RadarService } from "../lib/services/mrms/radar";
import {
  LiveCycles,
  RunDiscovery,
  expectedRun,
} from "../lib/services/hrrr/bytes";
import { CloudTopService } from "../lib/services/goes/cloudtop";
import { CloudPhaseService } from "../lib/services/goes/phase";
import { LightningService } from "../lib/services/goes/lightning";
import { BUCKET, MIRROR, keysInHour } from "../lib/services/goes/scene";
import {
  CLOUD_TOP_PRODUCT,
  PHASE_PRODUCT,
  forget,
  latestPairedKey,
} from "../lib/services/goes/sweep";
import { NoticeBoard } from "../lib/services/shared/notices";

// Types
import type { Cycle } from "../lib/services/hrrr/bytes";

const REQUEST_FAILED_COPY = (copy: string) =>
  `The live request failed. Showing ${copy}.`;

describe("RadarService live feed", () => {
  /** A 2x2 mosaic, each cell one quarter; `hole` leaves a quarter uncovered. */
  const radarScene = (validTime: string, hole = false) => ({
    frame: { type: "FeatureCollection", validTime, features: [] },
    stats: { validTime },
    grid: {
      nx: 2,
      ny: 2,
      values: Float32Array.from([30, -99, 20, hole ? -999 : 10]),
    },
  });
  type Scene = ReturnType<typeof radarScene>;
  type Internals = {
    build(key?: string): Promise<Scene>;
    sceneAt(at: Date): Promise<string>;
  };

  function withFeeds(
    t: TestContext,
    live: () => Promise<Scene>,
    archived: () => Promise<Scene>
  ) {
    const notices = new NoticeBoard();
    const svc = new RadarService(notices);
    const inner = svc as unknown as Internals;
    t.mock.method(inner, "sceneAt", async () => "archived-key");
    t.mock.method(inner, "build", async (key?: string) =>
      key ? archived() : live()
    );
    return { svc, notices };
  }

  it("draws the live mosaic and says nothing when it looks right", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => radarScene("2026-09-16T17:00:00.000Z"),
      async () => radarScene("2026-09-16T16:56:00.000Z")
    );

    const field = await svc.reflectivityField();

    assert.equal(field.validTime, "2026-09-16T17:00:00.000Z");
    assert.deepEqual(notices.list(), []);
  });

  it("draws NOAA's archived copy when a quarter has no coverage", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => radarScene("2026-09-16T17:00:00.000Z", true),
      async () => radarScene("2026-09-16T16:56:00.000Z")
    );

    const field = await svc.reflectivityField();

    assert.equal(field.validTime, "2026-09-16T16:56:00.000Z");
    const [notice] = notices.list();
    assert.equal(notice.source, "MRMS reflectivity");
    assert.equal(
      notice.detail,
      "The live data looks wrong. Showing NOAA's archived copy."
    );
    assert.equal(notice.delayMinutes, 4);
  });

  it("draws NOAA's archived copy when the live request fails", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      async () => {
        throw new Error("MRMS mosaic unreachable: socket hang up");
      },
      async () => radarScene("2026-09-16T16:56:00.000Z")
    );

    const field = await svc.reflectivityField();

    assert.equal(field.validTime, "2026-09-16T16:56:00.000Z");
    assert.equal(
      notices.list()[0].detail,
      REQUEST_FAILED_COPY("NOAA's archived copy")
    );
  });
});

describe("LiveCycles", () => {
  const NOW = new Date("2026-09-16T17:20:00.000Z");
  const LIVE_RUN = new Date("2026-09-16T16:00:00.000Z");
  const ARCHIVE_RUN = new Date("2026-09-16T15:00:00.000Z");

  /** Discovery that answers `run`, or fails when `run` is null. */
  function discovery(t: TestContext, run: () => Date | null) {
    const found = new RunDiscovery();
    const latest = t.mock.method(found, "latest", async () => {
      const answer = run();
      if (!answer) throw new Error("No published HRRR run found");
      return answer;
    });
    return { found, latest };
  }

  function cycles(
    t: TestContext,
    nomadsRun: () => Date | null,
    archiveRun: () => Date | null
  ) {
    const notices = new NoticeBoard();
    const nomads = discovery(t, nomadsRun);
    const archive = discovery(t, archiveRun);
    return {
      live: new LiveCycles(notices, nomads.found, archive.found),
      notices,
      nomads: nomads.latest,
    };
  }

  const origin = async (cycle: Cycle) => cycle;

  it("reads NOMADS and says nothing while it answers", async (t) => {
    const { live, notices } = cycles(
      t,
      () => LIVE_RUN,
      () => ARCHIVE_RUN
    );

    const cycle = await live.read(origin);

    assert.deepEqual(cycle, { run: LIVE_RUN, origin: "nomads" });
    assert.deepEqual(notices.list(), []);
  });

  it("reads the archive's newest run when NOMADS names none", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    const { live, notices } = cycles(
      t,
      () => null,
      () => ARCHIVE_RUN
    );

    const cycle = await live.read(origin);

    assert.deepEqual(cycle, { run: ARCHIVE_RUN, origin: "archive" });
    const [notice] = notices.list();
    assert.equal(notice.source, "NOAA HRRR");
    assert.equal(notice.detail, REQUEST_FAILED_COPY("NOAA's archived copy"));
    // 16z is the run NOMADS should be serving at 17:20.
    assert.equal(notice.delayMinutes, 60);
  });

  it("reads the build again from the archive when NOMADS fails partway", async (t) => {
    const { live, notices } = cycles(
      t,
      () => LIVE_RUN,
      () => LIVE_RUN
    );
    const origins: string[] = [];

    const answer = await live.read(async (cycle) => {
      origins.push(cycle.origin);
      if (cycle.origin === "nomads") throw new Error("HRRR index unavailable");
      return cycle.run;
    });

    assert.deepEqual(origins, ["nomads", "archive"]);
    assert.equal(answer, LIVE_RUN);
    assert.equal(notices.list()[0].delayMinutes, 0);
  });

  it("passes NOMADS over while it rests, then asks it again", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    let up = false;
    const { live, notices, nomads } = cycles(
      t,
      () => (up ? LIVE_RUN : null),
      () => ARCHIVE_RUN
    );

    await live.read(origin);
    up = true;
    assert.equal((await live.read(origin)).origin, "archive");
    assert.equal(nomads.mock.callCount(), 1);

    t.mock.timers.tick(5 * 60_000);
    assert.equal((await live.read(origin)).origin, "nomads");
    assert.deepEqual(notices.list(), []);
  });

  it("throws the NOMADS failure when the archive fails too", async (t) => {
    const { live, notices } = cycles(
      t,
      () => LIVE_RUN,
      () => null
    );

    await assert.rejects(
      live.read(async (cycle) => {
        if (cycle.origin === "nomads") throw new Error("NOMADS 503");
        return cycle;
      }),
      /NOMADS 503/
    );
    assert.equal(notices.list()[0].detail, "The live request failed.");
    assert.equal(notices.list()[0].delayMinutes, null);
  });

  it("expects the cycle from the previous hour", () => {
    assert.equal(expectedRun(NOW).toISOString(), LIVE_RUN.toISOString());
  });
});

/** A GOES-style name for `product` scanned at 2026-09-16 (day 259) `hhmmss`. */
const NAME = (product: string, hhmmss: string) =>
  `${product}/2026/259/${hhmmss.slice(0, 2)}/` +
  `OR_${product}-M6_G19_s2026259${hhmmss}0_e${hhmmss}_c${hhmmss}.nc`;

const GOES_NOW = new Date("2026-09-16T17:12:00.000Z");

/**
 * A listing that fails on AWS and answers from the mirror, or answers from
 * both when `awsUp`.
 */
function buckets(awsUp: boolean, hhmmss: string[]) {
  return async (input: string | URL) => {
    const url = String(input);
    if (url.startsWith(BUCKET) && !awsUp) {
      throw new TypeError("fetch failed");
    }
    const prefix = decodeURIComponent(url.split("prefix=")[1] ?? "");
    const [product, , , hour] = prefix.split("/");
    const keys = hhmmss
      .filter((scan) => scan.slice(0, 2) === hour)
      .map((scan) => `<Key>${NAME(product, scan)}</Key>`);
    return new Response(
      `<ListBucketResult>${keys.join("")}</ListBucketResult>`
    );
  };
}

describe("the GOES mirror", () => {
  beforeEach(() => forget());

  it("hands back mirror keys as full URLs", async (t) => {
    t.mock.method(globalThis, "fetch", buckets(true, ["170618"]));

    const [key] = await keysInHour(CLOUD_TOP_PRODUCT, GOES_NOW, MIRROR);

    assert.equal(key, `${MIRROR}/${NAME(CLOUD_TOP_PRODUCT, "170618")}`);
  });

  it("keeps the mirror's sweep apart from AWS's", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: GOES_NOW });
    t.mock.method(globalThis, "fetch", buckets(true, ["170618"]));

    const aws = await latestPairedKey(CLOUD_TOP_PRODUCT);
    const mirror = await latestPairedKey(CLOUD_TOP_PRODUCT, MIRROR);

    assert.ok(!aws.startsWith("https://"), aws);
    assert.ok(mirror.startsWith(MIRROR), mirror);
  });

  for (const [name, make, product] of [
    [
      "GOES-East cloud top",
      (b: NoticeBoard) => new CloudTopService(b),
      CLOUD_TOP_PRODUCT,
    ],
    [
      "GOES-East cloud phase",
      (b: NoticeBoard) => new CloudPhaseService(b),
      PHASE_PRODUCT,
    ],
  ] as const) {
    it(`reads ${name} from the mirror when AWS fails`, async (t) => {
      t.mock.timers.enable({ apis: ["Date"], now: GOES_NOW });
      t.mock.method(globalThis, "fetch", buckets(false, ["170618"]));
      const notices = new NoticeBoard();
      const inner = make(notices) as unknown as {
        read(key: string): Promise<{ key: string }>;
        readLive(): Promise<{ key: string }>;
      };
      t.mock.method(inner, "read", async (key: string) => ({ key }));

      const scene = await inner.readLive();

      assert.equal(scene.key, `${MIRROR}/${NAME(product, "170618")}`);
      const [notice] = notices.list();
      assert.equal(notice.source, name);
      assert.equal(notice.detail, REQUEST_FAILED_COPY("Google Cloud's copy"));
      assert.equal(notice.delayMinutes, 6);
    });
  }
});

describe("LightningService live feed", () => {
  type Bundle = {
    validTime: string;
    flashes: { lat: number; lon: number }[];
    granules: number;
    unread: number;
  };
  const bundle = (over: Partial<Bundle>): Bundle => ({
    validTime: "2026-09-16T17:11:40.000Z",
    flashes: [{ lat: 33.5, lon: -101.9 }],
    granules: 15,
    unread: 0,
    ...over,
  });

  function withFeeds(t: TestContext, live: Bundle, mirror: Bundle) {
    const notices = new NoticeBoard();
    const svc = new LightningService(notices);
    const inner = svc as unknown as {
      build(at?: Date, bucket?: string): Promise<Bundle>;
    };
    t.mock.method(inner, "build", async (_at?: Date, bucket?: string) =>
      bucket === MIRROR ? mirror : live
    );
    return { svc, notices };
  }

  it("draws the live window and says nothing when every granule reads", async (t) => {
    const { svc, notices } = withFeeds(t, bundle({}), bundle({ flashes: [] }));

    const frame = await svc.flashes();

    assert.equal(frame.features.length, 1);
    assert.deepEqual(notices.list(), []);
  });

  // GLM files a granule every 20 seconds, flashes or not.
  it("treats an empty window as missing data, not quiet weather", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      bundle({
        flashes: [],
        granules: 0,
        validTime: "2026-09-16T17:12:00.000Z",
      }),
      bundle({ validTime: "2026-09-16T17:11:40.000Z" })
    );

    const frame = await svc.flashes();

    assert.equal(frame.features.length, 1);
    const [notice] = notices.list();
    assert.equal(notice.source, "GOES-East lightning");
    assert.equal(
      notice.detail,
      "The live data looks wrong. Showing Google Cloud's copy."
    );
    assert.equal(notice.delayMinutes, 0);
  });

  it("says so when a granule will not read on either bucket", async (t) => {
    const { svc, notices } = withFeeds(
      t,
      bundle({ unread: 2 }),
      bundle({ unread: 1, flashes: [] })
    );

    const frame = await svc.flashes();

    assert.equal(frame.features.length, 1);
    assert.equal(notices.list()[0].detail, "The live data looks wrong.");
    assert.equal(notices.list()[0].delayMinutes, null);
  });
});
