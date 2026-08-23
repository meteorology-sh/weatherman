// React
import { useCallback, useEffect, useMemo, useState } from "react";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Client
import { CountiesUrl } from "~/lib/client";

// Components
import { Status } from "../Status";
import { Section } from "../Section";
import { DayPicker } from "./DayPicker";
import { FlareDistances } from "./FlareDistances";
import { LayerCoverage } from "./LayerCoverage";
import { LayerPanel } from "./LayerPanel";
import { PaintedMap } from "./PaintedMap";

// Layout
import { fitExtent } from "./fit";
import { labelPoint } from "./label";

type CountyShape = {
  name: string;
  rings: [number, number][][];
  /** Where to write the name — the interior point farthest from any edge. */
  label: [number, number];
};

const hhmm = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;

/** A little room around the day's releases, so nothing sits on the edge. */
const MARGIN = 0.6;

/**
 * How tall a map may get, in pixels.
 *
 * The floor keeps a wide, shallow day from becoming a letterbox strip; the
 * ceiling keeps a tall, narrow one from running off the bottom of the screen.
 * Between them the map takes the full width it is given.
 */
const MIN_HEIGHT = 380;
const MAX_HEIGHT = 640;

/**
 * Do operators seed near what we paint?
 *
 * **Counts first, then how far, then where.** Whether a flare landed inside a
 * contour is one bit; how many did, per layer, is the picture that a few
 * releases in a raining cell ten cells away cannot steal. Distance still
 * matters — a flare can sit in painted liquid and miss the join — so each
 * release is listed against every layer. The maps show the two cells.
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
  const { near, loading: findingsLoading } = useAppSelector(
    (state) => state.findings
  );
  const [counties, setCounties] = useState<CountyShape[] | null>(null);
  const [available, setAvailable] = useState(0);

  /**
   * The width the maps have to fill.
   *
   * Measured rather than assumed: the panel is fixed but the window is not, and
   * a map sized from a guess is either short of the edge or scrolling past it.
   * A callback ref with a cleanup — React 19 runs it on detach — so the observer
   * does not outlive the node.
   */
  const measure = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    setAvailable(node.clientWidth);
    const observer = new ResizeObserver(([entry]) =>
      setAvailable(entry.contentRect.width)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

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
          const rings = polygons.flat() as [number, number][][];
          return {
            name: f.properties.BASENAME,
            rings,
            label: labelPoint(rings),
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

  /** The same box for every analysis, so the maps can be read against each other. */
  const fitted = useMemo(
    () =>
      extent && available
        ? fitExtent(extent, available, MIN_HEIGHT, MAX_HEIGHT)
        : null,
    [extent, available]
  );

  return (
    <div className="h-full flex">
      <aside className="w-80 shrink-0 border-r border-base-300 overflow-y-auto">
        <LayerPanel />
      </aside>

      <main className="flex-1 overflow-y-auto">
        <div className="p-6 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">
              Do operators seed near what we paint?
            </h1>
            <p className="text-sm max-w-2xl">
              Every layer below is the one Weatherman itself draws. Each release
              is scored against all of them: whether it sat inside the paint,
              and how far it was if it did not. A flare can sit in cloud, echo
              and liquid and still miss the join — rain rules that out, and they
              fly into rain on purpose. The bars count how often; the table says
              how close; the maps show where.
            </p>
          </div>

          <Section
            heading="The day"
            subtitle="Switch days from the picker in the bar above. Painting a day means building every layer at every analysis its flares are charged to, so only days that have been built can be opened."
          >
            <DayPicker />
          </Section>

          {findingsLoading && !near ? (
            <Status
              loading
              missing={null}
              error={null}
              what="Reading the season"
            />
          ) : (
            near && (
              <Section
                heading="The season"
                subtitle={`${near.flares} releases over ${near.days} of ${near.flying} flying days. Inside is overlap. The second segment is within one ${near.cellKm} km cell — as fine as the grid can tell. Median is how far a typical release sat from that layer.`}
              >
                <LayerCoverage cellKm={near.cellKm} layers={near.layers} />
              </Section>
            )
          )}

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
                    heading="This day"
                    subtitle={`${painted.proximity.flares} releases on the maps below. The same count, and the typical miss, for this day alone.`}
                  >
                    <LayerCoverage
                      cellKm={painted.proximity.cellKm}
                      layers={painted.proximity.layers}
                    />
                  </Section>

                  <Section
                    heading="How close each release was"
                    subtitle="Inside means the flare sat in that layer. A number is kilometres to the nearest edge, after drifting the remaining minutes to the analysis. A flare can sit in painted liquid and still be cells away from the join."
                  >
                    <FlareDistances
                      flares={painted.analyses.flatMap(
                        (analysis) => analysis.flares
                      )}
                      cellKm={painted.proximity.cellKm}
                    />
                  </Section>

                  <Section
                    heading="Where they were"
                    subtitle="One map per analysis, on the same extent. The dot is where a flare was released; the arrow carries it the remaining minutes along the storm motion to the moment of the frame under it, which is where every distance is measured."
                  >
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-xs items-center pb-1">
                      <span className="flex items-center gap-2">
                        <svg width="14" height="14" aria-hidden="true">
                          <circle
                            cx="7"
                            cy="7"
                            r="5"
                            fill="white"
                            stroke="black"
                            strokeWidth="1.2"
                          />
                        </svg>
                        Where a flare was released
                      </span>
                      <span className="flex items-center gap-2">
                        <svg width="30" height="12" aria-hidden="true">
                          <line
                            x1="1"
                            y1="6"
                            x2="20"
                            y2="6"
                            stroke="white"
                            strokeWidth="1.6"
                          />
                          <path d="M19 1 L29 6 L19 11 z" fill="white" />
                        </svg>
                        Storm motion at that release, over the minutes to the
                        analysis — distances measured at the head
                      </span>
                      <span className="opacity-80">
                        Hover a release for its distance to every layer.
                      </span>
                    </div>

                    <div className="flex flex-col gap-6" ref={measure}>
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
                            fitted={fitted}
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
