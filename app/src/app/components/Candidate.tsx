// ArcGIS
import { BAND_LABEL } from "@/lib/arcgis/renderers";

// Components
import { ArcGIS } from "./Map";
import { CandidateLayers } from "./CandidateLayers";
import { Liquid } from "./Liquid";
import { Sounding } from "./Sounding";
import { Radar } from "./Radar";
import { Pireps } from "./Pireps";

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
                <p>
                  Four layers, and they are not the same kind of claim.
                  GOES-East Band 13 is <em>observed</em> — real infrared,
                  refreshed every 10 minutes at ~2 km, showing where cloud is
                  and how cold its top is. The amber contours are{" "}
                  <em>modelled</em>: HRRR's analysis of the supercooled liquid
                  water sitting in the {BAND_LABEL} band, which is the thing a
                  satellite cannot see and the thing seeding needs. Cold tops
                  with no amber under them are glaciated already — nothing left
                  to freeze.
                </p>
                <p>
                  Cyan is the disqualifier, and the only <em>measured</em>
                  thing here: the MRMS radar mosaic, contoured the same way, at
                  the reflectivity a rain gauge would agree with. A candidate
                  with cyan through it is already converting its water to
                  precipitation without help. Radar only sees what is falling,
                  though, so quiet air over a cloud says nothing about what is
                  inside it.
                </p>
                <p>
                  The violet markers are the third kind of claim:{" "}
                  <em>reported</em>. Each is an aircraft that flew through a
                  point and told air traffic control what it found — rime ice is
                  supercooled liquid freezing on the airframe, so a positive
                  report is the one direct observation of the target on this
                  map. A handful arrive a day, only along airways, so read them
                  as spot-checks on the model rather than as a layer of their
                  own.
                </p>
              </div>
            </div>
          </div>
        </div>
        <CandidateLayers />
        <div className="divider my-1" />
        <Liquid />
        <div className="divider my-1" />
        <Sounding />
        <div className="divider my-1" />
        <Radar />
        <div className="divider my-1" />
        <Pireps />
      </div>
      <div className="col-span-2">
        <ArcGIS mode="candidate" />
      </div>
    </div>
  );
};
