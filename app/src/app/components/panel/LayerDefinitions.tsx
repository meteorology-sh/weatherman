// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

type PropsT = { legend: LayerLegend };

/**
 * Units, source, and the compact facts for this layer.
 */
export const LayerDefinitions = ({ legend }: PropsT) => (
  <div className="collapse collapse-arrow bg-base-200 border-base-300 border">
    <input type="checkbox" aria-label={`About ${legend.name}`} />
    <div className="collapse-title text-xs font-semibold">Definitions</div>
    <div className="collapse-content flex flex-col gap-1 text-xs">
      <div>{legend.summary}</div>
      <div>{legend.source}</div>
      {legend.detail.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  </div>
);
