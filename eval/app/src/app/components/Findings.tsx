// Router
import { Link } from "react-router";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Components
import { Status } from "./Status";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * The two questions and where each one landed.
 *
 * The page states the answer before it states the method, because the answer is
 * what a reader came for and the method is one click away on either card.
 */
export const Findings = () => {
  const { band, overlap, loading, missing, error } = useAppSelector(
    (state) => state.findings
  );

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

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto p-8 flex flex-col gap-8">
        <div className="prose max-w-none">
          <h1 className="mb-1">Does the map agree with what Texas flies?</h1>
          <p className="text-base-content/90">
            Two questions, in order. Both are answered against the West Texas
            programme's own daily reports for the 2025 season.
          </p>
        </div>

        <Status loading={false} missing={missing} error={null} />

        <Link
          to="/band"
          className="card bg-base-200 hover:bg-base-300 transition-colors"
        >
          <div className="card-body">
            <div className="text-xs tracking-widest opacity-100 text-success">
              QUESTION 1 — ANSWERED YES
            </div>
            <h2 className="card-title">
              Is the seeding band in the right place?
            </h2>
            {band?.overlap ? (
              <>
                <div className="stats bg-transparent">
                  <div className="stat px-0">
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
                  <div className="stat px-0">
                    <div className="stat-title text-xs">Freezing level</div>
                    <div className="stat-value text-3xl">
                      {band.readings.find((r) => r.key === "freezingLevel")
                        ?.typical ?? "—"}
                      <span className="text-lg"> m</span>
                    </div>
                    <div className="stat-desc">typical miss</div>
                  </div>
                  <div className="stat px-0">
                    <div className="stat-title text-xs">Clearing 90%</div>
                    <div className="stat-value text-3xl">
                      {band.overlap.over90}/{band.overlap.n}
                    </div>
                    <div className="stat-desc">ascents</div>
                  </div>
                </div>
                <p className="text-sm">
                  The band we draw sits where the weather balloons from Midland
                  and Del Rio measured it — the same two ascents the operator
                  briefs on every morning.
                </p>
              </>
            ) : (
              <p className="text-sm font-mono">
                Not measured yet — node eval/reconcile.mjs
              </p>
            )}
          </div>
        </Link>

        <Link
          to="/overlap"
          className="card bg-base-200 hover:bg-base-300 transition-colors"
        >
          <div className="card-body">
            <div className="text-xs tracking-widest text-warning">
              QUESTION 2 — ANSWERED ALMOST NEVER
            </div>
            <h2 className="card-title">
              Do the flares fall inside what we paint?
            </h2>
            {overlap ? (
              <>
                <div className="stats bg-transparent">
                  <div className="stat px-0">
                    <div className="stat-title text-xs">
                      Landed in liquid we painted
                    </div>
                    <div className="stat-value text-3xl">
                      {overlap.tallies.liquid?.held ?? 0}
                      <span className="text-lg">/{overlap.usable}</span>
                    </div>
                    <div className="stat-desc">at both hours</div>
                  </div>
                  <div className="stat px-0">
                    <div className="stat-title text-xs">
                      Fully seedable, rain included
                    </div>
                    <div className="stat-value text-3xl text-warning">
                      {overlap.tallies.candidate?.held ?? 0}
                    </div>
                    <div className="stat-desc">out of {overlap.usable}</div>
                  </div>
                  <div className="stat px-0">
                    <div className="stat-title text-xs">
                      Answer depends on the hour
                    </div>
                    <div className="stat-value text-3xl">
                      {overlap.tallies.liquid?.flipped ?? 0}
                    </div>
                    <div className="stat-desc">had liquid at one hour only</div>
                  </div>
                </div>
                <p className="text-sm">
                  Every flare that did land in liquid was then ruled out for
                  rain — {overlap.rain.vetoed} of {overlap.rain.surviving}, at a
                  median {overlap.rain.median} dBZ against a cutoff of 20. The
                  operators seed those clouds deliberately.
                </p>
              </>
            ) : (
              <p className="text-sm font-mono">
                Not measured yet — node eval/bracket.mjs
              </p>
            )}
          </div>
        </Link>
      </div>
    </div>
  );
};
