// ArcGIS
import { ALL_LEGENDS } from "@/lib/arcgis/legends";

// Components
import { LayerAbout } from "./LayerAbout";

/**
 * What every layer on the maps measures.
 */
export const About = () => (
  <div className="h-full w-full overflow-y-auto bg-black">
    <div className="mx-auto max-w-3xl px-6 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">The layers</h1>
        <p className="text-sm">
          Texas rain-enhancement overlay. Green fill is FLY: base
          4,000–12,000 ft AGL, 18 dBZ echo top past freezing, rain nearby.
        </p>
      </header>
      {ALL_LEGENDS.map((legend) => (
        <LayerAbout key={legend.name} legend={legend} />
      ))}
    </div>
  </div>
);
