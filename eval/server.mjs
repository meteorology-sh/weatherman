/**
 * The flight record and the scores, over HTTP, for the eval map to draw.
 *
 * `node eval/server.mjs` — port 3100. It reads the committed ground truth in
 * `data/` and whatever the sweeps have written to `out/`, and serves both. It
 * holds no weather: every layer the map draws comes from the Weatherman server
 * itself, so the picture under the flares is the app's own output rather than a
 * second rendering of the same idea.
 *
 * **Separate from the Weatherman server on purpose.** What it serves is
 * operator-reported ground truth and our own scoring of it — neither is a
 * measurement the app makes, and `out/` is a working directory that is not
 * committed. A product that read from it would break the moment a sweep was
 * cleared.
 */

// Node
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.EVAL_PORT ?? 3100);

/**
 * Read once at startup and hold it.
 *
 * The release record is a few hundred KB and never changes while the server is
 * up. The scores do change — a sweep rewrites them after every day — so they
 * are re-read per request and allowed to be missing.
 */
const { days } = JSON.parse(
  await readFile(join(HERE, "data", "releases-2025.json"), "utf8")
);
/**
 * The county boundaries, with an id stamped on each.
 *
 * TIGERweb sends a name and a GEOID and no object id, and a GeoJSONLayer that
 * is told which field is its id will not load without one. Numbered here rather
 * than in `counties.mjs` so the committed file stays exactly what the Census
 * served.
 */
const counties = JSON.stringify(
  await readFile(join(HERE, "data", "counties-tx.geojson"), "utf8").then(
    (text) => {
      const collection = JSON.parse(text);
      collection.features.forEach((feature, index) => {
        feature.properties = { OBJECTID: index + 1, ...feature.properties };
      });
      return collection;
    }
  )
);

const seeded = days.filter((day) => day.seeded);

/** The season sweep's output, or nothing if it has not been run. */
async function scores() {
  try {
    return JSON.parse(
      await readFile(join(HERE, "out", "season-2025.json"), "utf8")
    );
  } catch {
    return null;
  }
}

/**
 * The scored rows for one day, keyed by release time.
 *
 * A day that errored out mid-sweep is not a day with no candidates — it is a
 * day with no answer, and the two have to stay distinguishable or a server
 * restart reads as a meteorological finding.
 */
async function rowsFor(date) {
  const season = await scores();
  const day = season?.days.find((entry) => entry.date === date);
  if (!day) return null;

  const byTime = new Map();
  for (const row of day.rows) byTime.set(row.release.at, row.answer);
  return byTime;
}

/**
 * How far the answer's inputs sat from the moment the flare left the aircraft.
 *
 * Carried per release rather than stated once for the day, because the three
 * sources drift apart differently: the model is pinned to its analysis hour
 * while the satellite and the radar follow the release. This is the slop in the
 * comparison and the map has to be able to show it.
 */
function gaps(at, answer) {
  if (!answer || answer.error || answer.outsideDomain) return null;
  const t = new Date(at).getTime();
  const minutes = (iso) =>
    iso ? Math.round((new Date(iso).getTime() - t) / 60000) : null;

  return {
    model: minutes(answer.validTime),
    satellite: minutes(answer.sceneTime),
    radar: minutes(answer.radarTime),
  };
}

/**
 * Releases as map features.
 *
 * **Classified by what was burned, not by what we concluded.** The payload is
 * ground truth and it names the layer the operator was betting on: a
 * glaciogenic flare is aimed at supercooled liquid in the seeding band, a
 * hygroscopic one at the cloud base. Colouring these by our own verdict would
 * put our answer on the map twice and leave nothing to disagree with — the
 * verdict rides in the popup instead, next to the readings behind it.
 */
function releaseFeatures(day, rows, from, to) {
  const features = day.releases
    .filter((release) => release.located)
    .filter((release) => {
      const t = new Date(release.at).getTime();
      return (!from || t >= from) && (!to || t <= to);
    })
    .map((release, index) => {
      const answer = rows?.get(release.at);
      return {
        type: "Feature",
        id: index + 1,
        geometry: { type: "Point", coordinates: [release.lon, release.lat] },
        properties: {
          OBJECTID: index + 1,
          at: release.at,
          timeZ: release.timeZ,
          plane: release.plane,
          county: release.county,
          glaciogenic: release.glaciogenic,
          hygroscopic: release.hygroscopic,
          // What was burned, as one value a renderer can switch on.
          payload:
            release.glaciogenic && release.hygroscopic
              ? "both"
              : release.hygroscopic
                ? "hygroscopic"
                : "glaciogenic",
          verdict: answer?.verdict ?? null,
          slwGM2: answer?.slwGM2 ?? null,
          cloudBaseFt: answer?.cloudBaseFt ?? null,
          cloudTopC: answer?.cloudTopC ?? null,
          topPhase: answer?.topPhase ?? null,
          dbz: answer?.dbz ?? null,
          gaps: gaps(release.at, answer),
        },
      };
    });

  return { type: "FeatureCollection", features };
}

const routes = {
  /** Every seeded day, with enough to pick one from a list. */
  async days() {
    const season = await scores();

    return seeded.map((day) => {
      const scored = season?.days.find((entry) => entry.date === day.date);
      const errored = scored?.rows.some((row) => row.answer.error) ?? false;

      return {
        date: day.date,
        releases: day.releases.length,
        located: day.releases.filter((release) => release.located).length,
        observations: day.observations?.length ?? 0,
        // A day is scored, unscored, or void. Void is a sweep that lost the
        // server partway, and it must not read as a day with nothing on it.
        state: !scored ? "unscored" : errored ? "void" : "scored",
        verdicts: errored ? null : (scored?.verdicts ?? null),
        peakSlwGM2: errored ? null : (scored?.peakSlwGM2 ?? null),
      };
    });
  },

  /** One day: the flights, what the crews said, and what we scored. */
  async day(date) {
    const day = seeded.find((entry) => entry.date === date);
    if (!day) return null;

    const rows = await rowsFor(date);

    return {
      date,
      dayTotal: day.dayTotal ?? null,
      claimed: day.claimed ?? null,
      soundings: day.soundings ?? null,
      observations: day.observations ?? [],
      unlocated: day.releases.filter((release) => !release.located),
      releases: day.releases
        .filter((release) => release.located)
        .map((release) => {
          const answer = rows?.get(release.at) ?? null;
          return { ...release, answer, gaps: gaps(release.at, answer) };
        }),
    };
  },
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const send = (status, body, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Access-Control-Allow-Origin": "*",
    });
    res.end(typeof body === "string" ? body : JSON.stringify(body));
  };

  try {
    const path = url.pathname;

    if (path === "/healthcheck") return send(200, { ok: true });
    if (path === "/days") return send(200, await routes.days());
    if (path === "/counties.geojson") return send(200, counties);

    // The flare markers, optionally windowed — the timeline asks for a slice
    // of the day rather than reloading the whole flight.
    const geo = path.match(/^\/day\/(\d{4}-\d{2}-\d{2})\/releases\.geojson$/);
    if (geo) {
      const day = seeded.find((entry) => entry.date === geo[1]);
      if (!day) return send(404, { error: `no report for ${geo[1]}` });
      const from = url.searchParams.get("from");
      const to = url.searchParams.get("to");
      return send(
        200,
        releaseFeatures(
          day,
          await rowsFor(geo[1]),
          from && new Date(from).getTime(),
          to && new Date(to).getTime()
        )
      );
    }

    const one = path.match(/^\/day\/(\d{4}-\d{2}-\d{2})$/);
    if (one) {
      const day = await routes.day(one[1]);
      return day
        ? send(200, day)
        : send(404, { error: `no report for ${one[1]}` });
    }

    send(404, { error: `no route for ${path}` });
  } catch (error) {
    send(500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `eval data on http://localhost:${PORT} — ` +
      `${seeded.length} seeded days, ` +
      `${seeded.reduce((n, d) => n + d.releases.length, 0)} releases`
  );
});
