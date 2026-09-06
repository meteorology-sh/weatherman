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
                <p>
                  Green marks the places worth flying to. Click one for the
                  numbers behind the call.
                </p>
                <p>Green means all three of these are true at once:</p>
                <ul>
                  <li>
                    The bottom of the cloud is 4,000–12,000 ft above the
                    ground, so an aircraft can reach it.
                  </li>
                  <li>
                    Radar nearby is seeing rain lifted high enough to be
                    colder than freezing.
                  </li>
                  <li>Rain is already falling nearby.</li>
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
