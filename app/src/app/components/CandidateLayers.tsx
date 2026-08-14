// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { candidateActions } from "@/lib/store/features/candidate";
import { cloudBaseActions } from "@/lib/store/features/cloudbase";
import { cloudTopActions } from "@/lib/store/features/cloudtop";
import { radarActions } from "@/lib/store/features/radar";
import { seedabilityActions } from "@/lib/store/features/seedability";

// ArcGIS
import { CloudBaseLegend, CloudTopLegend } from "@/lib/arcgis/legends";
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
        name="Seeding opportunity"
        title={<>Seeding opportunity &middot; all four conditions met</>}
        checked={field}
        onChange={(on) => dispatch(seedabilityActions.setVisible(on))}
      >
        <Ramp
          bands={CANDIDATE_BANDS}
          rgb={CANDIDATE_RGB}
          captions={CANDIDATE_BANDS.map((band) => String(band.value))}
          titles={CANDIDATE_LABELS}
        />
        <div className="text-xs opacity-60">
          g/m² in the {BAND_LABEL} band, where the model has liquid, the
          satellite sees a cloud top reaching that band, the cloud has a base
          you can climb through, and the radar is not already watching it rain.
        </div>
        <div className="text-xs opacity-50">
          The other four layers are its inputs. Leave the amber on to read them
          together: amber with no green over it is liquid this field rejected,
          and the panel below says which condition ruled it out.
        </div>
      </LayerToggle>

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
        name="Cloud base"
        title={<>Cloud base &middot; {CloudBaseLegend.name}</>}
        checked={cloudBase}
        onChange={(on) => dispatch(cloudBaseActions.setVisible(on))}
      >
        <div className="text-xs opacity-60">{CloudBaseLegend.summary}</div>
        <CloudBaseRamp />
        <div className="text-xs opacity-60">
          ft MSL at the cloud base &middot; the lit band is the window Texas
          operations select in; either side of it is context.
        </div>
        <div className="text-xs opacity-50">{CloudBaseLegend.caveat}</div>
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
