// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Components
import { Status } from "../Status";
import { BandColumns } from "./BandColumns";
import { BandOverlap } from "./BandOverlap";

const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

/**
 * Finding 1 — the model against the balloons the crews brief on.
 *
 * The comparison the operator could make themselves: their own morning sounding
 * table against the heights we draw for the same place and hour. The seeding
 * band is the headline of it; the CCL row underneath is the one that decides
 * where the cloud-base layer gets its height when HRRR has no cloud.
 *
 * **Every measured number here is already on disk.** The reports print the
 * ascent's own table and `releases.mjs` parsed it; `balloons.mjs` fetches only
 * the model column to set beside it.
 */
export const Radiosonde = () => {
  const { band, loading, error } = useAppSelector((state) => state.findings);
  const ccl = band?.readings.find((reading) => reading.key === "ccl");

  if (loading || error) {
    return (
      <Status
        loading={loading}
        missing={null}
        error={error}
        what="Reading the sounding comparison"
      />
    );
  }

  if (!band) {
    return (
      <Status
        loading={false}
        missing="No sounding comparison yet — node eval/balloons.mjs"
        error={null}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto p-8 flex flex-col gap-6">
        <div className="prose max-w-none">
          <h1 className="mb-1">The column is where the balloons put it</h1>
          <p>
            The National Weather Service flies a thermometer from Midland and
            Del Rio twice a day, straight through the layer that decides a
            flight. The 12Z ascent lands on a model analysis hour, so neither
            side has to be rounded to meet the other.
          </p>
        </div>

        {band.overlap && (
          <div className="stats stats-vertical sm:stats-horizontal bg-base-200">
            <div className="stat">
              <div className="stat-title">Overlap with the measured layer</div>
              <div className="stat-value text-success">
                {pct(band.overlap.mean)}
              </div>
              <div className="stat-desc">
                mean of {band.overlap.n} · worst {pct(band.overlap.worst)}
              </div>
            </div>
            <div className="stat">
              <div className="stat-title">Layer depth</div>
              <div className="stat-value">{band.overlap.medianDepth} m</div>
              <div className="stat-desc">median, floor to ceiling</div>
            </div>
            <div className="stat">
              <div className="stat-title">Clearing 90% / 80%</div>
              <div className="stat-value">
                {band.overlap.over90}/{band.overlap.over80}
              </div>
              <div className="stat-desc">of {band.overlap.n} ascents</div>
            </div>
          </div>
        )}

        {ccl && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs tracking-widest">
              CCL — THE CLOUD-BASE FALLBACK
            </h2>
            <div className="stats stats-vertical sm:stats-horizontal bg-base-200">
              <div className="stat">
                <div className="stat-title">Typical miss</div>
                <div className="stat-value">
                  {ccl.typical} {ccl.unit}
                </div>
                <div className="stat-desc">against {ccl.n} ascents</div>
              </div>
              <div className="stat">
                <div className="stat-title">Average offset</div>
                <div className="stat-value">
                  {Math.abs(ccl.bias)} {ccl.unit}{" "}
                  {ccl.bias > 0 ? "high" : "low"}
                </div>
                <div className="stat-desc">
                  {ccl.bias > 0
                    ? "our height sits above the balloon's"
                    : "our height sits below the balloon's"}
                </div>
              </div>
              <div className="stat">
                <div className="stat-title">Worst</div>
                <div className="stat-value">
                  {ccl.worst} {ccl.unit}
                </div>
                <div className="stat-desc">
                  spread {ccl.low} to {ccl.high} {ccl.unit}
                </div>
              </div>
            </div>
            <p className="text-sm max-w-2xl">
              The one row where both sides are the same quantity: the report
              prints the ascent&rsquo;s own convective condensation level, and
              we compute ours from the model&rsquo;s surface moisture against
              its temperature profile. It matters because the cloud-base layer
              falls back to this height wherever the model diagnoses no cloud,
              which is about half the domain. The cloud-base row in the table
              below is not this check &mdash; it sets a 12Z deck against an
              afternoon parcel height, and the two are not the same claim.
            </p>
          </div>
        )}

        <div className="card bg-base-200">
          <div className="card-body">
            <div className="flex flex-wrap gap-4 text-xs items-center pb-1">
              <span className="flex items-center gap-2">
                <span className="inline-block w-5 h-3 border border-warning bg-warning/15" />
                Balloon — freezing level to −15 °C
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block w-5 h-3 bg-info" />
                What we drew, same place and hour
              </span>
            </div>
            <BandColumns ascents={band.ascents} />
          </div>
        </div>

        {band.ascents.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-xs tracking-widest">EVERY ASCENT</h2>
            <p className="text-sm max-w-2xl">
              Overlap is the share of the combined layer both sides agree on.
              100% is the same band. The columns above are this table drawn.
            </p>
            <BandOverlap band={band} />
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="table table-sm">
            <thead>
              <tr>
                <th>Reading</th>
                <th className="text-right">Ascents</th>
                <th className="text-right">Average offset</th>
                <th className="text-right">Typical miss</th>
                <th className="text-right">Worst</th>
              </tr>
            </thead>
            <tbody>
              {band.readings.map((reading) => (
                <tr key={reading.key}>
                  <td>{reading.label}</td>
                  <td className="text-right font-mono">{reading.n}</td>
                  <td className="text-right font-mono">
                    {Math.abs(reading.bias)} {reading.unit}{" "}
                    {reading.bias > 0 ? "high" : "low"}
                  </td>
                  <td className="text-right font-mono font-semibold">
                    {reading.typical} {reading.unit}
                  </td>
                  <td className="text-right font-mono">
                    {reading.worst} {reading.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="prose max-w-none text-sm">
          <p>
            {band.attempted} pairs attempted, {band.failed} lost to timeouts.
            The average offset is how far our height sits from the
            balloon&rsquo;s, and the typical miss is how far off a single ascent
            usually is regardless of direction. An average offset near zero on
            both edges means the misses are scatter rather than a standing
            offset, so there is nothing to correct for.
          </p>
          <p>
            The balloon is close in time but not simultaneous — it is released
            about 45 minutes before its nominal hour and reaches the layer
            minutes into the flight, so the gap is 20–30 minutes. That is
            survivable here because a temperature profile at 4–7 km moves tens
            of meters in an hour.
          </p>
        </div>
      </div>
    </div>
  );
};
