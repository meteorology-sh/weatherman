// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";

// ArcGIS
import {
  CandidateLegend,
  CloudBaseLegend,
  EchoFreezeLegend,
  HeadingLegend,
  LightningLegend,
  RadarLegend,
} from "@/lib/arcgis/legends";
import { RADAR_BANDS, RADAR_RGB } from "@/lib/arcgis/bands";

// Components
import { LayerToggle, SubToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";
import { CloudBaseRamp } from "@/app/components/panel/CloudBaseRamp";

export const CandidateLayers = () => {
  const dispatch = useAppDispatch();
  const cloudBase = useAppSelector((state) => state.cloudbase.visible);
  const radar = useAppSelector((state) => state.radar.visible);
  const lightning = useAppSelector((state) => state.radar.lightning);
  const heading = useAppSelector((state) => state.radar.heading);
  const echoFreeze = useAppSelector((state) => state.radar.echoFreeze);
  const field = useAppSelector((state) => state.seedability.visible);

  return (
    <div className="flex flex-col gap-4">
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
          rgb={RADAR_RGB}
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
        <CloudBaseRamp />
      </LayerToggle>
    </div>
  );
};
