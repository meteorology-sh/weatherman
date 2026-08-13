// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudTopActions } from "@/lib/store/features/cloudtop";
import { radarActions } from "@/lib/store/features/radar";

// ArcGIS
import { CloudTopLegend } from "@/lib/arcgis/legends";
import {
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

export const CandidateLayers = () => {
  const dispatch = useAppDispatch();
  const cloudTop = useAppSelector((state) => state.cloudtop.visible);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const radar = useAppSelector((state) => state.radar.visible);

  return (
    <div className="flex flex-col gap-4">
      <LayerToggle
        name="Cloud tops"
        title={<>Cloud tops &middot; {CloudTopLegend.name}</>}
        checked={cloudTop}
        onChange={(on) => dispatch(cloudTopActions.setVisible(on))}
      >
        <div className="text-xs opacity-60">{CloudTopLegend.summary}</div>
        <CloudTopRamp />
        <div className="text-xs opacity-60">
          °C at the cloud top &middot; warmest band is the shallow
          supercooled-topped cloud worth finding; the faintest is cirrus.
        </div>
        <div className="text-xs opacity-50">{CloudTopLegend.caveat}</div>
      </LayerToggle>

      <LayerToggle
        name="Supercooled liquid water"
        checked={liquid}
        onChange={(on) => dispatch(candidateActions.setLiquid(on))}
      >
        <Ramp
          bands={SLW_BANDS}
          rgb={SLW_RGB}
          captions={SLW_BANDS.map((band) => String(band.value))}
          titles={SLW_LABELS}
        />
        <div className="text-xs opacity-60">
          g/m² in the {BAND_LABEL} band &middot; {SLW_LABELS[0]} to{" "}
          {SLW_LABELS[SLW_LABELS.length - 1]}
        </div>
        <div className="text-xs opacity-50">
          Modelled, not observed: HRRR's analysis of what is inside the cloud,
          which no satellite can see. Drawn for the analysis hour, so it is the
          model's best estimate of right now rather than a forecast.
        </div>
      </LayerToggle>

      <LayerToggle
        name="Radar"
        title="Radar · base reflectivity"
        checked={radar}
        onChange={(on) => dispatch(radarActions.setVisible(on))}
      >
        <Ramp
          bands={RADAR_BANDS}
          rgb={RADAR_RGB}
          captions={RADAR_BANDS.map((band) => String(band.value))}
          titles={RADAR_LABELS}
        />
        <div className="text-xs opacity-60">
          dBZ &middot; {RADAR_LABELS[0]} to{" "}
          {RADAR_LABELS[RADAR_LABELS.length - 1]}
        </div>
        <div className="text-xs opacity-50">
          Measured, not modelled — the only layer here that is. Cyan over amber
          is a candidate already raining itself out, which is the clearest "not
          this one" on the map. Radar is a mask, though, not a detector: it sees
          the water that is already falling, so quiet air over a cloud is no
          evidence about what is inside it.
        </div>
      </LayerToggle>
    </div>
  );
};
