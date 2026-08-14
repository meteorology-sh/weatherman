// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { Rejections } from "@/app/components/panel/Rejections";

const km2 = new Intl.NumberFormat("en-US");
const ft = new Intl.NumberFormat("en-US");

/**
 * The candidate field at the replayed hour.
 *
 * Reads the replay slice rather than the live one — the two must never share a
 * summary, for the same reason the layers are separate instances. Its numbers
 * come from the same build the replayed layer draws, so the panel and the map
 * cannot disagree about the hour.
 *
 * This is the readout the replay panel was kept clear for: it is the only one
 * that says something about the hour as a whole rather than about one of four
 * unjoined sources.
 */
export const ReplayField = () => {
  const stats = useAppSelector((state) => state.replay.stats);
  if (!stats) return null;

  const field = stats.field;

  if (field.coveragePct === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold text-sm">SEEDING OPPORTUNITY</h3>
        <div className="text-sm">
          No ground in the domain passed every test at this hour.
        </div>
        <Rejections stats={field} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold text-sm">SEEDING OPPORTUNITY</h3>
      <div className="text-sm">
        <strong>{km2.format(field.candidateKm2)} km²</strong> passed every test
        — {field.coveragePct}% of the domain, richest cell{" "}
        {km2.format(field.peak)} g/m².
      </div>
      {field.medianBandBaseFt !== null && (
        <div className="text-sm">
          Band base {ft.format(field.medianBandBaseFt)} ft MSL &middot;{" "}
          {field.reachablePct}% below an {ft.format(field.ceilingFt)} ft ceiling
        </div>
      )}
      <Rejections stats={field} />
    </div>
  );
};
