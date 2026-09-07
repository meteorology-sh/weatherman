// ArcGIS
import { ALL_LEGENDS, FLIGHT_WINDOW_LABEL } from "@/lib/arcgis/legends";

// Components
import { LayerAbout } from "./LayerAbout";

/**
 * The feeds every layer is built from, in one sentence each. The names match
 * the badges on the layers below, so a badge has somewhere to be looked up.
 */
const SOURCES: readonly { name: string; text: string }[] = [
  {
    name: "HRRR",
    text: `The High-Resolution Rapid Refresh, a weather model run by the National Oceanic and Atmospheric Administration (NOAA). It runs every hour over the whole country at 3 km resolution and estimates cloud base, the temperature at each level, and how much water a cloud holds. Every value from this source is modeled.`,
  },
  {
    name: "MRMS",
    text: `The Multi-Radar/Multi-Sensor mosaic. NOAA merges the readings of every weather radar in the country into a single picture of where rain is falling, refreshed every two minutes at 1 km resolution. Every value from this source is measured.`,
  },
  {
    name: "GOES-East",
    text: `A NOAA weather satellite in geostationary orbit over the Americas. It images cloud tops every few minutes, and its Geostationary Lightning Mapper (GLM) records lightning flashes as they occur.`,
  },
];

/**
 * What a click reports, and where it is approximate.
 *
 * FLY is exact: it is the cell being green. Every other figure on the click
 * panel is worked out a different way from the layer it sits next to, so
 * this section says how, and what each shortcut costs. Last on the page
 * because it is read after the layers, not instead of them.
 */
const APPROXIMATIONS: readonly { name: string; text: string }[] = [
  {
    name: "The point",
    text: `A click is rounded to about 100 m and answered from the model cell that contains it. That cell is 3 km across, so the figures describe the neighborhood rather than the exact spot.`,
  },
  {
    name: "The storm",
    text: `The panel gives the distance from the click to the nearest edge of the storm outline drawn on the map, and says whether the click is inside that outline or outside it. The outline is the 20 dBZ boundary the radar layer fills, traced over radar cells averaged to about 4 km, so the edge is placed to within about that distance.`,
  },
  {
    name: "Echo top",
    text: `The measured 18 dBZ echo top is reported where radar has one. Where it does not, the model's estimate is reported in its place, and the panel does not mark which of the two you are reading.`,
  },
  {
    name: "Cloud top and lightning",
    text: `Both are read over the whole storm rather than at the point clicked, so they describe the cell you are looking at and not the square meter under the cursor.`,
  },
  {
    name: "Nearest storm",
    text: `A click outside the rain is answered with the nearest storm within 40 km, measured to its rain rather than to its center. Past 40 km no storm is reported.`,
  },
  {
    name: "Estimates against measurements",
    text: `Cloud base, freezing level, CAPE, CIN, LCL and liquid water are model estimates. Reflectivity, echo top and lightning flashes are measurements. A cell can be green because the model is wrong.`,
  },
];

/**
 * What every layer on the maps measures.
 */
export const About = () => (
  <div className="h-full w-full overflow-y-auto bg-black">
    <div className="mx-auto max-w-3xl px-6 py-10 flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold">The Layers</h1>
        <p className="text-sm">
          Weatherman is a decision science platform for rain-enhancement flight
          operations over Texas. A marked candidate is any cloud formation where
          three tests pass: cloud base {FLIGHT_WINDOW_LABEL} above the ground;
          an 18 dBZ radar echo top at or above freezing; and adjacent to nearby
          rainfall.
        </p>
      </header>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Weatherman Data Sources</h2>
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
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">What a Click Reports</h2>
        <p className="text-sm">
          FLY means the cell you clicked is green: the three tests above passed
          there. DON&apos;T FLY means at least one of them failed. Nothing else
          is being decided.
        </p>
        <p className="text-sm">
          The other figures on the click panel are close approximations. Each
          one is listed here with what it costs.
        </p>
        {APPROXIMATIONS.map((item) => (
          <div key={item.name} className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{item.name}</span>
            <p className="text-sm">{item.text}</p>
          </div>
        ))}
      </section>
    </div>
  </div>
);
