/**
 * How much of the seeding band we drew is the band a radiosonde measured.
 *
 * Overlap over union, so a band drawn far too deep is penalised rather than
 * rewarded for covering everything. A crew does not fly an edge, it flies
 * the layer between them.
 *
 * One ascent is excluded on physical grounds: South Texas 31 March prints a
 * freezing level and a −15 °C height 872 m apart, 17.2 °C/km. The dry
 * adiabatic lapse rate is 9.8 °C/km. One of those two numbers is a typo,
 * and nothing here can say which, so the whole morning is dropped from
 * both edges.
 */

const SUPERADIABATIC_KM = 15 / 9.8;

export function unusableKey(row) {
  const base = row.compared?.freezingLevel;
  const top = row.compared?.minus15Height;
  if (!base || !top) return null;
  if (!(base.reported > 0) || top.reported == null) return null;
  const depthKm = (top.reported - base.reported) / 1000;
  if (depthKm > 0 && depthKm < SUPERADIABATIC_KM) {
    return `${row.date} ${row.site}`;
  }
  return null;
}

/**
 * Shared height over combined height. Null when either edge is missing,
 * below sea level, or the printed pair is physically impossible.
 */
export function bandOverlap(row) {
  const base = row.compared?.freezingLevel;
  const top = row.compared?.minus15Height;
  if (!base || !top || base.error === null || top.error === null) return null;
  if (!(base.reported > 0)) return null;
  if (unusableKey(row)) return null;

  const shared =
    Math.min(top.reported, top.ours) - Math.max(base.reported, base.ours);
  const union =
    Math.max(top.reported, top.ours) - Math.min(base.reported, base.ours);
  if (!(union > 0)) return null;
  return {
    date: row.date,
    site: row.site,
    measured: [base.reported, top.reported],
    ours: [base.ours, top.ours],
    depth: top.reported - base.reported,
    fraction: Math.max(0, shared) / union,
  };
}

function median(sorted) {
  if (!sorted.length) return null;
  return sorted[Math.floor(sorted.length / 2)];
}

function mean(values) {
  if (!values.length) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Bias, typical miss and worst case over signed errors. */
export function spread(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const absolute = sorted.map(Math.abs).sort((a, b) => a - b);
  return {
    n: sorted.length,
    bias: Math.round(mean(sorted) * 10) / 10,
    typical: absolute[Math.floor(absolute.length / 2)],
    worst: absolute[absolute.length - 1],
    low: sorted[0],
    high: sorted[sorted.length - 1],
  };
}

export function summariseOverlaps(overlaps) {
  const fractions = overlaps.map((o) => o.fraction).sort((a, b) => a - b);
  const depths = overlaps.map((o) => o.depth).sort((a, b) => a - b);
  if (!fractions.length) return null;
  return {
    n: fractions.length,
    median: median(fractions),
    mean: mean(fractions),
    worst: fractions[0],
    over90: fractions.filter((v) => v >= 0.9).length,
    over80: fractions.filter((v) => v >= 0.8).length,
    medianDepth: median(depths),
  };
}
