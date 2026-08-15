// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { BAND_LABEL, BAND_WARMEST_C, BAND_COLDEST_C } from "@/lib/arcgis/bands";

const ft = new Intl.NumberFormat("en-US");

/** An altitude, or a plain statement that the column never gets there. */
const altitude = (value: number | null) =>
  value === null ? "—" : `${ft.format(value)} ft`;

/**
 * The profile over one point: the altitudes a drone is actually given.
 *
 * The contours answer *where*; this answers *how high*, which is the number in
 * the flight plan. It reads the same HRRR run the amber contours are drawn
 * from, so the two cannot disagree about where the band is — a sounding from a
 * second model would leave an operator with two answers and no way to choose.
 */
export const Sounding = () => {
  const data = useAppSelector((state) => state.sounding.data);
  const loading = useAppSelector((state) => state.sounding.loading);
  const error = useAppSelector((state) => state.sounding.error);
  const point = useAppSelector((state) => state.sounding.point);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
        Reading the column over {point[1]}, {point[0]}…
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
  if (!data) return null;

  // The band's warm edge can sit below the bottom of the column: an airmass
  // already colder than −5 °C at the surface is *in band* from the ground up,
  // and there is no crossing to find. Reporting that as "no band" would hide the
  // case with the most seedable air in it.
  const fromGround =
    data.bandBaseFt === null &&
    data.baseC <= BAND_WARMEST_C &&
    data.baseC >= BAND_COLDEST_C;
  const bandBaseFt =
    data.bandBaseFt ?? (fromGround ? data.levels[0].heightFt : null);

  const band =
    bandBaseFt !== null && data.bandTopFt !== null
      ? `${ft.format(bandBaseFt)}–${ft.format(data.bandTopFt)} ft`
      : null;

  // HRRR extrapolates its pressure levels below ground, so an isotherm can come
  // back as a real number that is inside a mountain. Say so rather than send a
  // drone to it.
  const underground = bandBaseFt !== null && bandBaseFt < data.surfaceFt;

  return (
    <div className="flex flex-col gap-3">
      <div className="text-sm font-semibold">Seeding band altitude</div>

      {band === null ? (
        <div className="alert alert-warning alert-soft p-2 text-xs">
          {/* Two opposite reasons an isotherm can be missing, and they must not
              read the same. Colder than the band at the column's base means the
              air really is too cold to seed. Warmer than the band at its top
              means the band is above what we read — a limit of ours, not of the
              sky, and saying "nothing here" for that would discard real data. */}
          <span>
            {data.baseC < BAND_COLDEST_C ? (
              <>
                This column is already {data.baseC} °C at its base — colder than
                the band all the way down. Ice, not supercooled water: nothing
                for AgI to work on.
              </>
            ) : (
              <>
                This column only reaches {data.topC} °C at the top of what the
                model column covers, so the {BAND_LABEL} band sits above it. Not
                a reading of no band — a limit of the levels read.
              </>
            )}
          </span>
        </div>
      ) : (
        <div className="stats stats-vertical bg-base-200">
          <div className="stat py-2">
            <div className="stat-title">Fly between</div>
            <div className="stat-value text-lg">{band}</div>
            <div className="stat-desc">
              {fromGround
                ? `In band from the bottom of the column up, to ${BAND_COLDEST_C} °C`
                : `${BAND_WARMEST_C} °C up to ${BAND_COLDEST_C} °C, MSL`}
            </div>
          </div>
          <div className="stat py-2">
            <div className="stat-title">Freezing level</div>
            <div className="stat-value text-lg">
              {altitude(data.freezingFt)}
            </div>
            <div className="stat-desc">
              Ground is at {ft.format(data.surfaceFt)} ft
            </div>
          </div>
        </div>
      )}

      {underground && (
        <div className="alert alert-warning alert-soft p-2 text-xs">
          <span>
            The band starts below ground here. HRRR extrapolates its pressure
            levels under the terrain, so read this column as the free air above
            the surface only.
          </span>
        </div>
      )}

      <div className="text-xs">
        Sampled at {data.lat}, {data.lon} &middot; the 12 km cell containing
        your click, not the click itself. Click the map to move it.
      </div>
    </div>
  );
};
