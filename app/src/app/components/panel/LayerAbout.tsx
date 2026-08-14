// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

type PropsT = { legend: LayerLegend };

/**
 * What a layer measures, how it is made, and what it does not tell you —
 * collapsed until asked for.
 *
 * The panel is a stack of layers and every one of them needs this much prose.
 * Printed under the switches it buried the ramps, which are the part an
 * operator reads every time; behind a collapse the switches stay a list and
 * the explanation is one click away.
 */
export const LayerAbout = ({ legend }: PropsT) => (
  <div className="collapse collapse-arrow bg-base-200 border-base-300 border">
    <input type="checkbox" aria-label={`About ${legend.name}`} />
    <div className="collapse-title text-xs font-semibold">
      What this measures
    </div>
    <div className="collapse-content flex flex-col gap-2 text-xs">
      <div>{legend.about}</div>
      <div>{legend.caveat}</div>
      <div>Source: {legend.source}</div>
    </div>
  </div>
);
