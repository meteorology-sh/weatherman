// Components
import { ArcGIS } from "@/app/components/Map";
import { TimeSlider } from "./TimeSlider";
import { ForecastLayers } from "./ForecastLayers";

export const Forecast = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Cloud Forecast</h2>
          <p>HRRR cloud cover and precipitation, 0–18 h.</p>
        </div>

        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <ol>
                  <li>Slider: analysis hour to +18 h.</li>
                  <li>PRECIPITATION starts at +1 h.</li>
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
