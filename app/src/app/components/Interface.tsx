// Components
import { ArcGIS } from "./Map";
import { CloudLayers } from "./CloudLayers";
import { Clouds } from "./Clouds";

export const Interface = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>National Cloud Cover</h2>
          <p>Live GOES-East imagery over the continental U.S.</p>
        </div>
        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <p>
                  The map shows GOES-East satellite imagery, refreshed every 10
                  minutes at roughly 2 km resolution — the cloud shapes are
                  observed, not modelled. Switch between the two renderings
                  below. The figures underneath come from a separate 3° model
                  grid, so they summarise the nation rather than the picture;
                  click a location to fly there.
                </p>
              </div>
            </div>
          </div>
        </div>
        <CloudLayers />
        <div className="divider my-1" />
        <Clouds />
      </div>
      <div className="col-span-2">
        <ArcGIS />
      </div>
    </div>
  );
};
