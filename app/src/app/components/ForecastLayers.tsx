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
  stackedColor,
} from "@/lib/arcgis/renderers";

type RampPropsT = {
  bands: readonly { value: number; alpha: number }[];
  rgb: readonly number[];
  /** One caption per band, in the operator's units. */
  captions: string[];
  /** Optional hover text per band, for the words behind the numbers. */
  titles?: readonly string[];
};

/**
 * The map paints these bands over each other, so each swatch shows the same
 * cumulative alpha, composited the way the map composites it. Derive it — a
 * legend that sums the alphas reads far darker than the map draws.
 */
const Ramp = ({ bands, rgb, captions, titles }: RampPropsT) => (
  <div className="flex flex-col gap-1">
    <div className="flex rounded overflow-hidden border border-base-300">
      {bands.map((band, i) => (
        <div
          key={band.value}
          className="h-4 flex-1"
          title={titles?.[i]}
          style={{ backgroundColor: stackedColor(bands, rgb, i + 1) }}
        />
      ))}
    </div>
    <div className="flex text-xs opacity-60">
      {captions.map((caption) => (
        <span key={caption} className="flex-1">
          {caption}
        </span>
      ))}
    </div>
  </div>
);

export const ForecastLayers = () => {
  const dispatch = useAppDispatch();
  const precip = useAppSelector((state) => state.forecast.precip);
  const hour = useAppSelector((state) => state.forecast.hour);

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
            <Ramp
              bands={PRECIP_BANDS}
              rgb={PRECIP_RGB}
              captions={PRECIP_BANDS.map((band) => String(band.value))}
              titles={PRECIP_LABELS}
            />
            <div className="text-xs opacity-60">
              mm/hr &middot; {PRECIP_LABELS[0]} to{" "}
              {PRECIP_LABELS[PRECIP_LABELS.length - 1]}
            </div>
            {hour < PRECIP_FIRST_HOUR && (
              <div className="text-xs opacity-70">
                HRRR diagnoses rain by stepping the model forward, so the
                analysis has none to show. Step to +{PRECIP_FIRST_HOUR} h.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
