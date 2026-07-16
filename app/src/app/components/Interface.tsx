// Components
import { ArcGIS } from "./Map";
import { Clouds } from "./Clouds";

export const Interface = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>National Cloud Cover</h2>
          <p>Current cloud cover across the continental U.S.</p>
        </div>
        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <p>
                  Each circle is a sample point on a national grid: larger and
                  brighter means more cloud cover. Click a point on the map for
                  details, or click a location in the list to fly there.
                </p>
              </div>
            </div>
          </div>
        </div>
        <Clouds />
      </div>
      <div className="col-span-2">
        <ArcGIS />
      </div>
    </div>
  );
};
