// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { cloudTopActions } from "@/lib/store/features/cloudtop";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";

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
} from "@/lib/arcgis/bands";

// Components
import { LayerToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";
import { CloudBaseRamp } from "@/app/components/panel/CloudBaseRamp";
import { CloudTopRamp } from "@/app/components/panel/CloudTopRamp";

export const CandidateLayers = () => {
  const dispatch = useAppDispatch();
  const cloudBase = useAppSelector((state) => state.cloudbase.visible);
  const cloudTop = useAppSelector((state) => state.cloudtop.visible);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const radar = useAppSelector((state) => state.radar.visible);
  const field = useAppSelector((state) => state.seedability.visible);

  return (
    <div className="flex flex-col gap-4">
      <LayerToggle
        legend={CandidateLegend}
        checked={field}
        onChange={(on) => dispatch(seedabilityActions.setVisible(on))}
      >
        <Ramp
          bands={CANDIDATE_BANDS}
          rgb={CANDIDATE_RGB}
          captions={CANDIDATE_BANDS.map((band) => String(band.value))}
          titles={CANDIDATE_LABELS}
        />
        <div className="text-xs">
          g/m² in the {BAND_LABEL} band. The other four layers are it inputs used to compute this layer.
        </div>
        {/* The outline has no swatch on the ramp: it carries no level, so a
            fifth block of colour would imply a fifth amount of liquid. */}
        <div className="text-xs">
          The pale outline marks cloud formations where the satellite still sees liquid at the top.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={CloudTopLegend}
        checked={cloudTop}
        onChange={(on) => dispatch(cloudTopActions.setVisible(on))}
      >
        <CloudTopRamp />
        <div className="text-xs">
          °C at the cloud top.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={CloudBaseLegend}
        checked={cloudBase}
        onChange={(on) => dispatch(cloudBaseActions.setVisible(on))}
      >
        <CloudBaseRamp />
        <div className="text-xs">
          ft MSL at the cloud base.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={LiquidLegend}
        checked={liquid}
        onChange={(on) => dispatch(candidateActions.setLiquid(on))}
      >
        <Ramp
          bands={SLW_BANDS}
          rgb={SLW_RGB}
          captions={SLW_BANDS.map((band) => String(band.value))}
          titles={SLW_LABELS}
        />
        <div className="text-xs">
          g/m² in the {BAND_LABEL} band.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={RadarLegend}
        checked={radar}
        onChange={(on) => dispatch(radarActions.setVisible(on))}
      >
        <Ramp
          bands={RADAR_BANDS}
          rgb={RADAR_RGB}
          captions={RADAR_BANDS.map((band) => String(band.value))}
          titles={RADAR_LABELS}
        />
        <div className="text-xs">
          dBZ &middot; {RADAR_LABELS[0]} to{" "}
          {RADAR_LABELS[RADAR_LABELS.length - 1]}. The 20 dBZ fill is the
          edge of the rain. The dot is the heaviest rain. The white arrow
          is heading, not a forecast. Yellow markers are lightning in the
          last five minutes.
        </div>
      </LayerToggle>
    </div>
  );
};
