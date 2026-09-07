// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

const km2 = new Intl.NumberFormat("en-US");

/**
 * The Texas fly fill at the replayed hour.
 */
export const ReplayField = () => {
  const stats = useAppSelector((state) => state.replay.stats);
  if (!stats) return null;

  const target = stats.target;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold text-sm">SEEDING OPPORTUNITY</h3>
      <MeasurementGrid
        rows={[
          { label: "Passed", value: `${km2.format(target.targetKm2)} km²` },
          {
            label: "Cloud base missing",
            value: `${km2.format(target.rejected.noCloudBase)} km²`,
          },
          {
            label: "Base outside window",
            value: `${km2.format(target.rejected.baseAboveCeiling)} km²`,
          },
          {
            label: "Freezing level missing",
            value: `${km2.format(target.rejected.noFreezingLevel)} km²`,
          },
          {
            label: "Echo top below freezing",
            value: `${km2.format(target.rejected.topBelowFreezing)} km²`,
          },
          {
            label: "Rain below 20 dBZ",
            value: `${km2.format(target.rejected.noStorm)} km²`,
          },
        ]}
      />
    </div>
  );
};
