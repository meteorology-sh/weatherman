// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

type PropsT = { legend: LayerLegend };

/**
 * What a layer gives you, in one sentence, collapsed until asked for.
 *
 * The panel is a stack of layers and the ramps are the part read every time, so
 * this stays behind a collapse and stays short. Anything longer than a sentence
 * — how a layer is built, what it cannot tell you — belongs on the About page,
 * which reads the same legend.
 */
export const LayerDefinitions = ({ legend }: PropsT) => (
  <div className="collapse collapse-arrow bg-base-200 border-base-300 border">
    <input type="checkbox" aria-label={`About ${legend.name}`} />
    <div className="collapse-title text-xs font-semibold">Definitions</div>
    <div className="collapse-content flex flex-col gap-2 text-xs">
      <div>{legend.summary}</div>
      <div>Source: {legend.source}</div>
    </div>
  </div>
);
