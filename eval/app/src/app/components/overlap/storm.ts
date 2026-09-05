// ArcGIS
import { SLW_BANDS } from "@/lib/arcgis/bands";

// Types
import type { Flare, StormAtFlare } from "~/lib/types";

// Components
import { type Tone } from "./distance";

export const MATCH: Tone = {
  fill: "fill-success",
  stroke: "stroke-success",
  text: "text-success",
  label: "Yes",
};
export const MISS: Tone = {
  fill: "fill-error",
  stroke: "stroke-error",
  text: "text-error",
  label: "No",
};
export const NEUTRAL: Tone = {
  fill: "fill-base-content",
  stroke: "stroke-base-content",
  text: "text-base-content",
  label: "No reading",
};

const num = new Intl.NumberFormat("en-US", { maximumFractionDigits: 1 });

export type Verdict = { ok: boolean | null; label: string };

export function toneOf(ok: boolean | null): Tone {
  if (ok === null) return NEUTRAL;
  return ok ? MATCH : MISS;
}

function unscored(): Verdict {
  return { ok: null, label: "—" };
}

function noStorm(): Verdict {
  return { ok: false, label: "no storm" };
}

/** Same test as the server: within 90° of the opposite of the heading. */
export function upwindOf(
  coreLat: number,
  coreLon: number,
  lat: number,
  lon: number,
  towardDeg: number
): boolean {
  const upwind = (towardDeg + 180) % 360;
  const mid = ((coreLat + lat) / 2) * (Math.PI / 180);
  const dlat = lat - coreLat;
  const dlon = (lon - coreLon) * Math.cos(mid);
  let deg = (Math.atan2(dlon, dlat) * 180) / Math.PI;
  if (deg < 0) deg += 360;
  let delta = Math.abs(deg - upwind);
  if (delta > 180) delta = 360 - delta;
  return delta <= 90;
}

function rainVerdict(storm: StormAtFlare | null | undefined): Verdict {
  if (storm === undefined) return unscored();
  if (!storm?.object) return noStorm();
  if (storm.inside) return { ok: true, label: "yes" };
  return {
    ok: false,
    label: storm.edgeKm != null ? `${num.format(storm.edgeKm)} km` : "no",
  };
}

function upwindVerdict(flare: Flare, storm: StormAtFlare | null): Verdict {
  const toward = storm?.object?.motionTowardDeg;
  if (
    toward == null ||
    storm?.object == null ||
    storm.object.coreLat == null ||
    storm.object.coreLon == null
  ) {
    return { ok: null, label: "no heading" };
  }
  const ok = upwindOf(
    storm.object.coreLat,
    storm.object.coreLon,
    flare.lat,
    flare.lon,
    toward
  );
  return { ok, label: ok ? "yes" : "no" };
}

function edgeVerdict(storm: StormAtFlare): Verdict {
  if (storm.edgeKm == null || storm.coreKm == null) {
    return { ok: null, label: "—" };
  }
  const ok = storm.edgeKm < storm.coreKm;
  return { ok, label: ok ? "yes" : "no" };
}

function echoVerdict(storm: StormAtFlare): Verdict {
  if (storm.echoTopFt == null || storm.freezingFt == null) {
    return { ok: null, label: "—" };
  }
  const ok = storm.echoTopFt >= storm.freezingFt;
  return { ok, label: ok ? "yes" : "no" };
}

function grewVerdict(storm: StormAtFlare): Verdict {
  const d = storm.object?.areaDeltaKm2;
  if (d == null) return { ok: null, label: "—" };
  if (d > 0.5) return { ok: true, label: "yes" };
  if (d < -0.5) return { ok: false, label: "no" };
  return { ok: null, label: "unchanged" };
}

function lightningVerdict(storm: StormAtFlare): Verdict {
  if (storm.glmFlashes == null) return { ok: null, label: "—" };
  if (storm.glmFlashes === 0) return { ok: false, label: "none" };
  return {
    ok: true,
    label: `${storm.glmFlashes}`,
  };
}

function colderTopVerdict(storm: StormAtFlare): Verdict {
  const delta = storm.goesTopDeltaC;
  if (delta == null) return { ok: null, label: "—" };
  if (delta < -0.5) {
    return { ok: true, label: `${num.format(-delta)} °C` };
  }
  if (delta > 0.5) {
    return { ok: false, label: `${num.format(delta)} °C warmer` };
  }
  return { ok: null, label: "unchanged" };
}

function liquidVerdict(storm: StormAtFlare): Verdict {
  if (storm.slwGM2 == null) return { ok: null, label: "—" };
  if (storm.slwGM2 >= SLW_BANDS[0].value) {
    return { ok: true, label: `${num.format(storm.slwGM2)} g/m²` };
  }
  return { ok: false, label: "none" };
}

export type StormColumn = {
  key: string;
  heading: string;
  of: (flare: Flare, storm: StormAtFlare) => Verdict;
};

/**
 * Each column is one test we can score from the storm at the release minute.
 *
 * The first five are the Texas radar-object tests. The last three are the
 * readings hanging on that same storm — lightning, whether the top cooled,
 * and whether the model put liquid in the band over it.
 */
export const STORM_COLUMNS: readonly StormColumn[] = [
  {
    key: "inRain",
    heading: "In the rain",
    of: (_flare, storm) => rainVerdict(storm),
  },
  {
    key: "upwind",
    heading: "Upwind of the heaviest rain",
    of: (flare, storm) => upwindVerdict(flare, storm),
  },
  {
    key: "nearerEdge",
    heading: "Nearer the edge than the core",
    of: (_flare, storm) => edgeVerdict(storm),
  },
  {
    key: "echoPastFreezing",
    heading: "Echo top past freezing",
    of: (_flare, storm) => echoVerdict(storm),
  },
  {
    key: "grew",
    heading: "Raining area grew",
    of: (_flare, storm) => grewVerdict(storm),
  },
  {
    key: "lightning",
    heading: "Lightning in five minutes",
    of: (_flare, storm) => lightningVerdict(storm),
  },
  {
    key: "colderTop",
    heading: "Cloud top colder",
    of: (_flare, storm) => colderTopVerdict(storm),
  },
  {
    key: "liquidOverStorm",
    heading: "Supercooled liquid over the storm",
    of: (_flare, storm) => liquidVerdict(storm),
  },
];

/** One row of the storm table, including flares that were never asked. */
export function stormCells(flare: Flare): Verdict[] {
  if (!("storm" in flare) || flare.storm === undefined) {
    return STORM_COLUMNS.map(() => unscored());
  }
  if (!flare.storm?.object) {
    return STORM_COLUMNS.map((column) =>
      column.key === "inRain" ? noStorm() : unscored()
    );
  }
  return STORM_COLUMNS.map((column) => column.of(flare, flare.storm!));
}
