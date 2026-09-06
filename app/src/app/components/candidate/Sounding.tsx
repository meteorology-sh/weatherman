// Store
import { useAppSelector } from "@/lib/store/hooks";

// Format
import { heightAtC } from "@/lib/format";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

const ft = new Intl.NumberFormat("en-US");

const altitude = (value: number | null) =>
  value === null ? "—" : `${ft.format(value)} ft`;

/**
 * Heights on this column: freezing, −15 °C, seeding-band edges, ground.
 */
export const Sounding = () => {
  const data = useAppSelector((state) => state.sounding.data);
  const loading = useAppSelector((state) => state.sounding.loading);
  const error = useAppSelector((state) => state.sounding.error);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (!data) return null;

  const minus15 = heightAtC(data.levels, -15);
  const band =
    data.bandBaseFt !== null && data.bandTopFt !== null
      ? `${ft.format(data.bandBaseFt)}–${ft.format(data.bandTopFt)} ft`
      : "—";

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Column</h3>
      <MeasurementGrid
        rows={[
          { label: "Ground", value: altitude(data.surfaceFt) },
          { label: "Freezing level", value: altitude(data.freezingFt) },
          { label: "−15 °C", value: altitude(minus15) },
          { label: "Seeding band", value: band },
        ]}
      />
    </div>
  );
};
