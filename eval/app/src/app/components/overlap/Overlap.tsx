// React
import { useEffect, useMemo, useState } from "react";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Client
import { CountiesUrl } from "~/lib/client";

// Components
import { Status } from "../Status";
import { Section } from "../Section";
import { DayPicker } from "./DayPicker";
import { LayerPanel } from "./LayerPanel";
import { PaintedMap } from "./PaintedMap";
import { Proximity } from "./Proximity";
import { TONES } from "./distance";

type CountyShape = { name: string; rings: [number, number][][] };

const hhmm = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;

/** A little room around the day's releases, so nothing sits on the edge. */
const MARGIN = 0.6;

/**
 * Do operators seed near what we paint?
 *
 * **A distance question, not a containment one.** Whether a flare landed inside
 * a contour is one bit, and it cannot tell a map that is slightly wrong from a
 * map that is looking at the wrong weather. How far it was can.
 *
 * **Nothing has to be selected to read the answer.** Each release is compared
 * against the analysis nearest its own minute, so the choice is made by the
 * clock rather than by the reader, and every analysis the day used is drawn —
 * one map each, on a shared extent so they can be read against each other.
 */
export const Overlap = () => {
  const { date, day, painted, loading, missing, error } = useAppSelector(
    (state) => state.day
  );
  const [counties, setCounties] = useState<CountyShape[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch(CountiesUrl());
      if (!res.ok) return;
      const collection = await res.json();
      setCounties(
        collection.features.map((feature: never) => {
          const f = feature as {
            properties: { BASENAME: string };
            geometry: {
              type: string;
              coordinates: number[][][] | number[][][][];
            };
          };
          const polygons =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates as number[][][]]
              : (f.geometry.coordinates as number[][][][]);
          return {
            name: f.properties.BASENAME,
            rings: polygons.flat() as [number, number][][],
          };
        })
      );
    }
    if (!counties) load();
  }, [counties]);

  /**
   * One extent for every map on the page.
   *
   * Framed on the releases rather than on the contours: a ring is kept whole
   * when any of it is in the region window, so the geometry reaches well past
   * where anybody flew. Sharing it across the analyses is what lets two maps be
   * compared — a frame that refit itself each hour would move the ground under
   * the reader.
   */
  const extent = useMemo(() => {
    if (!painted) return null;
    const flares = painted.analyses.flatMap((entry) => entry.flares);
    if (!flares.length) return null;
    const lons = flares.flatMap((f) => [f.lon, f.compared[0]]);
    const lats = flares.flatMap((f) => [f.lat, f.compared[1]]);
    return {
      west: Math.min(...lons) - MARGIN,
      east: Math.max(...lons) + MARGIN,
      south: Math.min(...lats) - MARGIN,
      north: Math.max(...lats) + MARGIN,
    };
  }, [painted]);

  return (
    <div className="h-full flex">
      <aside className="w-80 shrink-0 border-r border-base-300 overflow-y-auto">
        <LayerPanel />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6 max-w-5xl">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">
              Do operators seed near what we paint?
            </h1>
            <p className="text-sm max-w-2xl">
              Every layer below is the one Weatherman itself draws, fetched from
              the product's own server. Each flare is measured to the nearest
              edge of the painted region — inside is zero. Either the map is
              wrong and the operators are working from something we do not have,
              or the map is right and they are not flying where it says. The
              distance is what tells those apart.
            </p>
          </div>

          <Section
            heading="The day"
            subtitle="Painting a day means building every layer at every analysis its flares are charged to, so only days that have been built can be opened."
          >
            <DayPicker />
          </Section>

          {date && (
            <>
              <Status
                loading={loading}
                missing={missing}
                error={error}
                what="Reading the day"
              />

              {painted && extent && (
                <>
                  <Section
                    heading="How near they were"
                    subtitle="Distance from each release to the nearest edge of the painted region. A cell is 12 km — the grid every layer is contoured on — so anything inside one cell is inside the paint as far as this map can resolve."
                  >
                    <Proximity painted={painted} />
                  </Section>

                  <Section
                    heading="Where they were"
                    subtitle="One map per analysis, on the same extent. A release is charged to the analysis nearest its own minute, and the white line carries it the remaining minutes along the storm motion — so the dot sits where that air is at the moment of the frame under it."
                  >
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs items-center pb-1">
                      {TONES.map((tone) => (
                        <span
                          key={tone.label}
                          className="flex items-center gap-2"
                        >
                          <span
                            className={`inline-block w-3 h-3 rounded-full ${tone.fill.replace(
                              "fill-",
                              "bg-"
                            )}`}
                          />
                          {tone.label}
                        </span>
                      ))}
                      <span className="flex items-center gap-2">
                        <svg width="26" height="10" aria-hidden="true">
                          <line
                            x1="1"
                            y1="5"
                            x2="20"
                            y2="5"
                            stroke="white"
                            strokeWidth="1.6"
                          />
                          <path d="M20 1 L26 5 L20 9 z" fill="white" />
                        </svg>
                        Carried to the analysis time
                      </span>
                    </div>

                    <div className="flex flex-col gap-6">
                      {painted.analyses.map((analysis) => (
                        <div key={analysis.at} className="flex flex-col gap-2">
                          <div className="flex items-baseline gap-3">
                            <h3 className="font-mono text-sm font-semibold">
                              {hhmm(analysis.at)}
                            </h3>
                            <span className="text-xs">
                              {analysis.flares.length}{" "}
                              {analysis.flares.length === 1
                                ? "release"
                                : "releases"}{" "}
                              charged to this analysis
                            </span>
                          </div>
                          <PaintedMap
                            painted={painted}
                            analysis={analysis}
                            extent={extent}
                            counties={counties}
                          />
                        </div>
                      ))}
                    </div>
                  </Section>

                  <Section
                    heading="What this cannot show you"
                    subtitle="Limits of the picture above, so it is not read for more than it says."
                  >
                    <ul className="text-sm list-disc pl-5 flex flex-col gap-1">
                      <li>
                        A distance of zero means the release was inside the
                        outermost contour, which is 10 g/m² — enough liquid to
                        draw, not enough to call a target.
                      </li>
                      <li>
                        The white line carries one storm-motion reading at
                        constant speed and bearing. Over twenty-odd minutes that
                        is a small error, but it is an error.
                      </li>
                      <li>
                        Nothing here is an outcome. It says where the operator
                        flew against where we painted, not whether the seeding
                        worked, and not which of the two is right.
                      </li>
                    </ul>
                  </Section>
                </>
              )}

              {day && day.unlocated.length > 0 && (
                <p className="text-xs">
                  {day.unlocated.length} more releases are logged this day
                  without a position, so they cannot be placed or measured.
                </p>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
};
