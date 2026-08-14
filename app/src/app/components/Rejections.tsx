// Types
import type { CandidateStats } from "@/lib/types";

const km2 = new Intl.NumberFormat("en-US");

type PropsT = { stats: CandidateStats };

/**
 * What the join removed, and why.
 *
 * The counts partition: each cell holding in-band liquid is charged to exactly
 * the first test it failed, so these sum to the liquid the join started from
 * minus the candidate ground it kept. That is the point — an empty candidate
 * layer over an amber liquid layer is a bug report unless this block can name
 * the test that emptied it.
 *
 * Ordered as the join evaluates them, which is also how the map is layered:
 * can an aircraft get into this cloud, does the cloud reach the band, is it
 * already raining.
 */
export const Rejections = ({ stats }: PropsT) => {
  if (stats.liquidKm2 === 0) {
    return (
      <div className="text-xs opacity-60">
        The model has no supercooled liquid in the band anywhere, so there was
        nothing for the other tests to rule out.
      </div>
    );
  }

  const rows: [string, number][] = [
    ["no modelled cloud base", stats.rejected.noCloudBase],
    ["cloud colder than the band throughout", stats.rejected.baseAboveBand],
    ["satellite sees no cloud", stats.rejected.noCloudSeen],
    ["cloud top too warm — band above it", stats.rejected.topTooWarm],
    ["already raining", stats.rejected.raining],
  ];

  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs opacity-70">
        Of {km2.format(stats.liquidKm2)} km² holding in-band liquid,{" "}
        {km2.format(stats.candidateKm2)} km² passed. Removed by:
      </div>
      {rows
        .filter(([, value]) => value > 0)
        .map(([label, value]) => (
          <div key={label} className="flex justify-between gap-2 text-xs">
            <span className="opacity-60">{label}</span>
            <span className="opacity-80">{km2.format(value)} km²</span>
          </div>
        ))}
    </div>
  );
};
