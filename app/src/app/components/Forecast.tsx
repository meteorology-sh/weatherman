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
                <p>
                  Drag the slider to step through the forecast. Each frame is
                  HRRR total cloud cover, contoured into nested bands — the
                  denser the white, the more cloud. Where the model has no
                  cloud, nothing is drawn, so the basemap stays readable.
                </p>
                <p>
                  Precipitation rate is contoured the same way, in cyan, over
                  the cloud. Rain covers a fraction of the ground cloud does, so
                  it reads as distinct cells rather than a wash — and a cloud
                  that is already raining is not a seeding candidate.
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
        <ForecastLayers />
      </div>

      <div className="col-span-2">
        <ArcGIS mode="forecast" />
      </div>
    </div>
  );
};
