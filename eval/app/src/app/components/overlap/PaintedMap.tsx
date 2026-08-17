// React
import { useEffect, useMemo, useState } from "react";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Client
import { CountiesUrl } from "~/lib/client";

// Layers
import { LAYERS } from "~/lib/layers";

// ArcGIS
import { soloColor } from "@/lib/arcgis/bands";

// Types
import type { Flare, Painted } from "~/lib/types";

/**
 * One flying day: the layers we painted at two analyses, and the flares released
 * between them.
 *
 * **Drawn in SVG rather than through ArcGIS, deliberately.** These frames are
 * already plain rings on disk — `held.mjs` fetched, windowed and rounded them —
 * so there is no layer to load, no url to repoint and no view to keep alive. The
 * product's map is the right tool for live layers over a basemap; this is a
 * fixed set of frames with points on top, and drawing it directly removes a
 * lifecycle that has nothing to manage.
 *
 * **The colours are not chosen here.** Every fill is `soloColor` over the band
 * table in `@/lib/arcgis/bands`, which is the same table the product's renderers
 * are built from, so a band that moves in Weatherman moves on this map. Levels
 * are drawn low to high and left to composite exactly as they composite there.
 *
 * **The earlier analysis is dashed and the later one solid.** They are an hour
 * apart and the weather moved in between; painting them identically would read
 * as one thicker cloud. Where the two agree the fills double and the region
 * darkens, and that darker region is the answer the page is after — liquid that
 * was there across the whole gap, so which hour a release is charged to stops
 * mattering.
 *
 * **The black arrow is what makes the two frames one picture.** It runs from the
 * release point along HRRR's own storm motion for the length of the bracket, so
 * it points from the cloud that was seeded at the first hour to where that air
 * had got to by the second. Without it a reader has to guess which blob in the
 * later frame is which blob from the earlier one.
 */

type CountyShape = { name: string; rings: [number, number][][] };

const HEIGHT = 620;
const MARGIN = 0.6;

type PropsT = { painted: Painted; interval: number };

export const PaintedMap = ({ painted, interval }: PropsT) => {
  const {
    visible,
    ends,
    drift,
    counties: showCounties,
  } = useAppSelector((state) => state.map);
  const [counties, setCounties] = useState<CountyShape[] | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const showing = painted.intervals[interval];

  /**
   * The extent, taken from the flares rather than the frames.
   *
   * A contour ring is kept whole when any of it is in the region window, so the
   * geometry reaches well past where anybody flew. Framing on the flares keeps
   * the map on the part of the day being asked about.
   */
  const window_ = useMemo(() => {
    const flares = painted.intervals.flatMap((entry) => entry.flares);
    if (!flares.length) return null;
    const lons = flares.flatMap((f) => [f.lon, f.drift?.to?.[0] ?? f.lon]);
    const lats = flares.flatMap((f) => [f.lat, f.drift?.to?.[1] ?? f.lat]);
    return {
      west: Math.min(...lons) - MARGIN,
      east: Math.max(...lons) + MARGIN,
      south: Math.min(...lats) - MARGIN,
      north: Math.max(...lats) + MARGIN,
    };
  }, [painted]);

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

  if (!window_ || !showing) return null;

  // Longitude squeezed by cos(latitude) so a county is the shape it is on the
  // ground rather than stretched sideways.
  const squeeze = Math.cos(
    ((window_.south + window_.north) / 2) * (Math.PI / 180)
  );
  const width = Math.round(
    (HEIGHT * (window_.east - window_.west) * squeeze) /
      (window_.north - window_.south)
  );
  const px = (lon: number) =>
    ((lon - window_.west) / (window_.east - window_.west)) * width;
  const py = (lat: number) =>
    ((window_.north - lat) / (window_.north - window_.south)) * HEIGHT;

  const draw = (ring: [number, number][]) =>
    `${ring
      .map(
        (p, i) =>
          `${i ? "L" : "M"}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`
      )
      .join("")}Z`;

  const inView = (ring: [number, number][]) =>
    ring.some(
      ([lon, lat]) =>
        lon >= window_.west &&
        lon <= window_.east &&
        lat >= window_.south &&
        lat <= window_.north
    );

  /** Which analyses to paint, earlier first so the later one lands on top. */
  const hours: string[] =
    ends === "from"
      ? [showing.from]
      : ends === "to"
        ? [showing.to]
        : [showing.from, showing.to];

  const held: Record<string, string> = {
    held: "fill-success",
    flipped: "fill-warning",
    absent: "fill-error",
  };

  const hovered: Flare | undefined = showing.flares.find((f) => f.at === hover);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto bg-black">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={
            `Modelled and observed layers at ${showing.from} and ${showing.to}, ` +
            `with flare release points and storm motion`
          }
        >
          <defs>
            {/* One arrowhead, reused. Black so it reads over every band. */}
            <marker
              id="drift-head"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="black" />
            </marker>
          </defs>

          {showCounties &&
            counties?.map((county) =>
              county.rings
                .filter(inView)
                .map((ring, index) => (
                  <path
                    key={`${county.name}-${index}`}
                    d={draw(ring)}
                    className="fill-none stroke-base-content/30"
                    strokeWidth={0.7}
                  />
                ))
            )}

          {/*
           * The layers, in the order the replay map stacks them, each analysis
           * in turn. A layer's levels are drawn low to high so the fills
           * composite the way ArcGIS composites them.
           */}
          {hours.map((hour, order) =>
            LAYERS.filter((layer) => visible[layer.key]).map((layer) => {
              const frame = painted.frames[hour]?.[layer.key];
              if (!frame || frame.error) return null;
              return frame.levels.map((level) => {
                const band = layer.bands.find((b) => b.value === level.level);
                if (!band) return null;
                const earlier = hours.length > 1 && order === 0;
                return level.polygons.map((polygon, index) => (
                  <path
                    key={`${hour}-${layer.key}-${level.level}-${index}`}
                    d={polygon.map(draw).join(" ")}
                    fillRule="evenodd"
                    fill={soloColor(layer.rgb, band.alpha)}
                    stroke={soloColor(layer.rgb, 0.85)}
                    strokeWidth={earlier ? 0.7 : 1.1}
                    strokeDasharray={earlier ? "3 3" : undefined}
                  />
                ));
              });
            })
          )}

          {/*
           * Where the air over each release point had gone by the second
           * analysis. Drawn under the flare markers so a short arrow is not
           * hidden by the dot it starts from.
           */}
          {drift &&
            showing.flares.map((flare) =>
              flare.drift?.to ? (
                <line
                  key={`drift-${flare.at}`}
                  x1={px(flare.lon)}
                  y1={py(flare.lat)}
                  x2={px(flare.drift.to[0])}
                  y2={py(flare.drift.to[1])}
                  stroke="black"
                  strokeWidth={1.4}
                  markerEnd="url(#drift-head)"
                  opacity={hover && hover !== flare.at ? 0.35 : 0.9}
                />
              ) : null
            )}

          {showing.flares.map((flare) => (
            <g
              key={flare.at}
              onMouseEnter={() => setHover(flare.at)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                cx={px(flare.lon)}
                cy={py(flare.lat)}
                r={hover === flare.at ? 13 : 10}
                className={`fill-none ${
                  held[flare.held?.liquid ?? ""]?.replace("fill", "stroke") ??
                  "stroke-base-content"
                }`}
                strokeWidth={1.3}
                opacity={0.6}
              />
              <circle
                cx={px(flare.lon)}
                cy={py(flare.lat)}
                r={5.5}
                className={
                  held[flare.held?.liquid ?? ""] ?? "fill-base-content"
                }
                stroke="black"
                strokeWidth={1.5}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="text-xs font-mono min-h-[3rem] bg-base-200 p-2">
        {hovered ? (
          <>
            {hovered.timeZ}Z · {hovered.county} County · {hovered.plane} ·{" "}
            {hovered.payload}
            <br />
            liquid {hovered.held?.liquid ?? "—"} · before the rain veto{" "}
            {hovered.held?.cloudReady ?? "—"} · every test{" "}
            {hovered.held?.candidate ?? "—"}
            {hovered.drift?.stormMotionKt != null && (
              <>
                {" "}
                · drifting {hovered.drift.stormMotionKt} kt toward{" "}
                {hovered.drift.stormMotionTowardDeg}°
              </>
            )}
          </>
        ) : (
          <span className="opacity-70">
            Hover a flare for what we had painted under it, and where that air
            went.
          </span>
        )}
      </div>
    </div>
  );
};
