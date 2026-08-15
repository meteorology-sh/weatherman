// Store
import { useAppSelector } from "@/lib/store/hooks";

// ArcGIS
import { BAND_LABEL, RADAR_BANDS, SLW_BANDS } from "@/lib/arcgis/bands";
import {
  CandidateLegend,
  CloudBaseLegend,
  CloudTopLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";

// Types
import type { Verdict } from "@/lib/types";

const num = new Intl.NumberFormat("en-US");

/** Hour and minute only. Every source here is within an hour of now. */
const utc = (iso: string) => new Date(iso).toISOString().slice(11, 16);

/**
 * What every test said about this cell, in the order the join asks them.
 *
 * The first line is the answer; the rest is why. A cell fails more than one
 * test as often as not, and this names the first one only — the same rule the
 * map is drawn by, so a green cell here and green ground there cannot disagree.
 */
const ANSWER: Record<Verdict, string> = {
  candidate: "Everything a seeding pass needs is over this point.",
  noLiquid: `The model puts no supercooled liquid in the ${BAND_LABEL} band here, so there is nothing to seed.`,
  noCloudBase: "The model gives no cloud base here — nothing to climb into.",
  baseAboveBand: `This cloud is colder than the ${BAND_LABEL} band all the way to its base.`,
  noCloudSeen: "The satellite sees no cloud here, which contradicts the model.",
  topTooWarm:
    "This cloud's top is too warm, so the seeding band sits above it.",
  raining: "The radar is already watching this cell rain itself out.",
};

/**
 * The join over the clicked point.
 *
 * The panel below reports each layer across the whole model domain, which is a
 * statement about the country. This is the same five tests asked of the one
 * 12 km cell an operator is looking at: what is in the cloud there, what ruled
 * it out, when each source saw it and which cell it is.
 */
export const CloudHere = () => {
  const here = useAppSelector((state) => state.seedability.here);
  const loading = useAppSelector((state) => state.seedability.hereLoading);
  const error = useAppSelector((state) => state.seedability.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-4">
        <span className="loading loading-spinner loading-sm"></span>
        Reading every source over that point…
      </div>
    );
  }

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!here) return null;

  const seedable = here.verdict === "candidate";

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-semibold">CLOUD OVER THIS POINT</h3>

      {/* The verdict on its own line: the layer's name is long, and a badge
          sharing a line with the sentence wraps into it at this width. */}
      <div className="flex flex-col gap-1 text-sm">
        <span
          className={`badge badge-sm self-start ${
            seedable ? "badge-success" : "badge-warning"
          }`}
        >
          {seedable ? CandidateLegend.name : "RULED OUT"}
        </span>
        <span>{ANSWER[here.verdict]}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span>{LiquidLegend.name}</span>
        <span>
          {here.slwGM2 >= SLW_BANDS[0].value
            ? `${num.format(here.slwGM2)} g/m²`
            : "under the lowest contour"}
        </span>
        <span>{CloudBaseLegend.name}</span>
        <span>
          {here.cloudBaseFt === null
            ? "no cloud modelled here"
            : `${num.format(here.cloudBaseFt)} ft MSL`}
        </span>
        <span>{CloudTopLegend.name}</span>
        <span>
          {here.cloudTopC === null
            ? "no cloud seen here"
            : `${here.cloudTopC} °C`}
        </span>
        <span>{RadarLegend.name}</span>
        {/* Three answers, not two. No echo is a radar reporting clear air; no
            coverage is nobody looking, and the cell is unchecked rather than
            cleared. */}
        <span>
          {!here.radarCovered
            ? "no radar over this cell"
            : here.dbz === null
              ? "no echo"
              : `${here.dbz} dBZ${
                  here.dbz >= RADAR_BANDS[0].value ? " — precipitating" : ""
                }`}
        </span>
      </div>

      <div className="text-xs">
        {here.lat}, {here.lon} &middot; the 12 km cell containing your click.
        Model {utc(here.run)}Z, satellite {utc(here.sceneTime)}Z, radar{" "}
        {utc(here.radarTime)}Z.
      </div>
    </div>
  );
};
