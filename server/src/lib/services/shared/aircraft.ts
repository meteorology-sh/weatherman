/**
 * What the aircraft can do. No source of its own — this is the airframe, not a
 * feed — so it lives here rather than under any one service's directory.
 *
 * Two modules read it and they sit on opposite sides of the dependency graph:
 * the cloud-base bands in `hrrr/diagnostics.ts` and the reachability figure in
 * `candidate/join.ts`, which already imports from that file. Keeping the number
 * here is what stops the second import closing a cycle.
 */

/**
 * The drone's service ceiling, ft MSL.
 *
 * The design figure. Read as MSL because that is what a service ceiling is —
 * an airframe's limit is the same number over Denver as over Galveston, which
 * is what makes it the one height claim on this map that transfers across the
 * whole domain.
 *
 * **A gate on the cloud-base bands, and nothing else.** The layer bands on it
 * because "can the aircraft get into this cloud at all" is the question that
 * layer exists to answer. The join does not filter on it: the seeding band's
 * base swings ~9,000 ft across a Texas year, so a band above this in July is
 * correct output rather than a warning condition. There the number is reported
 * and the operator judges.
 */
export const CEILING_FT = 18000;
