// Store
import { useAppSelector } from "@/lib/store/hooks";

// Types
import type { SoundingLevel } from "@/lib/types";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

const ft = new Intl.NumberFormat("en-US");

const altitude = (value: number | null) =>
  value === null ? "—" : `${ft.format(value)} ft`;

/** Height of a temperature in the column, ft MSL. */
export function heightAtC(
  levels: SoundingLevel[],
  targetC: number
): number | null {
  for (let i = 0; i < levels.length - 1; i++) {
    const a = levels[i];
    const b = levels[i + 1];
    const span = b.tempC - a.tempC;
    if (span === 0) continue;
    if ((a.tempC - targetC) * (b.tempC - targetC) > 0) continue;
    const t = (targetC - a.tempC) / span;
    return Math.round(a.heightFt + t * (b.heightFt - a.heightFt));
  }
  return null;
}

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
