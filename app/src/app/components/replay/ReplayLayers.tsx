// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { replayActions } from "@/lib/store/features/replay";

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
  RADAR_BANDS,
  RADAR_RGB,
  SLW_BANDS,
  SLW_LABELS,
  SLW_RGB,
} from "@/lib/arcgis/bands";

// Components
import { LayerToggle, SubToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";
import { CloudBaseRamp } from "@/app/components/panel/CloudBaseRamp";

/**
 * The replay map's switches. The same layers as the candidate map and the same
 * legends — only the hour differs, so the ramps must not.
 */
export const ReplayLayers = () => {
  const dispatch = useAppDispatch();
  const cloudBase = useAppSelector((state) => state.replay.cloudBase);
  const radar = useAppSelector((state) => state.replay.radar);
  const lightning = useAppSelector((state) => state.replay.lightning);
  const heading = useAppSelector((state) => state.replay.heading);
  const echoFreeze = useAppSelector((state) => state.replay.echoFreeze);
  const field = useAppSelector((state) => state.replay.field);
  const liquid = useAppSelector((state) => state.replay.liquid);

  return (
    <div className="flex flex-col gap-4">
      <LayerToggle
        legend={CandidateLegend}
        checked={field}
        onChange={(on) => dispatch(replayActions.setField(on))}
      />

      <LayerToggle
        legend={RadarLegend}
        checked={radar}
        onChange={(on) => dispatch(replayActions.setRadar(on))}
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
          onChange={(on) => dispatch(replayActions.setHeading(on))}
        />
        <SubToggle
          name={LightningLegend.name}
          checked={lightning}
          onChange={(on) => dispatch(replayActions.setLightning(on))}
        />
        <SubToggle
          name={EchoFreezeLegend.name}
          checked={echoFreeze}
          onChange={(on) => dispatch(replayActions.setEchoFreeze(on))}
        />
      </LayerToggle>

      <LayerToggle
        legend={CloudBaseLegend}
        checked={cloudBase}
        onChange={(on) => dispatch(replayActions.setCloudBase(on))}
      >
        <CloudBaseRamp />
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
          g/m² of ground, summed through the {BAND_LABEL} band, from that hour's
          HRRR analysis.
        </div>
      </LayerToggle>
    </div>
  );
};
