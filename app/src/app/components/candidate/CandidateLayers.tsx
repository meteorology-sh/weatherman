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
          g/m² in the {BAND_LABEL} band. The other four layers are its inputs —
          leave the amber on and amber with no green over it is liquid this
          layer rejected.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={CloudTopLegend}
        checked={cloudTop}
        onChange={(on) => dispatch(cloudTopActions.setVisible(on))}
      >
        <CloudTopRamp />
        <div className="text-xs">
          °C at the cloud top. The warmest band is the shallow
          supercooled-topped cloud worth finding; the faintest is cirrus.
        </div>
      </LayerToggle>

      <LayerToggle
        legend={CloudBaseLegend}
        checked={cloudBase}
        onChange={(on) => dispatch(cloudBaseActions.setVisible(on))}
      >
        <CloudBaseRamp />
        <div className="text-xs">
          ft MSL at the cloud base. The lit band is the window Texas operations
          select in; either side of it is context.
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
          g/m² in the {BAND_LABEL} band &middot; {SLW_LABELS[0]} to{" "}
          {SLW_LABELS[SLW_LABELS.length - 1]}
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
          {RADAR_LABELS[RADAR_LABELS.length - 1]}. Cyan over amber is a
          candidate already raining itself out.
        </div>
      </LayerToggle>
    </div>
  );
};
