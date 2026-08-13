// ArcGIS
import { BAND_LABEL } from "@/lib/arcgis/renderers";

// Components
import { ArcGIS } from "./Map";
import { CandidateLayers } from "./CandidateLayers";
import { CloudBase } from "./CloudBase";
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
                <p>
                  Four layers, and they are not the same kind of claim. The grey
                  cloud tops are <em>observed</em> — a GOES-East scene from
                  minutes ago, showing where there is cloud and how cold its top
                  is, with nothing drawn where there is no cloud. Only tops at
                  −5 °C or colder appear: a warmer top means the seeding band
                  lies above the cloud entirely, so there is nothing inside it
                  to seed. The brightest grey is the shallow supercooled-topped
                  cloud worth finding; the faintest is high cirrus, which covers
                  most of the sky and is drawn quietly on purpose.
                </p>
                <p>
                  The amber contours are <em>modelled</em>: HRRR's analysis of
                  the supercooled liquid water sitting in the {BAND_LABEL} band,
                  which is the thing a satellite cannot see and the thing
                  seeding needs. Read the two together — amber with no grey
                  under it is the model claiming liquid where the satellite sees
                  no cloud at all, and that is worth distrusting.
                </p>
                <p>
                  Violet, off by default, is <em>modelled</em> too and answers
                  the question that comes before the others: how high is the
                  cloud base, and could an aircraft climb into this cloud at
                  all. Only the middle band is lit, because that is the
                  4,000–12,000 ft window Texas operations select in — below it
                  is fog and low stratus, above it is usually the base of a
                  cirrus deck with clear air underneath. Clicking the map reads
                  the base, the depth to cloud top, and whether the seeding band
                  actually lies inside the cloud over that point.
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
              </div>
            </div>
          </div>
        </div>
        <CandidateLayers />
        <div className="divider my-1" />
        <CloudBase />
        <div className="divider my-1" />
        <CloudTop />
        <div className="divider my-1" />
        <Liquid />
        <div className="divider my-1" />
        <Sounding />
        <div className="divider my-1" />
        <Convective />
        <div className="divider my-1" />
        <Radar />
      </div>
      <div className="col-span-2">
        <ArcGIS mode="candidate" />
      </div>
    </div>
  );
};
