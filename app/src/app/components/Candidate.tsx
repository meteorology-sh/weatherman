// Components
import { ArcGIS } from "./Map";
import { CandidateLayers } from "./CandidateLayers";
import { Liquid } from "./Liquid";

export const Candidate = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Candidate Clouds</h2>
          <p>What the sky is doing right now, and whether it is worth flying.</p>
        </div>
        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <p>
                  Two layers answering two halves of one question. GOES-East
                  Band 13 is <em>observed</em> — real infrared, refreshed every
                  10 minutes at ~2 km, showing where cloud is and how cold its
                  top is. The amber contours are <em>modelled</em>: HRRR's
                  analysis of the supercooled liquid water sitting in the −5 to
                  −12 °C band, which is the thing a satellite cannot see and the
                  thing seeding needs. Cold tops with no amber under them are
                  glaciated already — nothing left to freeze.
                </p>
              </div>
            </div>
          </div>
        </div>
        <CandidateLayers />
        <div className="divider my-1" />
        <Liquid />
      </div>
      <div className="col-span-2">
        <ArcGIS mode="candidate" />
      </div>
    </div>
  );
};
