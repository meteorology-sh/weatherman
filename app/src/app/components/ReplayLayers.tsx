// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { replayActions } from "@/lib/store/features/replay";

// ArcGIS
import { CloudTopLegend } from "@/lib/arcgis/legends";
import {
  CANDIDATE_BANDS,
  CANDIDATE_LABELS,
  CANDIDATE_RGB,
  SLW_BANDS,
  SLW_LABELS,
  SLW_RGB,
  RADAR_BANDS,
  RADAR_LABELS,
  RADAR_RGB,
  BAND_LABEL,
} from "@/lib/arcgis/renderers";

// Components
import { LayerToggle } from "./LayerToggle";
import { Ramp } from "./Ramp";
import { CloudTopRamp } from "./CloudTopRamp";

/**
 * The replay map's switches. The same layers as the candidate map and the same
 * legends — only the hour differs, so the ramps must not.
 */
export const ReplayLayers = () => {
  const dispatch = useAppDispatch();
  const cloudTop = useAppSelector((state) => state.replay.cloudTop);
  const liquid = useAppSelector((state) => state.replay.liquid);
  const radar = useAppSelector((state) => state.replay.radar);
  const field = useAppSelector((state) => state.replay.field);

  return (
    <div className="flex flex-col gap-4">
      <LayerToggle
        name="Seeding opportunity"
        title={<>Seeding opportunity &middot; all four conditions met</>}
        checked={field}
        onChange={(on) => dispatch(replayActions.setField(on))}
      >
        <Ramp
          bands={CANDIDATE_BANDS}
          rgb={CANDIDATE_RGB}
          captions={CANDIDATE_BANDS.map((band) => String(band.value))}
          titles={CANDIDATE_LABELS}
        />
        <div className="text-xs opacity-60">
          g/m² &middot; the join of all three layers below, rebuilt from that
          hour's own model run and scans.
        </div>
      </LayerToggle>

      <LayerToggle
        name="Cloud tops"
        title={<>Cloud tops &middot; {CloudTopLegend.name}</>}
        checked={cloudTop}
        onChange={(on) => dispatch(replayActions.setCloudTop(on))}
      >
        <div className="text-xs opacity-60">{CloudTopLegend.summary}</div>
        <CloudTopRamp />
        <div className="text-xs opacity-50">{CloudTopLegend.caveat}</div>
      </LayerToggle>

      <LayerToggle
        name="Supercooled liquid water"
        title={<>Supercooled liquid water &middot; {BAND_LABEL}</>}
        checked={liquid}
        onChange={(on) => dispatch(replayActions.setLiquid(on))}
      >
        <Ramp
          bands={SLW_BANDS}
          rgb={SLW_RGB}
          captions={SLW_BANDS.map((band) => String(band.value))}
          titles={SLW_LABELS}
        />
        <div className="text-xs opacity-60">
          g/m² in the {BAND_LABEL} band &middot; modelled, from that hour's own
          HRRR analysis.
        </div>
      </LayerToggle>

      <LayerToggle
        name="Radar reflectivity"
        checked={radar}
        onChange={(on) => dispatch(replayActions.setRadar(on))}
      >
        <Ramp
          bands={RADAR_BANDS}
          rgb={RADAR_RGB}
          captions={RADAR_BANDS.map((band) => String(band.value))}
          titles={RADAR_LABELS}
        />
        <div className="text-xs opacity-60">
          dBZ &middot; measured. Rain already falling is a candidate crossed
          off.
        </div>
      </LayerToggle>
    </div>
  );
};
