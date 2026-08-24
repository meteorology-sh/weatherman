// ArcGIS
import { ALL_LEGENDS } from "@/lib/arcgis/legends";

// Components
import { LayerAbout } from "./LayerAbout";

/**
 * What every layer on the maps measures, how it is made, and what it does not
 * tell you.
 *
 * The panel gives a layer one sentence, which is all a switch has room for.
 * This is where the rest lives, so the sidebar can stay a list of ramps.
 */
export const About = () => (
  <div className="h-full w-full overflow-y-auto bg-black">
    <div className="mx-auto max-w-3xl px-6 py-10 flex flex-col gap-10">
      <header className="flex flex-col gap-3">
        <h1 className="text-2xl font-semibold">The layers</h1>
        <p className="text-sm">
          Weatherman looks for cloud worth seeding: cloud holding liquid water
          colder than freezing, cold enough at the top to be worth flying, low
          enough at the base to reach, and not already raining itself out. Each
          layer below answers one of those questions, and the seeding layer is
          where all four agree.
        </p>
      </header>
      {ALL_LEGENDS.map((legend) => (
        <LayerAbout key={legend.name} legend={legend} />
      ))}
    </div>
  </div>
);
