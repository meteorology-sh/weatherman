// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

type PropsT = { legend: LayerLegend };

/**
 * One layer's section on the About page: its name, its feed, the sentence the
 * panel shows, then the paragraphs the panel does not have room for.
 *
 * The summary is repeated here on purpose. A reader arriving from the switch
 * should find the same sentence at the top of the section, so the page reads as
 * the panel expanded rather than as a second, differently worded explanation.
 */
export const LayerAbout = ({ legend }: PropsT) => (
  <section className="flex flex-col gap-3">
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-lg font-semibold">{legend.name}</h2>
      <span className="badge badge-sm badge-outline">{legend.source}</span>
    </div>
    <p className="text-base font-medium">{legend.summary}</p>
    {legend.detail.map((paragraph) => (
      <p key={paragraph} className="text-sm">
        {paragraph}
      </p>
    ))}
  </section>
);
