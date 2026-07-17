// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { forecastActions } from "@/lib/store/features/forecast";

// ArcGIS
import {
  CLOUD_BANDS,
  CLOUD_RGB,
  PRECIP_BANDS,
  PRECIP_LABELS,
  PRECIP_RGB,
  PRECIP_FIRST_HOUR,
} from "@/lib/arcgis/renderers";

// Components
import { Ramp } from "./Ramp";

export const ForecastLayers = () => {
  const dispatch = useAppDispatch();
  const precip = useAppSelector((state) => state.forecast.precip);
  const hour = useAppSelector((state) => state.forecast.hour);
  const blank = hour < PRECIP_FIRST_HOUR;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold">Cloud cover</div>
        <Ramp
          bands={CLOUD_BANDS}
          rgb={CLOUD_RGB}
          captions={CLOUD_BANDS.map((band) => `${band.value}%`)}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={precip}
            aria-label="Precipitation"
            onChange={(e) =>
              dispatch(forecastActions.setPrecip(e.target.checked))
            }
          />
          <span className="text-sm font-semibold">Precipitation</span>
        </label>

        {precip && (
          <>
            {/* The ramp is greyed at the analysis hour rather than hidden: the
                layer exists and will paint one step along, so the operator
                should see what is coming, not watch a control vanish. */}
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
                  No rain at the analysis hour — HRRR diagnoses precipitation by
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
              <div className="text-xs opacity-60">
                mm/hr &middot; {PRECIP_LABELS[0]} to{" "}
                {PRECIP_LABELS[PRECIP_LABELS.length - 1]}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
