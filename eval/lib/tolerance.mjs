/**
 * How far a release can sit from its scored position and still be the same
 * release, read off the record rather than assumed.
 *
 * Two things place a release less exactly than a coordinate suggests. The
 * layer marks cells, not a coastline, so its edge is known to one cell of the
 * grid it was traced from. And the report prints a position to some number of
 * digits, so the release is anywhere that rounds to them: half the last digit
 * of a coordinate, or half a unit of a printed bearing and range.
 *
 * **A release outside a layer but within that tolerance is not inside.** It is
 * a release the geometry cannot rule out, and the season counts it on its own
 * line beside the releases the geometry places inside.
 *
 * What the bound leaves out, because nothing on the record measures it: an
 * inferred radial origin, and a Rolling Plains row whose fraction may be
 * minutes. Each can move a release further than the bound does.
 */

// Local
import { projectRadial } from "./geo.mjs";

const KM_PER_NM = 1.852;
const EARTH_KM = 6371;
const KM_PER_DEGREE_LAT = 110.574;
const KM_PER_DEGREE_LON = 111.32;
const RAD = Math.PI / 180;

/** Digits after the decimal point, as the number was stored. */
export function decimals(value) {
  const text = String(Math.abs(value));
  const dot = text.indexOf(".");
  return dot < 0 ? 0 : text.length - dot - 1;
}

/**
 * Half the last printed digit of a coordinate pair, as a distance.
 *
 * A row prints both coordinates to one precision, and a stored number drops a
 * trailing zero, so the longer of the two is the row's precision.
 */
export function coordinateBoundKm(lat, lon) {
  const half = 0.5 * 10 ** -Math.max(decimals(lat), decimals(lon));
  return Math.hypot(
    half * KM_PER_DEGREE_LAT,
    half * KM_PER_DEGREE_LON * Math.cos(lat * RAD)
  );
}

/** Half a printed unit of bearing and of range, as a distance. */
export function radialBoundKm(bearingDeg, rangeNm) {
  const alongKm = 0.5 * 10 ** -decimals(rangeNm) * KM_PER_NM;
  const acrossKm =
    rangeNm * KM_PER_NM * Math.sin(0.5 * 10 ** -decimals(bearingDeg) * RAD);
  return Math.hypot(alongKm, acrossKm);
}

/**
 * The printed bearing and range behind a release, or null for a coordinate.
 *
 * A record that kept them is read directly. One that kept only the projected
 * position is inverted from the program's origin and its magnetic variation,
 * and counts as radial only when a whole-degree bearing and a whole-mile range
 * project back onto the stored position exactly — a coordinate row does not
 * land on that lattice.
 *
 * `origin` is the region's origin from `data/regions.json`.
 */
export function radialOf(release, origin) {
  if (release.bearingDeg != null && release.rangeNm != null) {
    return { bearingDeg: release.bearingDeg, rangeNm: release.rangeNm };
  }
  if (!origin?.at) return null;

  const [lat0, lon0] = origin.at;
  const phi1 = lat0 * RAD;
  const phi2 = release.lat * RAD;
  const dLambda = (release.lon - lon0) * RAD;
  const angular =
    2 *
    Math.asin(
      Math.sqrt(
        Math.sin((phi2 - phi1) / 2) ** 2 +
          Math.cos(phi1) * Math.cos(phi2) * Math.sin(dLambda / 2) ** 2
      )
    );
  const bearing = Math.atan2(
    Math.sin(dLambda) * Math.cos(phi2),
    Math.cos(phi1) * Math.sin(phi2) -
      Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLambda)
  );

  const magnetic = Math.round(
    bearing / RAD - (origin.magneticVariationDeg ?? 0)
  );
  const printed = {
    bearingDeg: ((magnetic % 360) + 360) % 360,
    rangeNm: Math.round((angular * EARTH_KM) / KM_PER_NM),
  };
  const [lat, lon] = projectRadial(origin, printed.bearingDeg, printed.rangeNm);
  return lat === release.lat && lon === release.lon ? printed : null;
}

/** How far the printed position lets a release move, km. */
export function positionBoundKm(release, origin) {
  const radial = radialOf(release, origin);
  return radial
    ? radialBoundKm(radial.bearingDeg, radial.rangeNm)
    : coordinateBoundKm(release.lat, release.lon);
}
