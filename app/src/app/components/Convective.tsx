// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { BAND_WARMEST_C } from "@/lib/arcgis/renderers";

const num = new Intl.NumberFormat("en-US");

const feet = (value: number | null) =>
  value === null ? "—" : `${num.format(value)} ft`;

/** The eight compass points, which is as fine as a 12 km cell deserves. */
const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
const compass = (deg: number) => POINTS[Math.round(deg / 45) % 8];

/**
 * The HRRR 2D diagnostics over the clicked point — **attributes, not gates.**
 *
 * These are the variables the map has never carried: how much convective
 * energy is available, where a storm would carry a seeded plume, and whether
 * the cell is already electrified. Nothing here filters the map, and that is
 * deliberate — a cutoff on any of them needs a citation rather than a coverage
 * table, so the numbers are shown and the operator judges.
 *
 * Cloud base and cloud top are the exception in kind. They are the two ends of
 * a real question, and the verdict line answers it: does the seeding band's
 * base actually lie inside the cloud over this point.
 */
export const Convective = () => {
  const data = useAppSelector((state) => state.sounding.data);
  const loading = useAppSelector((state) => state.sounding.loading);
  const error = useAppSelector((state) => state.sounding.error);

  if (loading || error || !data) return null;

  const d = data.diagnostics;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold">Cloud and convection here</div>

      <div className="stats stats-vertical bg-base-200">
        <div className="stat py-2">
          <div className="stat-title">Cloud base</div>
          <div className="stat-value text-lg">{feet(d.cloudBaseFt)}</div>
          <div className="stat-desc">
            {d.cloudBaseFt === null
              ? "The model has no cloud over this cell"
              : `MSL · ${feet(d.cloudBaseAglFt)} above the ground`}
          </div>
        </div>
        <div className="stat py-2">
          <div className="stat-title">Depth to cloud top</div>
          <div className="stat-value text-lg">{feet(d.depthFt)}</div>
          <div className="stat-desc">
            {d.cloudTopFt === null
              ? "HRRR diagnoses no cloud top here — it reports one deck, and often none"
              : `Top at ${feet(d.cloudTopFt)} MSL`}
          </div>
        </div>
      </div>

      {/* The one line here that is a criterion rather than a reading. It is
          three-valued on purpose: HRRR reports a cloud top over far less ground
          than it reports a base, so "we cannot tell" is the common answer and
          must not read as "no". */}
      {d.bandInCloud === null ? (
        <div className="text-xs opacity-60">
          Not enough here to say whether the seeding band is inside this cloud.
          That needs a cloud base, a cloud top and a band base, and one of the
          three is missing.
        </div>
      ) : d.bandInCloud ? (
        <div className="alert alert-success alert-soft p-2 text-xs">
          <span>
            The {BAND_WARMEST_C} °C level lies between this cloud's base and its
            top, so the seeding band is inside the cloud — there is cloud around
            the altitude worth seeding, rather than clear air.
          </span>
        </div>
      ) : (
        <div className="alert alert-warning alert-soft p-2 text-xs">
          <span>
            The {BAND_WARMEST_C} °C level is outside this cloud, so the seeding
            band and the cloud do not overlap over this point.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="opacity-60">CAPE, surface</span>
        <span>{num.format(d.capeJKg)} J/kg</span>
        <span className="opacity-60">CAPE, mixed layer</span>
        <span>{num.format(d.mixedCapeJKg)} J/kg</span>
        <span className="opacity-60">Storm motion</span>
        <span>
          {d.stormMotionTowardDeg === null
            ? `${d.stormMotionKt} kt`
            : `${d.stormMotionKt} kt toward ${compass(
                d.stormMotionTowardDeg
              )} (${d.stormMotionTowardDeg}°)`}
        </span>
        <span className="opacity-60">Integrated liquid</span>
        <span>{d.vilKgM2} kg/m²</span>
        <span className="opacity-60">Echo top</span>
        <span>{feet(d.echoTopFt)}</span>
        <span className="opacity-60">Lightning</span>
        <span>
          {d.lightning === null ? "not at the analysis hour" : d.lightning}
        </span>
      </div>

      <div className="text-xs opacity-50">
        All modelled, and none of it filters the map. CAPE says how much energy
        a growing turret has to work with, and storm motion says where the
        seeded cloud would carry the plume. Integrated liquid is a second
        opinion on the amber contours, worked out from a different field than
        they are. HRRR publishes no unit for its lightning field, so it is shown
        as the bare number.
      </div>
    </div>
  );
};
