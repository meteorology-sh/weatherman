// Store
import { useAppSelector } from "@/lib/store/hooks";

// Types
import type { CloudPhase } from "@/lib/types";

// Components
import { MeasurementGrid } from "@/app/components/panel/Measurements";
import { dash, latLon } from "@/lib/format";

const num = new Intl.NumberFormat("en-US");

/**
 * The satellite's phase classes as an operator reads them.
 *
 * "Supercooled" is the one that matters and is spelled out rather than
 * abbreviated: it is liquid water below freezing, which is what seeding works
 * on, and a reader skimming the panel should not have to decode it.
 */
const PHASE_LABELS: Record<CloudPhase, string> = {
  clear: "Clear",
  liquid: "Liquid",
  supercooled: "Supercooled liquid",
  mixed: "Mixed phase",
  ice: "Ice",
  unknown: "Unknown",
};

/**
 * FLY on this 3 km cell, and the numbers that made the call.
 */
export const CloudHere = () => {
  const here = useAppSelector((state) => state.seedability.here);
  const [lon, lat] = useAppSelector((state) => state.sounding.point);
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

  // A cell can be a target with no modeled base. The row says so rather than
  // showing a dash a reader could take for a missing reading.
  const base =
    here.cloudBaseAglFt === null
      ? "not modeled"
      : `${num.format(here.cloudBaseAglFt)} ft`;

  // The height the cloud-base layer drew here, and which of its two model
  // heights answered. Both are model output, so the source is named rather
  // than left for the reader to assume it was HRRR's own diagnosis.
  const baseMsl =
    here.cloudBaseMslFt === null
      ? "—"
      : `${num.format(here.cloudBaseMslFt)} ft MSL${
          here.baseSource === "ccl" ? " (CCL)" : " (model)"
        }`;

  // Printed beside the base rather than only named as its source. A CCL well
  // above a modeled base is a column that would need lifting to condense from
  // the surface, which is a different cloud from one whose base is already
  // there — and where the CCL is what answered, this is that height.
  const ccl = Number.isFinite(here.cclFt)
    ? `${num.format(here.cclFt as number)} ft MSL`
    : "—";

  // Observed, unlike everything else about phase in this app. The satellite
  // classifies the top of whatever deck it can see, which under multi-layer
  // cloud is the highest one and not necessarily the storm underneath.
  const phase = here.topPhase === null ? "—" : PHASE_LABELS[here.topPhase];

  return (
    <div className="flex flex-col gap-3">
      <h3 className="flex items-center justify-between gap-2 font-semibold">
        {fly ? (
          <span className="badge badge-sm badge-outline badge-success">
            FLY
          </span>
        ) : (
          <span className="badge badge-sm badge-outline badge-warning">
            DON'T FLY
          </span>
        )}
        <span className="font-mono text-xs font-normal">
          {latLon(lon, lat)}
        </span>
      </h3>
      <MeasurementGrid
        rows={[
          { label: "Cloud Base", value: baseMsl },
          { label: "Base Above Ground", value: base },
          { label: "CCL", value: ccl },
          { label: "18 dBZ Echo Top", value: echo },
          { label: "Observed Cloud-Top Phase", value: phase },
          { label: "Rain", value: rain },
          {
            label: "Supercooled Liquid Water",
            value: `${num.format(here.slwGM2)} g/m²`,
          },
        ]}
      />
    </div>
  );
};
