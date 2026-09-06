// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { RadarLegend } from "@/lib/arcgis/legends";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });
const km = (value: number) => `${num.format(value)} km`;
const feet = (value: number) =>
  `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)} ft`;

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const compass = (deg: number) => POINTS[Math.round(deg / 45) % 8];

function versusFreezing(top: number, freeze: number | null): string {
  if (freeze === null) return `${feet(top)} MSL`;
  if (top >= freeze) return `${feet(top - freeze)} above freezing`;
  return `${feet(freeze - top)} below freezing`;
}

function signedC(value: number): string {
  const n = num.format(value);
  return value > 0 ? `+${n} °C` : `${n} °C`;
}

/**
 * The nearest radar storm to the click, and the readings taken over it.
 *
 * Where on the storm the click landed is one distance: to the nearest edge
 * of the outline the radar layer draws, and which side of that edge it is
 * on. Texas seeds the flank, so a short distance inside the rain is the
 * reading being looked for. It is measured against the drawn ring itself,
 * so it cannot disagree with the outline on the screen.
 */
export const StormHere = () => {
  const here = useAppSelector((state) => state.storms.here);
  const loading = useAppSelector((state) => state.storms.hereLoading);
  const error = useAppSelector((state) => state.storms.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (here === undefined) return null;

  if (here === null) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">{RadarLegend.name}</h3>
        <MeasurementGrid
          rows={[{ label: "Storm", value: "none within 40 km" }]}
        />
      </div>
    );
  }

  const storm = here.object;

  const motion =
    storm.motionTowardDeg === null || storm.motionKmh === null
      ? "—"
      : `${compass(storm.motionTowardDeg)} ${num.format(storm.motionKmh)} km/h`;

  const echo =
    here.echoTopFt !== null
      ? versusFreezing(here.echoTopFt, here.freezingFt)
      : here.modelEchoTopFt === null
        ? "—"
        : versusFreezing(here.modelEchoTopFt, here.freezingFt);

  const edge =
    here.edgeKm === null
      ? "—"
      : `${km(here.edgeKm)} ${here.inside ? "inside" : "outside"}`;

  const goes =
    here.goesTopC === null
      ? "—"
      : here.goesTopDeltaC === null
        ? `${num.format(here.goesTopC)} °C`
        : `${num.format(here.goesTopC)} °C · ${signedC(here.goesTopDeltaC)}`;

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">Radar</h3>
      <MeasurementGrid
        rows={[
          { label: "Distance to edge", value: edge },
          { label: "Motion", value: motion },
          { label: "18 dBZ echo top", value: echo },
          { label: "Cloud top", value: goes },
          {
            label: "Lightning",
            value: here.glmFlashes === null ? "—" : `${here.glmFlashes}`,
          },
        ]}
      />
    </div>
  );
};
