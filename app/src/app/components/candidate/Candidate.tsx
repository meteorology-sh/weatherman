// Components
import { ArcGIS } from "@/app/components/Map";
import { CandidateLayers } from "./CandidateLayers";
import { ClickedPoint } from "./ClickedPoint";

export const Candidate = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Candidates</h2>
        </div>
        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <ul>
                  <li>Click the green fill.</li>
                  <li>
                    FLY: 4,000–12,000 ft AGL, 18 dBZ echo top past freezing,
                    rain nearby.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col divide-y divide-base-300 [&>*]:py-4">
          <CandidateLayers />
          <ClickedPoint />
        </div>
      </div>
      <div className="col-span-2">
        <ArcGIS mode="candidate" />
      </div>
    </div>
  );
};
