const AWC = "https://aviationweather.gov/api/data/pirep";

/**
 * How far back to ask for reports.
 *
 * Icing PIREPs are rare — of 400 reports over CONUS in a 12 h window, ~38 carry
 * an icing field and about half of those are negative. A shorter window would
 * routinely draw an empty map; a longer one would show the operator ice that an
 * aircraft found before the airmass moved.
 */
const AGE_HOURS = 12;

/** CONUS, as `minLat,minLon,maxLat,maxLon` — the order this API wants. */
const BBOX = "25,-125,50,-66";

/**
 * PIREPs are filed continuously and land in the feed within a minute or two of
 * being phoned in, so this is a live feed with no publication cycle to key off.
 * Five minutes keeps the map current without asking AWC 400 KB per operator.
 */
const CACHE_TTL_MS = 5 * 60_000;

/**
 * The seeding band, matching SEEDING in ./forecast — these two must move
 * together or the map's band filter and the contours under it would disagree
 * about what counts. A report's temperature is what makes it evidence *for this
 * product* rather than for aviation safety: ice at −24 °C confirms an aircraft
 * iced up, not that there is anything left to seed.
 */
const WARMEST_C = -5;
const COLDEST_C = -18;

/**
 * Intensity codes ranked. AWC reports these in `icgInt1`, and they are pilot
 * vocabulary rather than a scale: a range like `LGT-MOD` is one report, not two.
 *
 * NEG is kept rather than dropped. A negative report is an aircraft saying it
 * flew through that point and found no ice — the only falsification of the model
 * available anywhere in this system, and worth drawing for exactly that reason.
 */
const SEVERITY: Record<string, number> = {
  NEG: 0,
  TRC: 1,
  LGT: 2,
  MOD: 3,
  SEV: 4,
  HVY: 4,
};

/** Lowest rank that means an aircraft actually found ice. */
const POSITIVE = 1;

/** What the upstream feed gives us. Only the fields we read are declared. */
type AwcPirepProperties = {
  /** Raw coded report, e.g. "DEN UA /OV DEN320055/TM 0320/FL220/...". */
  rawOb?: string;
  obsTime?: string;
  /** Flight level, hundreds of feet. */
  fltlvl?: number;
  /** Outside air temperature at that level, °C. */
  temp?: number;
  /** Icing intensity and type. Named `icg*`, *not* the `icing_*` of the spec. */
  icgInt1?: string;
  icgType1?: string;
  aircraft?: string;
};

type AwcFeature = {
  properties?: AwcPirepProperties;
  geometry?: { type?: string; coordinates?: number[] } | null;
};

/**
 * One icing report, reshaped for the map. `severity` is the field the renderer
 * matches on; everything else is what the popup and the stats read.
 */
export type IcingProperties = {
  /** 0 = negative report, 1 trace … 4 severe. */
  severity: number;
  /** The code as filed, e.g. "LGT-MOD". Ranges are reported, not just classes. */
  intensity: string;
  /** RIME (small droplets), CLEAR (supercooled large drops), MIXED, or null. */
  iceType: string | null;
  /** Altitude of the report, feet. */
  flightLevelFt: number | null;
  /** Outside air temperature at that altitude, °C. */
  tempC: number | null;
  /**
   * 1 when this report sits in the seeding band, else 0. Unknown
   * temperature counts as 0: it is "we cannot say", and the layer's filter must
   * not promote that to "yes".
   */
  inBand: number;
  obsTime: string;
  /**
   * The same instant, preformatted for the popup. ArcGIS popup templates
   * substitute fields into a string and cannot format one, so the readable form
   * is built here rather than shipping an ISO timestamp to an operator.
   */
  obsLabel: string;
  aircraft: string | null;
  /**
   * Altitude, temperature, ice type and airframe as one line, for the same
   * reason. A template cannot skip a field that is absent, and a negative report
   * routinely has neither a type nor a temperature — laying them out here is
   * what stops the popup reading "24000 ft · · ".
   */
  detail: string;
  raw: string;
};

export type IcingFeature = {
  type: "Feature";
  properties: IcingProperties;
  geometry: { type: "Point"; coordinates: [number, number] };
};

export type IcingFrame = {
  type: "FeatureCollection";
  /** When we pulled the feed, ISO 8601. */
  fetchedAt: string;
  /** Hours of reports the window covers. */
  windowHours: number;
  features: IcingFeature[];
};

/**
 * What the sidebar reports. The denominators are the point: this layer's honest
 * claim is "N aircraft reported, M of them met ice", and a panel that showed
 * only the hits would read as a national icing map.
 */
export type IcingStats = {
  fetchedAt: string;
  windowHours: number;
  /** PIREPs received in the window, icing or not. */
  reports: number;
  /** Reports carrying an icing field at all, including negative ones. */
  icing: number;
  /** Reports where an aircraft actually found ice. */
  positive: number;
  /** Positive reports whose temperature is in the seeding band. */
  inBand: number;
  /** Observation time of the most recent positive report, or null. */
  latest: string | null;
};

type Pull = { frame: IcingFrame; stats: IcingStats };

export class PirepService {
  private cache: { pull: Pull; fetchedAt: number } | null = null;

  /** Icing reports over CONUS for the last AGE_HOURS, as GeoJSON. */
  async icing(): Promise<IcingFrame> {
    return (await this.pull()).frame;
  }

  /** The same pull's summary, so asking for either serves both from one fetch. */
  async icingStats(): Promise<IcingStats> {
    return (await this.pull()).stats;
  }

  private async pull(): Promise<Pull> {
    if (this.cache && Date.now() - this.cache.fetchedAt < CACHE_TTL_MS) {
      return this.cache.pull;
    }

    const params = new URLSearchParams({
      format: "geojson",
      age: String(AGE_HOURS),
      bbox: BBOX,
    });

    // Note there is no `types=ice`. The API accepts it and ignores it — it does
    // not filter server-side — so asking for it would only cost us the
    // denominator the stats are built on. We filter here instead.
    const res = await fetch(`${AWC}?${params}`);
    if (!res.ok) {
      throw new Error(`Icing PIREPs unavailable: ${res.status}`);
    }

    const body = (await res.json()) as { features?: AwcFeature[] };
    const reports = body.features ?? [];
    const fetchedAt = new Date().toISOString();

    const features = reports
      .map(toIcingFeature)
      .filter((f): f is IcingFeature => f !== null);

    const pull: Pull = {
      frame: {
        type: "FeatureCollection",
        fetchedAt,
        windowHours: AGE_HOURS,
        features,
      },
      stats: summarize(fetchedAt, reports.length, features),
    };

    this.cache = { pull, fetchedAt: Date.now() };
    return pull;
  }
}

/**
 * Rank a filed intensity, or null when it carries no icing field.
 *
 * Ranges take the worst class they name: `LGT-MOD` is a pilot saying it got as
 * bad as moderate, and for finding liquid water the upper end is the useful
 * number. Only the first three letters are matched, because the feed also emits
 * forms like `NEGclr`.
 */
export function severityOf(code: string | undefined): number | null {
  if (!code) return null;
  let worst: number | null = null;
  for (const part of code.toUpperCase().split("-")) {
    const rank = SEVERITY[part.trim().slice(0, 3)];
    if (rank === undefined) continue;
    worst = worst === null ? rank : Math.max(worst, rank);
  }
  return worst;
}

/** A real number, or null. The feed omits fields rather than nulling them. */
const finite = (value: number | undefined): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// Spelled out rather than taken from toLocaleString: the label is UTC by
// definition here, and a date format an operator reads should not depend on the
// container's locale data.
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** "2026-08-12T03:20:00.000Z" -> "12 Aug 03:20Z". */
function label(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${day} ${MONTHS[d.getUTCMonth()]} ${hh}:${mm}Z`;
}

/** One upstream feature as ours, or null when it is not an icing report. */
function toIcingFeature(feature: AwcFeature): IcingFeature | null {
  const props = feature.properties;
  if (!props) return null;

  const code = props.icgInt1;
  const severity = severityOf(code);
  if (severity === null || !code) return null;

  const coordinates = feature.geometry?.coordinates;
  if (
    feature.geometry?.type !== "Point" ||
    !coordinates ||
    !Number.isFinite(coordinates[0]) ||
    !Number.isFinite(coordinates[1])
  ) {
    // A report with no position cannot be drawn. It is still in the `reports`
    // denominator, which is the honest place for it.
    return null;
  }

  const tempC = finite(props.temp);
  const fltlvl = finite(props.fltlvl);
  const obsTime = props.obsTime ?? "";
  // The feed reports flight level in hundreds of feet; operators read feet.
  const flightLevelFt = fltlvl === null ? null : fltlvl * 100;
  const iceType = props.icgType1 ?? null;
  const aircraft = props.aircraft ?? null;

  return {
    type: "Feature",
    properties: {
      severity,
      intensity: code.toUpperCase(),
      iceType,
      flightLevelFt,
      tempC,
      inBand:
        severity >= POSITIVE &&
        tempC !== null &&
        tempC <= WARMEST_C &&
        tempC >= COLDEST_C
          ? 1
          : 0,
      obsTime,
      obsLabel: label(obsTime),
      aircraft,
      detail: [
        flightLevelFt === null ? null : `${flightLevelFt} ft`,
        tempC === null ? null : `${tempC} °C`,
        iceType,
        aircraft,
      ]
        .filter(Boolean)
        .join(" · "),
      raw: props.rawOb ?? "",
    },
    geometry: {
      type: "Point",
      coordinates: [coordinates[0], coordinates[1]],
    },
  };
}

function summarize(
  fetchedAt: string,
  reports: number,
  features: IcingFeature[]
): IcingStats {
  let positive = 0;
  let inBand = 0;
  let latest: string | null = null;

  for (const { properties } of features) {
    if (properties.severity < POSITIVE) continue;
    positive++;
    if (properties.inBand === 1) inBand++;
    if (properties.obsTime && (!latest || properties.obsTime > latest)) {
      latest = properties.obsTime;
    }
  }

  return {
    fetchedAt,
    windowHours: AGE_HOURS,
    reports,
    icing: features.length,
    positive,
    inBand,
    latest,
  };
}

export const Pireps = new PirepService();
