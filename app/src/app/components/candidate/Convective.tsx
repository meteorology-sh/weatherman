// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

const num = new Intl.NumberFormat("en-US");

const feet = (value: number | null) =>
  value === null ? "—" : `${num.format(value)} ft`;

/**
 * Modeled convective numbers on this column.
 */
export const Convective = () => {
  const data = useAppSelector((state) => state.sounding.data);
  const loading = useAppSelector((state) => state.sounding.loading);
  const error = useAppSelector((state) => state.sounding.error);

  if (loading || error || !data) return null;

  const d = data.diagnostics;
  const warmDepth =
    data.freezingFt !== null &&
    d.cloudBaseFt !== null &&
    d.cloudBaseFt < data.freezingFt
      ? data.freezingFt - d.cloudBaseFt
      : null;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Environment</h3>
      <MeasurementGrid
        rows={[
          { label: "CAPE, mixed layer", value: `${num.format(d.mixedCapeJKg)} J/kg` },
          { label: "CAPE, surface", value: `${num.format(d.capeJKg)} J/kg` },
          { label: "CIN, mixed layer", value: `${num.format(d.cinJKg)} J/kg` },
          { label: "LCL", value: feet(d.lclFt) },
          { label: "Warm-cloud depth", value: feet(warmDepth) },
          { label: "Modeled echo top", value: feet(d.echoTopFt) },
          { label: "Integrated liquid", value: `${d.vilKgM2} kg/m²` },
        ]}
      />
    </div>
  );
};
