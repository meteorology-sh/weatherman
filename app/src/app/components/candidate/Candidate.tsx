// ArcGIS
import { BAND_LABEL } from "@/lib/arcgis/bands";

// Components
import { ArcGIS } from "@/app/components/Map";
import { CandidateLayers } from "./CandidateLayers";
import { CandidateField } from "./CandidateField";
import { CloudBase } from "./CloudBase";
import { CloudHere } from "./CloudHere";
import { CloudTop } from "./CloudTop";
import { Convective } from "./Convective";
import { Liquid } from "./Liquid";
import { Sounding } from "./Sounding";
import { Radar } from "./Radar";

export const Candidate = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Candidate Clouds</h2>
          <p>
            What the sky is doing right now, and whether it is worth flying.
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
                    Read the green first. SEEDING OPPORTUNITY is every layer
                    joined, so green ground has passed every test.
                  </li>
                  <li>
                    Leave SUPERCOOLED LIQUID WATER on underneath it. Amber with
                    no green over it was rejected, and the panel below says
                    which test rejected it.
                  </li>
                  <li>
                    Switch the input layers off one at a time to see what each
                    contributes. Open “What this measures” under any of them for
                    what it is and how it is made.
                  </li>
                  <li>
                    Click the map to read that point: what every source says
                    over that cell, the altitudes to fly between, and whether
                    the {BAND_LABEL} band lies inside the cloud there.
                  </li>
                  <li>
                    Check the times under the point. Every layer is the analysis
                    hour, and the answer is only as current as its slowest
                    source.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        </div>
        <CandidateLayers />
        <div className="divider my-1" />
        {/* The clicked point first. It is the one part of this panel about the
            cloud an operator is looking at rather than about the domain. */}
        <CloudHere />
        <div className="divider my-1" />
        <Sounding />
        <div className="divider my-1" />
        <Convective />
        <div className="divider my-1" />
        <CandidateField />
        <div className="divider my-1" />
        <CloudBase />
        <div className="divider my-1" />
        <CloudTop />
        <div className="divider my-1" />
        <Liquid />
        <div className="divider my-1" />
        <Radar />
      </div>
      <div className="col-span-2">
        <ArcGIS mode="candidate" />
      </div>
    </div>
  );
};
