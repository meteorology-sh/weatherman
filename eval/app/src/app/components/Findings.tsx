// Router
import { Link, useParams } from "react-router";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Components
import { Status } from "./Status";
import { LayerTable } from "./overlap/LayerTable";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

const share = (n: number, d: number) =>
  d === 0 ? "—" : `${((100 * n) / d).toFixed(1)}%`;

/**
 * The two questions and where each one landed, summed over the season.
 *
 * The page states the answer before it states the method, because the answer is
 * what a reader came for and the method is one click away on either card.
 *
 * **Two cards, because there are two questions.** Is the band in the right
 * place, and do the flares fall in the fill we tell an operator to fly? Both
 * are totals over the whole season rather than a day — a single afternoon can
 * flatter or damn either one, and the programme page is where the season is
 * read. The day-by-day picture lives behind "Every release".
 */
export const Findings = () => {
  const { region } = useParams();
  const { band, near, loading, missing, error } = useAppSelector(
    (state) => state.findings
  );
  const open = useAppSelector((state) =>
    state.regions.all?.find((entry) => entry.id === region)
  );

  // Named rather than assumed: the ascents a programme briefs on are its own.
  const sites = open?.sounding.length
    ? `${open.sounding.join(" and ")} ${
        open.sounding.length > 1 ? "ascents" : "ascent"
      }`
    : "ascents";

  // The fly fill is the season's headline: it is the call an operator acts on,
  // and the other layers are the tests behind it.
  const fly = near?.layers.target ?? null;

  if (loading || error) {
    return (
      <Status
        loading={loading}
        missing={null}
        error={error}
        what="Reading the findings"
      />
    );
  }

  // A programme whose reports have not been read yet has no findings to show,
  // and saying so is different from showing two empty cards.
  if (open && !open.evaluable) {
    return (
      <div className="h-full overflow-y-auto">
        <div className="max-w-2xl p-8 flex flex-col gap-4">
          <h1 className="text-2xl font-semibold">{open.name}</h1>
          <p className="text-sm">
            Nothing has been measured against this programme. Its daily reports
            have not been found and parsed into a flight record, so there are no
            flare coordinates to check the map against and no sounding table to
            check the seeding band against.
          </p>
          <p className="text-sm">
            Wiring one up means adding its report source to{" "}
            <code className="font-mono">eval/data/regions.json</code> and
            teaching <code className="font-mono">eval/releases.mjs</code> to
            read its report layout.
          </p>
          <Link to="/" className="btn btn-sm btn-outline self-start">
            Back to the programmes
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 flex flex-col gap-8">
        <div className="prose max-w-none">
          <h1 className="mb-1">Does the map agree with what Texas flies?</h1>
          <p className="text-base-content/90">
            Two questions, in order. Both are answered against{" "}
            {open ? `the ${open.name}'s` : "the programme's"} own daily reports
            for the {open?.season ?? ""} season, summed over every day of it.
          </p>
        </div>

        <Status loading={false} missing={missing} error={null} />

        <Link
          to={`/${region}/band`}
          className="card bg-base-200 hover:bg-base-300 transition-colors"
        >
          <div className="card-body">
            <div
              className={`text-xs tracking-widest ${
                band ? "text-success" : "text-base-content"
              }`}
            >
              QUESTION 1 — {band ? "ANSWERED YES" : "NOT MEASURED HERE YET"}
            </div>
            <h2 className="card-title">
              Is the seeding band in the right place?
            </h2>
            {band?.overlap ? (
              <>
                <div className="stats bg-transparent">
                  <div className="stat px-2">
                    <div className="stat-title text-xs">
                      Overlap with the balloons
                    </div>
                    <div className="stat-value text-success text-3xl">
                      {pct(band.overlap.median)}
                    </div>
                    <div className="stat-desc">
                      median over {band.overlap.n} ascents
                    </div>
                  </div>
                  <div className="stat px-2">
                    <div className="stat-title text-xs">Freezing level</div>
                    <div className="stat-value text-3xl">
                      {band.readings.find((r) => r.key === "freezingLevel")
                        ?.typical ?? "—"}
                      <span className="text-lg"> m</span>
                    </div>
                    <div className="stat-desc">typical miss</div>
                  </div>
                  <div className="stat px-2">
                    <div className="stat-title text-xs">Clearing 90%</div>
                    <div className="stat-value text-3xl">
                      {band.overlap.over90}/{band.overlap.n}
                    </div>
                    <div className="stat-desc">ascents</div>
                  </div>
                </div>
                <p className="text-sm">
                  The band we draw sits where the weather balloons measured it —
                  the same {sites} the operator briefs on every morning.
                </p>
              </>
            ) : (
              <p className="text-sm font-mono">
                Not measured yet — node eval/balloons.mjs
              </p>
            )}
          </div>
        </Link>

        <div className="card bg-base-200">
          <div className="card-body">
            <div
              className={`text-xs tracking-widest ${
                near ? "text-success" : "text-base-content"
              }`}
            >
              QUESTION 2 — {near ? "MEASURED" : "NOT MEASURED HERE YET"}
            </div>
            <h2 className="card-title">
              Do the flares fall inside the fill we tell them to fly?
            </h2>
            {near ? (
              <>
                <div className="stats bg-transparent">
                  <div className="stat px-2">
                    <div className="stat-title text-xs">
                      Inside SEEDING OPPORTUNITY
                    </div>
                    <div
                      className={`stat-value text-3xl ${
                        fly && fly.n > 0 ? "text-success" : ""
                      }`}
                    >
                      {fly && fly.n > 0 ? share(fly.inside, fly.n) : "—"}
                    </div>
                    <div className="stat-desc">
                      {fly && fly.n > 0
                        ? `${fly.inside} of ${fly.n} releases`
                        : "no fly fill painted yet"}
                    </div>
                  </div>
                  <div className="stat px-2">
                    <div className="stat-title text-xs">Releases</div>
                    <div className="stat-value text-3xl">{near.flares}</div>
                    <div className="stat-desc">
                      {near.located} located this season
                    </div>
                  </div>
                  <div className="stat px-2">
                    <div className="stat-title text-xs">Days</div>
                    <div className="stat-value text-3xl">
                      {near.days}/{near.flying}
                    </div>
                    <div className="stat-desc">painted of flying</div>
                  </div>
                </div>
                <p className="text-sm">
                  Each row is this programme's whole season against one layer
                  Weatherman draws — the rain and its echo past freezing, cloud
                  base, and the fill the operator map names SEEDING OPPORTUNITY.
                  Inside is inside the contour after storm-motion drift to that
                  layer's own scan. A release can sit in rain under a reachable
                  cloud base and still miss the fly fill, because that fill
                  wants all three at once.
                </p>
                <LayerTable layers={near.layers} />
                <Link
                  to={`/${region}/flares`}
                  className="btn btn-sm btn-outline self-start"
                >
                  Every release
                </Link>
              </>
            ) : (
              <p className="text-sm font-mono">
                Not measured yet — node eval/paint.mjs &lt;date&gt;
                {region ? ` --region=${region}` : ""}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
