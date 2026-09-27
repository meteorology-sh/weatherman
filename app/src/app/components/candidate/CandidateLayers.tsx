// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";
import { candidateActions } from "@/lib/store/features/candidate";
import { warningsActions } from "@/lib/store/features/warnings";

// ArcGIS
import {
  CandidateLegend,
  CloudBaseLegend,
  EchoFreezeLegend,
  HeadingLegend,
  LightningLegend,
  LiquidLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";
import {
  BAND_LABEL,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_LABELS,
  COLORS,
  RADAR_BANDS,
  SLW_BANDS,
  SLW_LABELS,
} from "@/lib/arcgis/bands";

// Components
import { LayerToggle, SubToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";
import { WarningToggle } from "@/app/components/panel/WarningToggle";

export const CandidateLayers = () => {
  const dispatch = useAppDispatch();
  const cloudBase = useAppSelector((state) => state.cloudbase.visible);
  const radar = useAppSelector((state) => state.radar.visible);
  const lightning = useAppSelector((state) => state.radar.lightning);
  const heading = useAppSelector((state) => state.radar.heading);
  const echoFreeze = useAppSelector((state) => state.radar.echoFreeze);
  const field = useAppSelector((state) => state.seedability.visible);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const warnings = useAppSelector((state) => state.warnings);

  return (
    <div className="flex flex-col gap-4">
      <WarningToggle
        stats={warnings.stats}
        error={warnings.error}
        checked={warnings.visible}
        onChange={(on) => dispatch(warningsActions.setVisible(on))}
      />

      <LayerToggle
        legend={CandidateLegend}
        checked={field}
        onChange={(on) => dispatch(seedabilityActions.setVisible(on))}
      />

      <LayerToggle
        legend={RadarLegend}
        checked={radar}
        onChange={(on) => dispatch(radarActions.setVisible(on))}
      >
        <Ramp
          bands={RADAR_BANDS}
          rgb={COLORS.rain}
          captions={RADAR_BANDS.map((band) => String(band.value))}
        />
        <div className="text-xs">dBZ</div>
        <SubToggle
          name={HeadingLegend.name}
          checked={heading}
          onChange={(on) => dispatch(radarActions.setHeading(on))}
        />
        <SubToggle
          name={LightningLegend.name}
          checked={lightning}
          onChange={(on) => dispatch(radarActions.setLightning(on))}
        />
        <SubToggle
          name={EchoFreezeLegend.name}
          checked={echoFreeze}
          onChange={(on) => dispatch(radarActions.setEchoFreeze(on))}
        />
      </LayerToggle>

      <LayerToggle
        legend={CloudBaseLegend}
        checked={cloudBase}
        onChange={(on) => dispatch(cloudBaseActions.setVisible(on))}
      >
        <Ramp
          bands={CLOUD_BASE_BANDS}
          rgb={COLORS.cloudBase}
          captions={CLOUD_BASE_LABELS}
          disjoint
        />
        <div className="text-xs">ft MSL</div>
      </LayerToggle>

      <LayerToggle
        legend={LiquidLegend}
        checked={liquid}
        onChange={(on) => dispatch(candidateActions.setLiquid(on))}
      >
        <Ramp
          bands={SLW_BANDS}
          rgb={COLORS.liquid}
          captions={SLW_BANDS.map((band) => String(band.value))}
          titles={SLW_LABELS}
        />
        <div className="text-xs">
          g/m² of ground, summed through the {BAND_LABEL} band.
        </div>
      </LayerToggle>
    </div>
  );
};
