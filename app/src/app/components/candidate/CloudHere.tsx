// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { LiquidLegend } from "@/lib/arcgis/legends";

// Components
import { MeasurementGrid, dash } from "@/app/components/panel/Measurements";

const num = new Intl.NumberFormat("en-US");

/**
 * FLY on this 3 km cell, and the numbers that made the call.
 */
export const CloudHere = () => {
  const here = useAppSelector((state) => state.seedability.here);
  const loading = useAppSelector((state) => state.seedability.hereLoading);
  const error = useAppSelector((state) => state.seedability.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (!here) return null;

  const fly = here.target === "target";
  const echo =
    here.echoTopFt === null
      ? "—"
      : here.freezingFt === null
        ? `${num.format(here.echoTopFt)} ft MSL`
        : here.echoTopFt >= here.freezingFt
          ? `${num.format(here.echoTopFt - here.freezingFt)} ft above freezing`
          : `${num.format(here.freezingFt - here.echoTopFt)} ft below freezing`;

  const rain = !here.radarCovered
    ? "no radar"
    : here.dbz === null
      ? "—"
      : `${here.dbz} dBZ`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">{fly ? "FLY" : "DON'T FLY"}</h3>
      <MeasurementGrid
        rows={[
          {
            label: "Base above ground",
            value: dash(
              here.cloudBaseAglFt === null
                ? null
                : `${num.format(here.cloudBaseAglFt)} ft`
            ),
          },
          { label: "18 dBZ echo top", value: echo },
          { label: "Rain", value: rain },
          {
            label: LiquidLegend.name,
            value: `${num.format(here.slwGM2)} g/m²`,
          },
        ]}
      />
    </div>
  );
};
