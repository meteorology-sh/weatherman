// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { replayActions } from "@/lib/store/features/replay";

// ArcGIS
import {
  CandidateLegend,
  CloudBaseLegend,
  CloudTopLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";
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
import { CloudBaseRamp } from "./CloudBaseRamp";
import { CloudTopRamp } from "./CloudTopRamp";

/**
 * The replay map's switches. The same layers as the candidate map and the same
 * legends — only the hour differs, so the ramps must not.
 */
export const ReplayLayers = () => {
  const dispatch = useAppDispatch();
  const cloudBase = useAppSelector((state) => state.replay.cloudBase);
  const cloudTop = useAppSelector((state) => state.replay.cloudTop);
  const liquid = useAppSelector((state) => state.replay.liquid);
  const radar = useAppSelector((state) => state.replay.radar);
  const field = useAppSelector((state) => state.replay.field);

  return (
    <div className="flex flex-col gap-4">
      <LayerToggle
        legend={CandidateLegend}
        checked={field}
        onChange={(on) => dispatch(replayActions.setField(on))}
      >
        <Ramp
          bands={CANDIDATE_BANDS}
          rgb={CANDIDATE_RGB}
          captions={CANDIDATE_BANDS.map((band) => String(band.value))}
          titles={CANDIDATE_LABELS}
        />
        <div className="text-xs">
          g/m² in the {BAND_LABEL} band, rebuilt from that hour's own model run
          and scans.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={CloudTopLegend}
        checked={cloudTop}
        onChange={(on) => dispatch(replayActions.setCloudTop(on))}
      >
        <CloudTopRamp />
        <div className="text-xs">
          °C at the cloud top, from the scan nearest that hour.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={CloudBaseLegend}
        checked={cloudBase}
        onChange={(on) => dispatch(replayActions.setCloudBase(on))}
      >
        <CloudBaseRamp />
        <div className="text-xs">
          ft MSL at the cloud base, from that hour's HRRR analysis.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={LiquidLegend}
        checked={liquid}
        onChange={(on) => dispatch(replayActions.setLiquid(on))}
      >
        <Ramp
          bands={SLW_BANDS}
          rgb={SLW_RGB}
          captions={SLW_BANDS.map((band) => String(band.value))}
          titles={SLW_LABELS}
        />
        <div className="text-xs">
          g/m² in the {BAND_LABEL} band, from that hour's HRRR analysis.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={RadarLegend}
        checked={radar}
        onChange={(on) => dispatch(replayActions.setRadar(on))}
      >
        <Ramp
          bands={RADAR_BANDS}
          rgb={RADAR_RGB}
          captions={RADAR_BANDS.map((band) => String(band.value))}
          titles={RADAR_LABELS}
        />
        <div className="text-xs">
          dBZ, from the mosaic nearest that hour. Rain already falling is a
          candidate crossed off.
        </div>
      </LayerToggle>
    </div>
  );
};
