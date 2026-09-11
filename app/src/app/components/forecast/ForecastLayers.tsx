// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

// ArcGIS
import {
  CloudCoverLegend,
  LiquidLegend,
  PrecipLegend,
} from "@/lib/arcgis/legends";
import {
  BAND_LABEL,
  CLOUD_BANDS,
  COLORS,
  PRECIP_BANDS,
  PRECIP_LABELS,
  PRECIP_FIRST_HOUR,
  SLW_BANDS,
  SLW_LABELS,
} from "@/lib/arcgis/bands";

// Components
import { LayerDefinitions } from "@/app/components/panel/LayerDefinitions";
import { LayerToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";

export const ForecastLayers = () => {
  const dispatch = useAppDispatch();
  const precip = useAppSelector((state) => state.forecast.precip);
  const liquid = useAppSelector((state) => state.forecast.liquid);
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
          rgb={COLORS.cloud}
          captions={CLOUD_BANDS.map((band) => `${band.value}%`)}
        />
        <LayerDefinitions legend={CloudCoverLegend} />
      </div>

      <LayerToggle
        legend={PrecipLegend}
        checked={precip}
        onChange={(on) => dispatch(forecastActions.setPrecip(on))}
      >
        {/* The ramp is grayed at the analysis hour rather than hidden: the
            layer exists and will paint one step along, so the operator should
            see what is coming, not watch a control vanish. */}
        <Ramp
          bands={PRECIP_BANDS}
          rgb={COLORS.rain}
          captions={PRECIP_BANDS.map((band) => String(band.value))}
          titles={PRECIP_LABELS}
          muted={blank}
        />
        {blank ? (
          <div className="alert alert-info alert-soft p-2 text-xs">
            <span>
              Analysis hour: 0 mm/hr.{" "}
              <button
                className="link font-semibold"
                onClick={() =>
                  dispatch(forecastActions.setHour(PRECIP_FIRST_HOUR))
                }
              >
                +{PRECIP_FIRST_HOUR} h
              </button>
            </span>
          </div>
        ) : (
          <div className="text-xs">mm/hr</div>
        )}
      </LayerToggle>

      {/* The one layer on this map that is off on arrival. Cloud and rain are
          what the forecast map is; this is a seeding reading taken on it, and
          each hour of it is a fresh integration on the server rather than a
          window off a build that is already warm. So it waits to be asked. */}
      <LayerToggle
        legend={LiquidLegend}
        checked={liquid}
        onChange={(on) => dispatch(forecastActions.setLiquid(on))}
      >
        <Ramp
          bands={SLW_BANDS}
          rgb={COLORS.liquid}
          captions={SLW_BANDS.map((band) => String(band.value))}
          titles={SLW_LABELS}
        />
        <div className="text-xs">
          g/m² of ground, summed through the {BAND_LABEL} band. Unlike
          precipitation it exists at the analysis hour: a mixing ratio is a
          state the model holds, not a flux it steps forward to find.
        </div>
      </LayerToggle>
    </div>
  );
};
