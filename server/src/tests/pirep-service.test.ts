// Node
import { describe, it } from "node:test";
import type { TestContext } from "node:test";
import assert from "node:assert/strict";

// Services
import { PirepService, severityOf } from "../lib/services/pirep";

/** One upstream feature, shaped the way aviationweather.gov shapes them. */
const report = (
  properties: Record<string, unknown>,
  coordinates: number[] | null = [-105.3, 40.59]
) => ({
  type: "Feature",
  properties,
  geometry: coordinates ? { type: "Point", coordinates } : null,
});

/** A real report from the feed: a PC-12 in light rime at −9 °C, FL220. */
const rime = report({
  rawOb: "DEN UA /OV DEN320055/TM 0320/FL220/TP PC12/TA M09/IC MOD RIME",
  obsTime: "2026-08-12T03:20:00.000Z",
  fltlvl: 220,
  temp: -9,
  icgInt1: "MOD",
  icgType1: "RIME",
  aircraft: "Pilatus PC-12",
});

/** Turbulence only — no icing field at all. Nine in ten reports look like this. */
const turbulence = report({
  rawOb: "ORD UA /OV 20 SE GYY/TM 0315/FL150/TP E170/TB MDT IN LAYER",
  obsTime: "2026-08-12T03:15:00.000Z",
  fltlvl: 150,
  tbInt1: "MOD",
});

const feed = (features: unknown[]) => ({
  ok: true,
  json: async () => ({ type: "FeatureCollection", features }),
});

const respond = (t: TestContext, features: unknown[]) =>
  t.mock.method(globalThis, "fetch", async () => feed(features) as Response);

describe("severityOf", () => {
  it("ranks the intensity codes pilots file", () => {
    assert.equal(severityOf("NEG"), 0);
    assert.equal(severityOf("TRC"), 1);
    assert.equal(severityOf("LGT"), 2);
    assert.equal(severityOf("MOD"), 3);
    assert.equal(severityOf("SEV"), 4);
  });

  // A range is one report, and the upper end is the number that matters for
  // finding liquid water.
  it("ranks a range at the worst class it names", () => {
    assert.equal(severityOf("LGT-MOD"), 3);
    assert.equal(severityOf("MOD-SEV"), 4);
    assert.equal(severityOf("TRC-LGT"), 2);
  });

  // The feed really emits this form; matching the whole string would drop it.
  it("reads NEGclr as a negative report", () => {
    assert.equal(severityOf("NEGclr"), 0);
  });

  it("has no rank for a report with no icing field", () => {
    assert.equal(severityOf(undefined), null);
    assert.equal(severityOf(""), null);
  });

  it("refuses to guess at a code it does not know", () => {
    assert.equal(severityOf("WAT"), null);
  });
});

describe("PirepService.icing", () => {
  it("keeps only the reports carrying an icing field", async (t) => {
    const svc = new PirepService();
    respond(t, [rime, turbulence]);

    const frame = await svc.icing();

    assert.equal(frame.features.length, 1);
    assert.equal(frame.features[0].properties.intensity, "MOD");
  });

  it("keeps negative reports, which falsify the model", async (t) => {
    const svc = new PirepService();
    respond(t, [
      report({ icgInt1: "NEG", obsTime: "2026-08-12T02:34:00.000Z" }),
    ]);

    const frame = await svc.icing();

    assert.equal(frame.features.length, 1);
    assert.equal(frame.features[0].properties.severity, 0);
  });

  it("carries the fields the popup and the renderer read", async (t) => {
    const svc = new PirepService();
    respond(t, [rime]);

    const { properties } = (await svc.icing()).features[0];

    assert.equal(properties.severity, 3);
    assert.equal(properties.iceType, "RIME");
    assert.equal(properties.tempC, -9);
    assert.equal(properties.aircraft, "Pilatus PC-12");
    assert.ok(properties.raw.includes("IC MOD RIME"));
  });

  // The feed reports flight level in hundreds of feet; an operator reads feet.
  it("converts flight level to feet", async (t) => {
    const svc = new PirepService();
    respond(t, [rime]);

    const { properties } = (await svc.icing()).features[0];

    assert.equal(properties.flightLevelFt, 22000);
  });

  it("preformats the observation time for the popup", async (t) => {
    const svc = new PirepService();
    respond(t, [rime]);

    const { properties } = (await svc.icing()).features[0];

    assert.equal(properties.obsTime, "2026-08-12T03:20:00.000Z");
    assert.equal(properties.obsLabel, "12 Aug 03:20Z");
  });

  it("lays out the popup's detail line", async (t) => {
    const svc = new PirepService();
    respond(t, [rime]);

    const { properties } = (await svc.icing()).features[0];

    assert.equal(properties.detail, "22000 ft · -9 °C · RIME · Pilatus PC-12");
  });

  // A popup template cannot skip an absent field, and a negative report usually
  // has neither a type nor a temperature — so the gaps have to close here.
  it("leaves no dangling separators when fields are missing", async (t) => {
    const svc = new PirepService();
    respond(t, [report({ icgInt1: "NEG", fltlvl: 240 })]);

    const { properties } = (await svc.icing()).features[0];

    assert.equal(properties.detail, "24000 ft");
  });

  it("keeps the position the aircraft reported", async (t) => {
    const svc = new PirepService();
    respond(t, [rime]);

    const { geometry } = (await svc.icing()).features[0];

    assert.equal(geometry.type, "Point");
    assert.deepEqual(geometry.coordinates, [-105.3, 40.59]);
  });

  it("drops a report with no position, which cannot be drawn", async (t) => {
    const svc = new PirepService();
    respond(t, [
      report({ icgInt1: "LGT", obsTime: "2026-08-12T01:00:00.000Z" }, null),
    ]);

    assert.deepEqual((await svc.icing()).features, []);
  });

  it("asks for CONUS over the last 12 hours", async (t) => {
    const svc = new PirepService();
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string | URL) => {
      urls.push(String(url));
      return feed([]) as Response;
    });

    await svc.icing();

    assert.ok(urls[0].includes("format=geojson"), urls[0]);
    assert.ok(urls[0].includes("age=12"), urls[0]);
    assert.ok(urls[0].includes("bbox=25%2C-125%2C50%2C-66"), urls[0]);
  });

  // types=ice is accepted and ignored upstream. Sending it would cost us the
  // denominator the stats are built on and buy nothing.
  it("does not ask the API to filter, because it will not", async (t) => {
    const svc = new PirepService();
    const urls: string[] = [];
    t.mock.method(globalThis, "fetch", async (url: string | URL) => {
      urls.push(String(url));
      return feed([]) as Response;
    });

    await svc.icing();

    assert.ok(!urls[0].includes("types="), urls[0]);
  });

  it("fails loudly when the feed is down", async (t) => {
    const svc = new PirepService();
    t.mock.method(
      globalThis,
      "fetch",
      async () => ({ ok: false, status: 503 }) as Response
    );

    await assert.rejects(svc.icing(), /Icing PIREPs unavailable: 503/);
  });
});

describe("PirepService seeding band", () => {
  const at = (temp: number | undefined, icgInt1 = "LGT") =>
    report({ icgInt1, temp, obsTime: "2026-08-12T03:00:00.000Z" });

  it("marks a report inside -5..-12 C", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-9)]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 1);
  });

  it("includes both ends of the band", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-5), at(-18)]);

    const flags = (await svc.icing()).features.map((f) => f.properties.inBand);
    assert.deepEqual(flags, [1, 1]);
  });

  // The band was -5..-12 until 2026-08-12. AgI works to about -20 C; what
  // thins out below -12 is the supply of liquid, not the agent, so a report at
  // -15 C is a real confirmation the old bound threw away.
  it("keeps a report between the old bound and the new one", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-15)]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 1);
  });

  it("still excludes a report just past the new bound", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-19)]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 0);
  });

  // Ice at -24 C confirms an aircraft iced up; it does not confirm anything is
  // left to seed — natural ice nuclei have taken the liquid by then.
  it("excludes a report colder than the band", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-24)]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 0);
  });

  it("excludes a report warmer than the band", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-2)]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 0);
  });

  // "We cannot say" must not be promoted to "yes" — the layer filters on this.
  it("excludes a report that gave no temperature", async (t) => {
    const svc = new PirepService();
    respond(t, [at(undefined)]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 0);
  });

  it("excludes a negative report even at a band temperature", async (t) => {
    const svc = new PirepService();
    respond(t, [at(-9, "NEG")]);

    assert.equal((await svc.icing()).features[0].properties.inBand, 0);
  });
});

describe("PirepService.icingStats", () => {
  const mixed = [
    turbulence,
    report({ icgInt1: "NEG", obsTime: "2026-08-12T01:00:00.000Z" }),
    report({ icgInt1: "LGT", temp: -8, obsTime: "2026-08-12T02:00:00.000Z" }),
    rime, // MOD, -9 C, 03:20Z
    report({ icgInt1: "LGT", temp: -24, obsTime: "2026-08-12T02:30:00.000Z" }),
  ];

  it("reports the denominator, not just the hits", async (t) => {
    const svc = new PirepService();
    respond(t, mixed);

    const stats = await svc.icingStats();

    assert.equal(stats.reports, 5);
    assert.equal(stats.icing, 4);
    assert.equal(stats.positive, 3);
  });

  it("counts only the positives that are in the seeding band", async (t) => {
    const svc = new PirepService();
    respond(t, mixed);

    assert.equal((await svc.icingStats()).inBand, 2);
  });

  it("reports the most recent positive report, not the most recent report", async (t) => {
    const svc = new PirepService();
    respond(t, mixed);

    assert.equal((await svc.icingStats()).latest, "2026-08-12T03:20:00.000Z");
  });

  it("has no latest when nobody found ice", async (t) => {
    const svc = new PirepService();
    respond(t, [turbulence, report({ icgInt1: "NEG" })]);

    const stats = await svc.icingStats();

    assert.equal(stats.positive, 0);
    assert.equal(stats.latest, null);
  });

  it("names the window it covers, so the counts can be read", async (t) => {
    const svc = new PirepService();
    respond(t, mixed);

    assert.equal((await svc.icingStats()).windowHours, 12);
  });
});

describe("PirepService cache", () => {
  it("serves the frame and the stats from one pull", async (t) => {
    const svc = new PirepService();
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return feed([rime]) as Response;
    });

    await svc.icing();
    await svc.icingStats();

    assert.equal(calls, 1);
  });

  it("re-pulls once the reports have gone stale", async (t) => {
    const svc = new PirepService();
    t.mock.timers.enable({ apis: ["Date"] });
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return feed([rime]) as Response;
    });

    await svc.icing();
    t.mock.timers.tick(5 * 60_000 + 1);
    await svc.icing();

    assert.equal(calls, 2);
  });

  it("does not re-pull inside the window", async (t) => {
    const svc = new PirepService();
    t.mock.timers.enable({ apis: ["Date"] });
    let calls = 0;
    t.mock.method(globalThis, "fetch", async () => {
      calls++;
      return feed([rime]) as Response;
    });

    await svc.icing();
    t.mock.timers.tick(4 * 60_000);
    await svc.icing();

    assert.equal(calls, 1);
  });
});
