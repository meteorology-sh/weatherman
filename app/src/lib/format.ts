/**
 * Readings as an operator reads them.
 *
 * Here rather than beside the components that print them because a module
 * that exports both a component and a helper cannot be hot-reloaded, and
 * because the em dash for "no answer" has to be the same character in every
 * panel that has nothing to say.
 */

// Types
import type { SoundingLevel } from "@/lib/types";

/** An absent reading, written the one way. */
export const dash = (value: string | null | undefined) =>
  value == null || value === "" ? "—" : value;

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
 * One coordinate in degrees and decimal minutes, e.g. `N32°05.40′`.
 *
 * The form a GPS or FMS takes and the one charts and flight plans print.
 * Decimal degrees is a mapping convention; a crew reading a point off this
 * panel is going to type it into a box that wants minutes.
 *
 * Two decimal places on the minute is about 18 m, finer than the 0.001° the
 * click is rounded to, so nothing the operator picked is lost in the display.
 */
const degreesMinutes = (value: number, positive: string, negative: string) => {
  const hemisphere = value < 0 ? negative : positive;
  const degrees = Math.abs(value);
  const whole = Math.floor(degrees);
  const minutes = (degrees - whole) * 60;
  return `${hemisphere}${whole}°${minutes.toFixed(2).padStart(5, "0")}′`;
};

/** A clicked point as a crew would read it out. */
export const latLon = (lon: number, lat: number) =>
  `${degreesMinutes(lat, "N", "S")} ${degreesMinutes(lon, "E", "W")}`;
