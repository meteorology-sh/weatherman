// ArcGIS
import { ALL_LEGENDS, BASE_WINDOW_LABEL } from "@/lib/arcgis/legends";

// Components
import { LayerAbout } from "./LayerAbout";

/**
 * The feeds every layer is built from, in one sentence each, so a badge like
 * "NOAA HRRR" on a layer below has somewhere to be looked up.
 */
const SOURCES: readonly { name: string; text: string }[] = [
  {
    name: "NOAA HRRR",
    text:
      "The High-Resolution Rapid Refresh, a weather model run by the " +
      "National Oceanic and Atmospheric Administration (NOAA). It is " +
      "re-calculated every hour over the whole country in squares 3 " +
      "kilometres across, and it estimates things no instrument can see " +
      "everywhere at once — the height of a cloud's base, the temperature " +
      "at each level, how much water the cloud is holding. Everything from " +
      "this source is an estimate.",
  },
  {
    name: "NOAA MRMS",
    text:
      "The Multi-Radar/Multi-Sensor mosaic. NOAA merges the readings of " +
      "every weather radar in the country into a single picture of where " +
      "rain is falling, refreshed every two minutes in squares 1 kilometre " +
      "across. This is a measurement of real rain, not an estimate.",
  },
  {
    name: "NOAA GOES-East",
    text:
      "A NOAA weather satellite that holds a fixed position over the " +
      "Americas. It photographs the tops of clouds every few minutes, and " +
      "its Geostationary Lightning Mapper (GLM) records lightning flashes " +
      "as they happen.",
  },
];

/**
 * What every layer on the maps measures.
 */
export const About = () => (
  <div className="h-full w-full overflow-y-auto bg-black">
    <div className="mx-auto max-w-3xl px-6 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">The layers</h1>
        <p className="text-sm">
          This map is for deciding where a rain-enhancement flight over Texas
          is worth making. Green means every test passed: the bottom of the
          cloud sits {BASE_WINDOW_LABEL} above the ground, so an aircraft can
          reach it; radar shows the storm carrying rain up into air colder
          than freezing; and rain is already falling nearby.
        </p>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Where the data comes from</h2>
        {SOURCES.map((source) => (
          <div key={source.name} className="flex flex-col gap-1">
            <span className="badge badge-sm badge-outline">{source.name}</span>
            <p className="text-sm">{source.text}</p>
          </div>
        ))}
      </section>
      {ALL_LEGENDS.map((legend) => (
        <LayerAbout key={legend.name} legend={legend} />
      ))}
    </div>
  </div>
);
