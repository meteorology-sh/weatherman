// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

// ArcGIS
import { CloudCoverLegend, PrecipLegend } from "@/lib/arcgis/legends";
import {
  CLOUD_BANDS,
  CLOUD_RGB,
  PRECIP_BANDS,
  PRECIP_LABELS,
  PRECIP_RGB,
  PRECIP_FIRST_HOUR,
} from "@/lib/arcgis/bands";

// Components
import { LayerDefinitions } from "@/app/components/panel/LayerDefinitions";
import { LayerToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";

export const ForecastLayers = () => {
  const dispatch = useAppDispatch();
  const precip = useAppSelector((state) => state.forecast.precip);
  const hour = useAppSelector((state) => state.forecast.hour);
  const blank = hour < PRECIP_FIRST_HOUR;

  return (
    <div className="flex flex-col gap-4">
      {/* Cloud cover has no switch: it is what this map is. So it carries the
          same name, ramp and explanation as every other layer, without one. */}
      <div className="flex flex-col gap-2">
        <div className="text-sm font-semibold">{CloudCoverLegend.name}</div>
        <Ramp
          bands={CLOUD_BANDS}
          rgb={CLOUD_RGB}
          captions={CLOUD_BANDS.map((band) => `${band.value}%`)}
        />
        <LayerDefinitions legend={CloudCoverLegend} />
      </div>

      <LayerToggle
        legend={PrecipLegend}
        checked={precip}
        onChange={(on) => dispatch(forecastActions.setPrecip(on))}
      >
        {/* The ramp is greyed at the analysis hour rather than hidden: the
            layer exists and will paint one step along, so the operator should
            see what is coming, not watch a control vanish. */}
        <Ramp
          bands={PRECIP_BANDS}
          rgb={PRECIP_RGB}
          captions={PRECIP_BANDS.map((band) => String(band.value))}
          titles={PRECIP_LABELS}
          muted={blank}
        />
        {blank ? (
          <div className="alert alert-info alert-soft p-2 text-xs">
            <span>
              No rain at the analysis hour — HRRR works precipitation out by
              stepping the model forward, so f00 has none to show.{" "}
              <button
                className="link font-semibold"
                onClick={() =>
                  dispatch(forecastActions.setHour(PRECIP_FIRST_HOUR))
                }
              >
                Step to +{PRECIP_FIRST_HOUR} h
              </button>
            </span>
          </div>
        ) : (
          <div className="text-xs">
            mm/hr &middot; {PRECIP_LABELS[0]} to{" "}
            {PRECIP_LABELS[PRECIP_LABELS.length - 1]}
          </div>
        )}
      </LayerToggle>
    </div>
  );
};
