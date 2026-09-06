// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

type PropsT = { legend: LayerLegend };

/**
 * One layer on the About page: name, source, units, compact facts.
 */
export const LayerAbout = ({ legend }: PropsT) => (
  <section className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <h2 className="text-lg font-semibold">{legend.name}</h2>
      <span className="badge badge-sm badge-outline">{legend.source}</span>
    </div>
    <p className="text-sm">{legend.summary}</p>
    {legend.detail.map((line) => (
      <p key={line} className="text-sm">
        {line}
      </p>
    ))}
  </section>
);
