// Components
import { ArcGIS } from "./Map";
import { TimeSlider } from "./TimeSlider";
import { ForecastLayers } from "./ForecastLayers";

export const Forecast = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Cloud Forecast</h2>
          <p>
            Modelled cloud cover and precipitation from NOAA HRRR, out to 18
            hours.
          </p>
        </div>

        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <ol>
                  <li>
                    Drag the slider to step through the run, from the analysis
                    hour out to +18 h. The frame redraws at each step.
                  </li>
                  <li>
                    Switch PRECIPITATION off to read the cloud on its own. It
                    has nothing to draw at the analysis hour, so step forward an
                    hour to see it.
                  </li>
                  <li>
                    Open “What this measures” under either layer for what it is
                    and how it is made.
                  </li>
                  <li>
                    For observed cloud rather than modelled, use the candidate
                    map.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>

        <TimeSlider />
        <div className="divider my-1" />
        <ForecastLayers />
      </div>

      <div className="col-span-2">
        <ArcGIS mode="forecast" />
      </div>
    </div>
  );
};
