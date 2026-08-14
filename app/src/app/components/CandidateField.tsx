// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { BAND_LABEL, CANDIDATE_BANDS } from "@/lib/arcgis/renderers";

// Components
import { Rejections } from "./Rejections";

const km2 = new Intl.NumberFormat("en-US");
const ft = new Intl.NumberFormat("en-US");

/**
 * What the candidate field reports.
 *
 * The first block is the answer — how much ground passed every test, and how
 * rich the best of it is. The second is the accounting, which matters most when
 * the answer is nothing: a blank green layer over an amber one reads as a
 * broken build unless the panel can say which test emptied it.
 *
 * The attributes underneath are reported, never gates. A band above the
 * configured ceiling in July is correct output, not a warning.
 */
export const CandidateField = () => {
  const stats = useAppSelector((state) => state.seedability.stats);
  const visible = useAppSelector((state) => state.seedability.visible);
  const loading = useAppSelector((state) => state.seedability.loading);
  const error = useAppSelector((state) => state.seedability.error);

  if (!visible) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Joining the model, the satellite and the radar…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!stats) return null;

  if (stats.coveragePct === 0) {
    return (
      <div className="flex flex-col gap-2 p-4">
        <h3 className="font-semibold">Candidate field</h3>
        <div className="alert alert-warning alert-soft p-2 text-xs">
          <span>
            Nothing in the domain passes every test at this hour. Not a failed
            build — the sky is not offering a target.
          </span>
        </div>
        <Rejections stats={stats} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <h3 className="font-semibold">Candidate field</h3>

      <div className="stats stats-vertical bg-base-200">
        <div className="stat py-2">
          <div className="stat-title">Candidate ground</div>
          <div className="stat-value text-lg">
            {km2.format(stats.candidateKm2)} km²
          </div>
          <div className="stat-desc">
            {stats.coveragePct}% of the domain &middot; every test passed
          </div>
        </div>
        <div className="stat py-2">
          <div className="stat-title">Richest candidate</div>
          <div className="stat-value text-lg">
            {km2.format(stats.peak)} g/m²
          </div>
          <div className="stat-desc">
            in the {BAND_LABEL} band
            {stats.peak >= CANDIDATE_BANDS[CANDIDATE_BANDS.length - 1].value
              ? " · a prime target"
              : ""}
          </div>
        </div>
        {stats.medianBandBaseFt !== null && (
          <div className="stat py-2">
            <div className="stat-title">Band base over that ground</div>
            <div className="stat-value text-lg">
              {ft.format(stats.medianBandBaseFt)} ft
            </div>
            <div className="stat-desc">
              {stats.reachablePct}% below a {ft.format(stats.ceilingFt)} ft
              ceiling
            </div>
          </div>
        )}
      </div>

      <Rejections stats={stats} />

      <div className="text-xs opacity-80">
        {stats.medianBaseFt !== null && (
          <>
            Median cloud base {ft.format(stats.medianBaseFt)} ft MSL,{" "}
            {stats.windowPct}% inside the operational window.{" "}
          </>
        )}
        Peak mixed-layer CAPE {km2.format(stats.peakMixedCapeJKg)} J/kg, peak
        integrated liquid {stats.peakVilKgM2} kg/m².
        {stats.stormMotionKt > 0 && (
          <>
            {" "}
            Richest cell moving {stats.stormMotionKt} kt toward{" "}
            {stats.stormMotionTowardDeg}°.
          </>
        )}
      </div>

      {stats.blindKm2 > 0 && (
        <div className="text-xs opacity-50">
          {km2.format(stats.blindKm2)} km² of this has no radar over it — it was
          not cleared of rain, it was simply not checked.
        </div>
      )}

      <div className="text-xs opacity-60">
        Only as current as its slowest source: HRRR {utc(stats.run)}Z, satellite{" "}
        {utc(stats.sceneTime)}Z, radar {utc(stats.radarTime)}Z.
      </div>
    </div>
  );
};

const utc = (iso: string) =>
  new Date(iso).toISOString().slice(0, 16).replace("T", " ");
