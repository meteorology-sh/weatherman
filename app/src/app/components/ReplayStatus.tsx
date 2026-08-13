// Store
import { useAppSelector } from "@/lib/store/hooks";

/** `2025-05-15T18:01:17.900Z` → `15 May 2025, 18:01Z`. */
const stamp = (iso: string) => {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${date}, ${hh}:${mm}Z`;
};

/**
 * Whether the chosen hour is loading, and once it has, which scenes actually
 * answered.
 *
 * The times are the point of this block, not decoration. `at` names an hour;
 * what the map draws is the HRRR cycle initialised then plus the satellite and
 * radar scans *nearest* it, and those land a few minutes either side. An
 * operator comparing a replay against a seeding log needs to see the scan times
 * rather than infer them from the date they typed.
 */
export const ReplayStatus = () => {
  const loading = useAppSelector((state) => state.replay.loading);
  const error = useAppSelector((state) => state.replay.error);
  const stats = useAppSelector((state) => state.replay.stats);

  if (loading) {
    return (
      <div className="flex items-start gap-3 text-sm">
        <span className="loading loading-spinner loading-sm shrink-0" />
        <span className="opacity-70">
          Building all three sources for this hour. A cold hour takes about a
          minute — the map stays clear until every layer is ready, so it never
          shows two dates at once.
        </span>
      </div>
    );
  }

  if (error) return <div className="text-error text-sm p-1">{error}</div>;
  if (!stats) return null;

  return (
    <div className="text-xs opacity-60 flex flex-col gap-1">
      <div className="flex justify-between gap-2">
        <span>Cloud tops &middot; GOES scan</span>
        <span>{stamp(stats.cloudTop.validTime)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Liquid water &middot; HRRR run</span>
        <span>{stamp(stats.liquid.run)}</span>
      </div>
      <div className="flex justify-between gap-2">
        <span>Radar &middot; MRMS scan</span>
        <span>{stamp(stats.radar.validTime)}</span>
      </div>
    </div>
  );
};
