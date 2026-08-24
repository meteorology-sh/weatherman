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
import type { CloudPhase, Verdict } from "@/lib/types";

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
 * What the satellite measured at the top of this cloud.
 *
 * Everything else on this readout about liquid water is the model's. This one
 * line is measured, and it is worth its own words rather than a class name: an
 * operator wants to know whether the cloud has frozen, not which of six labels
 * an algorithm assigned it.
 */
const PHASE_READING: Record<CloudPhase, string> = {
  supercooled: "The top of this cloud is supercooled liquid.",
  mixed: "The top of this cloud is part liquid and part ice.",
  ice: "The top of this cloud has already frozen. The model still puts liquid in the band below it.",
  liquid: "The top of this cloud is liquid and warmer than freezing.",
  clear: "The phase scan sees no cloud here.",
  unknown: "Unknown: The phase scan could not classify data here",
};

/**
 * The join over the clicked point.
 *
 * The layers below report their own field across the whole model domain, which
 * is a statement about the country. This is the same five tests asked of the
 * one 3 km cell an operator is looking at: what is in the cloud there, what
 * ruled it out, when each source saw it and which cell it is.
 */
export const CloudHere = () => {
  const here = useAppSelector((state) => state.seedability.here);
  const loading = useAppSelector((state) => state.seedability.hereLoading);
  const error = useAppSelector((state) => state.seedability.hereError);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <span className="loading loading-spinner loading-sm"></span>
        Reading every source over that point…
      </div>
    );
  }

  if (error) return <div className="text-error">{error}</div>;
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

      {/* The one measured statement about phase on this panel, kept out of the
          grid above because it is not one of the tests — nothing here changed
          the verdict, and a row among the inputs would read as though it had.
          The limit rides with it rather than living on the About page, because
          it is what stops "already frozen" being read as "do not fly". */}
      <div className="flex flex-col gap-1 text-xs">
        <span className="font-semibold">Measured at the cloud top</span>
        {here.topPhase === null ? (
          <span>
            No phase scan was available for this hour, so nothing observed
            checks the model here.
          </span>
        ) : (
          <>
            <span>{PHASE_READING[here.topPhase]}</span>
            <span>This reading is for the cloud top only.</span>
          </>
        )}
      </div>

      <div className="text-xs">
        {here.lat}, {here.lon} · the 3 km cell containing your click
        <br />
        Model {utc(here.run)}Z, satellite {utc(here.sceneTime)}Z, radar{" "}
        {utc(here.radarTime)}Z
        {here.phaseTime !== null && <>, phase {utc(here.phaseTime)}Z</>}.
      </div>
    </div>
  );
};
