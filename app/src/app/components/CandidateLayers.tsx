// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { candidateActions } from "@/lib/store/features/candidate";
import { radarActions } from "@/lib/store/features/radar";
import { pirepActions } from "@/lib/store/features/pirep";

// ArcGIS
import { Band13Legend } from "@/lib/arcgis/legends";
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
import { Band13Ramp } from "./Band13Ramp";
import { PirepRamp } from "./PirepRamp";

export const CandidateLayers = () => {
  const dispatch = useAppDispatch();
  const imagery = useAppSelector((state) => state.candidate.imagery);
  const liquid = useAppSelector((state) => state.candidate.liquid);
  const radar = useAppSelector((state) => state.radar.visible);
  const pireps = useAppSelector((state) => state.pirep.visible);
  const bandOnly = useAppSelector((state) => state.pirep.bandOnly);

  return (
    <div className="flex flex-col gap-4">
      <LayerToggle
        name="Cloud tops"
        title={<>Cloud tops &middot; {Band13Legend.name}</>}
        checked={imagery}
        onChange={(on) => dispatch(candidateActions.setImagery(on))}
      >
        <div className="text-xs opacity-60">{Band13Legend.summary}</div>
        <Band13Ramp />
        <div className="text-xs opacity-50">{Band13Legend.caveat}</div>
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

      <LayerToggle
        name="Icing reports"
        title="Icing reports · 12 h"
        checked={pireps}
        onChange={(on) => dispatch(pirepActions.setVisible(on))}
      >
        <PirepRamp />
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-xs"
            checked={bandOnly}
            aria-label="Seeding band only"
            onChange={(e) =>
              dispatch(pirepActions.setBandOnly(e.target.checked))
            }
          />
          <span className="text-xs">Seeding band only</span>
        </label>
        <div className="text-xs opacity-60">
          What pilots reported &middot; grey means an aircraft flew through and
          found no ice.
        </div>
        <div className="text-xs opacity-50">
          Observed, and the only direct evidence of supercooled liquid water on
          this map — rime ice is liquid freezing on impact. Points, not a
          surface: these are a few reports a day, hundreds of kilometres apart
          and only where aircraft fly, so the gaps between them mean nobody
          looked, not that there is nothing there.
        </div>
      </LayerToggle>
    </div>
  );
};
