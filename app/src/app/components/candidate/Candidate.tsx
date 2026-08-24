// ArcGIS
import { BAND_LABEL } from "@/lib/arcgis/bands";

// Components
import { ArcGIS } from "@/app/components/Map";
import { CandidateLayers } from "./CandidateLayers";
import { ClickedPoint } from "./ClickedPoint";

export const Candidate = () => {
  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Candidate Clouds</h2>
          <p>
            What the sky is doing right now, and whether to fly.
          </p>
        </div>
        <div className="py-2">
          <div className="collapse bg-base-200 border-base-300 border">
            <input type="checkbox" />
            <div className="collapse-title font-semibold">Instructions</div>
            <div className="collapse-content text-sm">
              <div className="prose">
                <ul>
                  <li>
                    Switch the input layers on/off one at a time to see what each
                    contributes. Check the definitions dropdown for more information on each layer.
                  </li>
                  <li>
                    Click the map to read data that point.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
        {/* One rule between sections, drawn by the container rather than
            written between them. Most of this panel is conditional — a layer
            switched off says nothing, and neither does the clicked point before
            anything is clicked — and a border on an element that was never
            rendered cannot be left behind as a stack of empty rules.

            The panel is the switches and the clicked point, and nothing else.
            An operator flies one cloud, so a figure about the whole grid — how
            much ground in the country passed, how much cloud the satellite sees
            anywhere — answers a question nobody on this page is asking. Those
            summaries are still built, and the replay panel reports them, where
            the question really is what a whole hour looked like. */}
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
