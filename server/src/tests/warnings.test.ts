// Node
import { describe, it } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  alertsAt,
  minuteOf,
  touchesBox,
  warningsAt,
  warningStats,
  WarningService,
} from "../lib/services/nws/warnings";
import { NoticeBoard } from "../lib/services/shared/notices";
import type {
  AlertCollection,
  SbwCollection,
  WarningGeometry,
} from "../lib/services/nws/warnings";

const square = (lon: number, lat: number): WarningGeometry => ({
  type: "MultiPolygon",
  coordinates: [
    [
      [
        [lon, lat],
        [lon + 0.5, lat],
        [lon + 0.5, lat + 0.5],
        [lon, lat],
      ],
    ],
  ],
});

type Row = SbwCollection["features"][number];

function row(
  overrides: Partial<Row["properties"]>,
  geometry = square(-103.5, 31)
): Row {
  return {
    properties: {
      phenomena: "SV",
      significance: "W",
      wfo: "MAF",
      eventid: 102,
      polygon_begin: "2025-04-26T22:26:00Z",
      polygon_end: "2025-04-26T22:45:00Z",
      ...overrides,
    },
    geometry,
  };
}

const AT = new Date("2025-04-26T22:44:00Z");

describe("warningsAt", () => {
  it("keeps a severe thunderstorm warning in force at the minute", () => {
    const [warning] = warningsAt({ features: [row({})] }, AT);
    assert.deepEqual(warning.properties, {
      phenomenon: "SV",
      event: "Severe Thunderstorm Warning",
      office: "MAF",
      eventId: 102,
      begins: "2025-04-26T22:26:00.000Z",
      ends: "2025-04-26T22:45:00.000Z",
    });
  });

  it("keeps tornado warnings", () => {
    const kept = warningsAt({ features: [row({ phenomena: "TO" })] }, AT);
    assert.equal(kept[0].properties.event, "Tornado Warning");
  });

  // Every filed Texas operating plan suspends seeding under a flood warning.
  it("keeps flash flood warnings", () => {
    const kept = warningsAt({ features: [row({ phenomena: "FF" })] }, AT);
    assert.equal(kept[0].properties.event, "Flash Flood Warning");
  });

  // The snapshot is every storm-based product: flood warnings, advisories,
  // watches. Only the two a seeding permit turns on are drawn.
  it("drops flood products and anything that is not a warning", () => {
    const kept = warningsAt(
      {
        features: [
          row({ phenomena: "FL" }),
          row({ phenomena: "FA" }),
          row({ significance: "A" }),
          row({ phenomena: "constructor" }),
        ],
      },
      AT
    );
    assert.equal(kept.length, 0);
  });

  // A polygon ends exactly when the next statement's begins, so the end is
  // exclusive or a minute would carry both.
  it("drops polygons not yet in force or already lapsed", () => {
    const kept = warningsAt(
      {
        features: [
          row({
            polygon_begin: "2025-04-26T22:45:00Z",
            polygon_end: "2025-04-26T23:15:00Z",
          }),
          row({ polygon_end: "2025-04-26T22:44:00Z" }),
        ],
      },
      AT
    );
    assert.equal(kept.length, 0);
  });

  it("drops rows with no geometry", () => {
    const bare = { ...row({}), geometry: null };
    assert.equal(warningsAt({ features: [bare] }, AT).length, 0);
  });
});

describe("touchesBox", () => {
  const box = { west: -104, east: -102, south: 30, north: 32 };

  it("keeps a polygon with a vertex inside", () => {
    assert.equal(touchesBox(square(-103.5, 31), box), true);
  });

  it("keeps a polygon that covers the whole box", () => {
    const wide: WarningGeometry = {
      type: "Polygon",
      coordinates: [
        [
          [-110, 20],
          [-90, 20],
          [-90, 40],
          [-110, 20],
        ],
      ],
    };
    assert.equal(touchesBox(wide, box), true);
  });

  it("drops a polygon elsewhere", () => {
    assert.equal(touchesBox(square(-86.5, 30.6), box), false);
  });
});

describe("warningStats", () => {
  it("counts each kind of warning apart", () => {
    const features = warningsAt(
      {
        features: [
          row({}),
          row({ eventid: 103 }),
          row({ phenomena: "TO" }),
          row({ phenomena: "FF" }),
        ],
      },
      AT
    );
    const stats = warningStats({
      type: "FeatureCollection",
      validTime: AT.toISOString(),
      fetchedAt: AT.toISOString(),
      features,
    });
    assert.equal(stats.count, 4);
    assert.equal(stats.severe, 2);
    assert.equal(stats.tornado, 1);
    assert.equal(stats.flood, 1);
  });
});

type Alert = AlertCollection["features"][number];

function alert(
  overrides: Partial<Alert["properties"]>,
  vtec = "/O.CON.KMAF.SV.W.0102.000000T0000Z-250426T2245Z/"
): Alert {
  const now = Date.now();
  return {
    properties: {
      messageType: "Update",
      sent: new Date(now - 10 * 60_000).toISOString(),
      ends: new Date(now + 20 * 60_000).toISOString(),
      expires: new Date(now + 20 * 60_000).toISOString(),
      parameters: { VTEC: [vtec] },
      ...overrides,
    },
    geometry: square(-103.5, 31),
  };
}

describe("alertsAt", () => {
  const now = new Date();

  it("reads office, phenomenon and event number from the VTEC string", () => {
    const [warning] = alertsAt({ features: [alert({})] }, now);
    assert.equal(warning.properties.office, "MAF");
    assert.equal(warning.properties.phenomenon, "SV");
    assert.equal(warning.properties.eventId, 102);
    assert.equal(warning.properties.event, "Severe Thunderstorm Warning");
  });

  it("reads flash flood warnings", () => {
    const [warning] = alertsAt(
      {
        features: [
          alert({}, "/O.NEW.KMAF.FF.W.0007.250427T0041Z-250427T0345Z/"),
        ],
      },
      now
    );
    assert.equal(warning.properties.event, "Flash Flood Warning");
  });

  it("reads tornado warnings", () => {
    const [warning] = alertsAt(
      {
        features: [
          alert({}, "/O.NEW.KSJT.TO.W.0019.250526T2059Z-250526T2145Z/"),
        ],
      },
      now
    );
    assert.equal(warning.properties.event, "Tornado Warning");
    assert.equal(warning.properties.office, "SJT");
  });

  // A cancellation still carries the polygon it cancels.
  it("drops cancellations", () => {
    const kept = alertsAt(
      {
        features: [
          alert({ messageType: "Cancel" }),
          alert({}, "/O.CAN.KMAF.SV.W.0102.000000T0000Z-250426T2245Z/"),
        ],
      },
      now
    );
    assert.equal(kept.length, 0);
  });

  it("keeps a warning's latest statement only", () => {
    const newer = alert({
      sent: new Date(now.getTime() - 60_000).toISOString(),
    });
    newer.geometry = square(-103, 31);
    const kept = alertsAt({ features: [alert({}), newer] }, now);
    assert.equal(kept.length, 1);
    assert.deepEqual(kept[0].geometry, square(-103, 31));
  });

  it("falls back to the expiry when a statement names no end", () => {
    const kept = alertsAt({ features: [alert({ ends: null })] }, now);
    assert.equal(kept.length, 1);
  });

  it("drops lapsed statements and anything without a warning VTEC", () => {
    const kept = alertsAt(
      {
        features: [
          alert({ ends: new Date(now.getTime() - 1).toISOString() }),
          alert({}, "/O.NEW.KMAF.SV.A.0102.000000T0000Z-250426T2245Z/"),
          alert({}, "/O.NEW.KMAF.FA.W.0007.000000T0000Z-250426T2245Z/"),
          alert({ parameters: {} }),
        ],
      },
      now
    );
    assert.equal(kept.length, 0);
  });
});

describe("minuteOf", () => {
  it("truncates to the minute the archive's ts wants", () => {
    assert.equal(
      minuteOf(new Date("2025-04-26T22:44:37.5Z")),
      "2025-04-26T22:44Z"
    );
  });
});

describe("WarningService", () => {
  it("asks the archive for the replayed minute and clips to the box", async (t) => {
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string) => {
      urls.push(url);
      return new Response(
        JSON.stringify({
          features: [row({}), row({ wfo: "MOB" }, square(-86.5, 30.6))],
        })
      );
    });
    const service = new WarningService();
    const frame = await service.warnings(new Date("2025-04-26T22:44:37Z"), {
      west: -107,
      east: -93,
      south: 25.5,
      north: 37,
    });
    assert.deepEqual(urls, [
      "https://mesonet.agron.iastate.edu/geojson/sbw.geojson?ts=2025-04-26T22:44Z",
    ]);
    assert.equal(frame.validTime, "2025-04-26T22:44:00.000Z");
    assert.deepEqual(
      frame.features.map((f) => f.properties.office),
      ["MAF"]
    );
  });

  it("serves a replayed minute from one request", async (t) => {
    const fetched = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify({ features: [row({})] }))
    );
    const service = new WarningService();
    await Promise.all([service.warnings(AT), service.stats(AT)]);
    assert.equal(fetched.mock.callCount(), 1);
  });

  it("reads live warnings from the NWS alerts API", async (t) => {
    const urls: string[] = [];
    const agents: (string | null)[] = [];
    t.mock.method(
      globalThis,
      "fetch",
      async (url: string, init: RequestInit) => {
        urls.push(url);
        agents.push(new Headers(init.headers).get("User-Agent"));
        return new Response(JSON.stringify({ features: [alert({})] }));
      }
    );
    const board = new NoticeBoard();
    const stats = await new WarningService(board).stats();
    assert.equal(urls.length, 1);
    assert.match(urls[0], /^https:\/\/api\.weather\.gov\/alerts\/active\?/);
    assert.match(urls[0], /Flash%20Flood%20Warning/);
    assert.ok(agents[0]);
    assert.equal(stats.count, 1);
    assert.deepEqual(board.list(), []);
  });

  it("draws the archive and says so when the alerts API fails", async (t) => {
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string) => {
      urls.push(url);
      return url.startsWith("https://api.weather.gov")
        ? new Response("", { status: 500 })
        : new Response(JSON.stringify({ features: [] }));
    });
    const board = new NoticeBoard();
    const stats = await new WarningService(board).stats();
    assert.equal(stats.count, 0);
    assert.match(urls[1], /sbw\.geojson\?ts=/);
    assert.equal(board.list()[0].source, "NWS severe weather warnings");
    assert.match(board.list()[0].detail, /Iowa Environmental Mesonet/);
  });

  // No warnings is the usual answer, not a broken feed.
  it("does not fall back when nothing is in force", async (t) => {
    const fetched = t.mock.method(
      globalThis,
      "fetch",
      async () => new Response(JSON.stringify({ features: [] }))
    );
    const board = new NoticeBoard();
    const stats = await new WarningService(board).stats();
    assert.equal(stats.count, 0);
    assert.equal(fetched.mock.callCount(), 1);
    assert.deepEqual(board.list(), []);
  });

  it("does not keep a failed minute", async (t) => {
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls += 1;
      return calls === 1
        ? new Response("", { status: 503 })
        : new Response(JSON.stringify({ features: [] }));
    });
    const service = new WarningService();
    await assert.rejects(service.warnings(AT), /503/);
    const frame = await service.warnings(AT);
    assert.equal(frame.features.length, 0);
  });
});
