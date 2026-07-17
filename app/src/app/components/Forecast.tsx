// ArcGIS
import { CLOUD_BANDS, stackedAlpha } from "@/lib/arcgis/renderers";

// Components
import { ArcGIS } from "./Map";
import { TimeSlider } from "./TimeSlider";

const Legend = () => (
  <div className="flex flex-col gap-1">
    <div className="text-sm font-semibold">Cloud cover</div>
    <div className="flex items-center gap-2">
      <div className="flex-1 flex rounded overflow-hidden border border-base-300">
        {CLOUD_BANDS.map(({ value }, i) => (
          <div
            key={value}
            className="h-4 flex-1"
            // The map paints these bands over each other, so the legend shows
            // the same cumulative alpha — computed the way the map composites
            // it, or the swatches would not match what is drawn.
            style={{
              backgroundColor: `rgba(255,255,255,${stackedAlpha(i + 1).toFixed(3)})`,
            }}
          />
        ))}
      </div>
    </div>
    <div className="flex justify-between text-xs opacity-60">
      {CLOUD_BANDS.map(({ value }) => (
        <span key={value}>{value}%</span>
      ))}
    </div>
  </div>
);

export const Forecast = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Cloud Forecast</h2>
          <p>Modelled cloud cover from NOAA HRRR, out to 18 hours.</p>
        </div>

        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <p>
                  Drag the slider to step through the forecast. Each frame is
                  HRRR total cloud cover, contoured into nested bands — the
                  denser the white, the more cloud. Where the model has no
                  cloud, nothing is drawn, so the basemap stays readable.
                </p>
                <p>
                  This is a <em>model</em>, not a picture: satellites cannot see
                  the future, so nothing here is observed. For observed cloud
                  shape, use the candidate map.
                </p>
              </div>
            </div>
          </div>
        </div>

        <TimeSlider />
        <div className="divider my-1" />
        <Legend />
      </div>

      <div className="col-span-2">
        <ArcGIS mode="forecast" />
      </div>
    </div>
  );
};
