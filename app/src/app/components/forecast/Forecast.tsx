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
