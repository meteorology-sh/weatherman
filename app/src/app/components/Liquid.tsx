// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { SLW_BANDS, BAND_LABEL } from "@/lib/arcgis/renderers";

const km2 = new Intl.NumberFormat("en-US");

const utc = (iso: string) =>
  new Date(iso).toISOString().slice(0, 16).replace("T", " ");

/**
 * What the supercooled-liquid layer reports.
 *
 * Deliberately not a domain average. The field covers ~2% of the country, so its
 * mean is a number about the 98% with no cloud in the seeding band — it would
 * read as "0.4 g/m², nothing happening" on a day with a prime target over
 * Amarillo. These are the four things that decide a sortie instead: is there
 * any, how much ground, how rich is the best of it, and what altitude is it at.
 */
export const Liquid = () => {
  const stats = useAppSelector((state) => state.candidate.stats);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const loading = useAppSelector((state) => state.candidate.loading);
  const error = useAppSelector((state) => state.candidate.error);

  if (!liquid) return null;

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Integrating HRRR cloud water…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!stats) return null;

  if (stats.coveragePct === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="font-semibold">SUPERCOOLED_LIQUID_WATER</h3>
        <div className="alert alert-warning alert-soft p-2 text-xs">
          <span>
            No supercooled liquid water anywhere in the domain at this hour.
            Nothing to seed.
          </span>
        </div>
        <div className="text-xs">HRRR {utc(stats.run)}Z analysis</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">SUPERCOOLED_LIQUID_WATER</h3>

      <div className="stats stats-vertical bg-base-200">
        <div className="stat py-2">
          <div className="stat-title">Seedable ground</div>
          <div className="stat-value text-lg">
            {km2.format(stats.seedableKm2)} km²
          </div>
          <div className="stat-desc">
            {stats.coveragePct}% of the HRRR domain over {SLW_BANDS[0].value}{" "}
            g/m²
          </div>
        </div>
        <div className="stat py-2">
          <div className="stat-title">Richest cell</div>
          <div className="stat-value text-lg">
            {km2.format(stats.peak)} g/m²
          </div>
          <div className="stat-desc">
            {stats.peak >= SLW_BANDS[SLW_BANDS.length - 1].value
              ? "A prime target exists somewhere in the domain"
              : "Below the prime-target threshold"}
          </div>
        </div>
        {stats.bandTopMb !== null && stats.bandBaseMb !== null && (
          <div className="stat py-2">
            <div className="stat-title">Seeding band altitude</div>
            <div className="stat-value text-lg">
              {stats.bandTopMb}–{stats.bandBaseMb} mb
            </div>
            <div className="stat-desc">
              Where {BAND_LABEL} sits across the domain
            </div>
          </div>
        )}
      </div>

      <div className="text-xs">
        HRRR {utc(stats.run)}Z analysis &middot; valid {utc(stats.validTime)}Z
      </div>
    </div>
  );
};
