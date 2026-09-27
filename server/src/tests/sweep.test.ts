// Node
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";

// Services
import {
  CLOUD_TOP_PRODUCT,
  PHASE_PRODUCT,
  forget,
  latestPairedKey,
  pairedKeyAt,
} from "../lib/services/goes/sweep";

/**
 * The scan the pairing exists for.
 *
 * GOES files a product's scenes under `product/year/dayOfYear/hour/`, and the
 * scan start is only in the file name. These are real names with the times
 * changed, so `sceneTime` parses them exactly as it parses the bucket's.
 */
const NAME = (product: string, doy: number, hhmmss: string) =>
  `${product}/2026/${doy}/${hhmmss.slice(0, 2)}/` +
  `OR_${product}-M6_G19_s2026${doy}${hhmmss}0_e${hhmmss}_c${hhmmss}.nc`;

/** 02:26:18, 02:31:18, 02:36:18 — three sweeps, five minutes apart. */
const SWEEPS = ["022618", "023118", "023618"];

/**
 * Answer the bucket listing out of a table of `product -> scans it filed`.
 *
 * The listing is by hour, so the stub returns every scan the product filed
 * whose hour matches the prefix that was asked for — the same slice the real
 * bucket returns, and what makes the walk back over hours testable.
 */
function bucket(filed: Record<string, string[]>) {
  return async (input: string | URL) => {
    const url = String(input);
    const prefix = decodeURIComponent(url.split("prefix=")[1] ?? "");
    const [product, , , hour] = prefix.split("/");

    const keys = (filed[product] ?? [])
      .filter((hhmmss) => hhmmss.slice(0, 2) === hour)
      .map((hhmmss) => `<Key>${NAME(product, 225, hhmmss)}</Key>`);

    return new Response(
      `<ListBucketResult>${keys.join("")}</ListBucketResult>`
    );
  };
}

/**
 * Mid-sweep on the day the fixture names are filed under.
 *
 * The live lookup walks back from *now* an hour at a time, so without a fixed
 * clock these tests would list a different number of empty hours before finding
 * the fixtures and the fetch counts below would drift with the time of day.
 */
const NOW = new Date("2026-08-13T02:40:00Z");

describe("pairing the two GOES cloud-top products onto one sweep", () => {
  beforeEach(() => forget());

  // The window this module exists for: the phase file for a sweep is published
  // about a minute before the pressure file for the same sweep, so asking each
  // product for its own newest file pairs 02:36 phase with 02:31 pressure and
  // reports one cloud measured at two moments.
  it("takes the newest scan both products filed, not each one's newest", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    t.mock.method(
      globalThis,
      "fetch",
      bucket({
        [CLOUD_TOP_PRODUCT]: SWEEPS.slice(0, 2), // 02:36 has not landed yet
        [PHASE_PRODUCT]: SWEEPS,
      })
    );

    assert.match(await latestPairedKey(CLOUD_TOP_PRODUCT), /s2026225023118/);
    assert.match(await latestPairedKey(PHASE_PRODUCT), /s2026225023118/);
  });

  it("hands both products the same scan once both have filed it", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    t.mock.method(
      globalThis,
      "fetch",
      bucket({ [CLOUD_TOP_PRODUCT]: SWEEPS, [PHASE_PRODUCT]: SWEEPS })
    );

    assert.match(await latestPairedKey(CLOUD_TOP_PRODUCT), /s2026225023618/);
    assert.match(await latestPairedKey(PHASE_PRODUCT), /s2026225023618/);
  });

  // The two services build in one `Promise.all`, so the second caller must not
  // resolve a sweep of its own underneath the first.
  it("resolves one sweep for callers that arrive together", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    const fetched = t.mock.method(
      globalThis,
      "fetch",
      bucket({ [CLOUD_TOP_PRODUCT]: SWEEPS, [PHASE_PRODUCT]: SWEEPS })
    );

    const [top, phase] = await Promise.all([
      latestPairedKey(CLOUD_TOP_PRODUCT),
      latestPairedKey(PHASE_PRODUCT),
    ]);

    assert.match(top, /s2026225023618/);
    assert.match(phase, /s2026225023618/);
    // One listing per product, not two: the second caller joined the first.
    assert.equal(fetched.mock.callCount(), 2);
  });

  it("gives up rather than serving a scan only one product filed", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    t.mock.method(
      globalThis,
      "fetch",
      bucket({ [CLOUD_TOP_PRODUCT]: SWEEPS, [PHASE_PRODUCT]: [] })
    );

    await assert.rejects(
      () => latestPairedKey(CLOUD_TOP_PRODUCT),
      /No GOES sweep with both/
    );
  });

  it("refuses a product that is not half of the pair", async (t) => {
    t.mock.timers.enable({ apis: ["Date"], now: NOW });
    t.mock.method(
      globalThis,
      "fetch",
      bucket({ [CLOUD_TOP_PRODUCT]: SWEEPS, [PHASE_PRODUCT]: SWEEPS })
    );

    await assert.rejects(
      () => latestPairedKey("ABI-L2-MCMIPC"),
      /not one of the paired GOES products/
    );
  });
});

describe("pairing a replayed sweep", () => {
  beforeEach(() => forget());

  it("takes the paired scan nearest the hour asked for", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      bucket({ [CLOUD_TOP_PRODUCT]: SWEEPS, [PHASE_PRODUCT]: SWEEPS })
    );

    const at = new Date("2026-08-13T02:32:00Z");
    assert.match(
      await pairedKeyAt(CLOUD_TOP_PRODUCT, at, 30 * 60_000),
      /s2026225023118/
    );
    assert.match(
      await pairedKeyAt(PHASE_PRODUCT, at, 30 * 60_000),
      /s2026225023118/
    );
  });

  // A scan one product is missing is not the nearest sweep, however near it is:
  // the tolerance is measured against sweeps, not against files.
  it("skips a scan only one product filed and takes the nearest paired one", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      bucket({
        [CLOUD_TOP_PRODUCT]: SWEEPS,
        [PHASE_PRODUCT]: ["022618", "023618"], // 02:31 never filed
      })
    );

    const at = new Date("2026-08-13T02:31:00Z");
    assert.match(
      await pairedKeyAt(CLOUD_TOP_PRODUCT, at, 30 * 60_000),
      /s2026225022618/
    );
  });

  it("refuses to caption a distant sweep as the time asked for", async (t) => {
    t.mock.method(
      globalThis,
      "fetch",
      bucket({ [CLOUD_TOP_PRODUCT]: SWEEPS, [PHASE_PRODUCT]: SWEEPS })
    );

    // The nearest paired sweep to 02:50 is 02:36:18, ~14 minutes away.
    await assert.rejects(
      () =>
        pairedKeyAt(
          CLOUD_TOP_PRODUCT,
          new Date("2026-08-13T02:50:00Z"),
          60_000
        ),
      /refusing to caption it as that time/
    );
  });

  it("rejects an unparseable time rather than resolving one", async () => {
    await assert.rejects(
      () => pairedKeyAt(CLOUD_TOP_PRODUCT, new Date("nonsense"), 60_000),
      /ISO 8601/
    );
  });
});
