// React
import { useEffect, useMemo, useState } from "react";

// Client
import { CountiesUrl } from "~/lib/client";

// Types
import type { Painted } from "~/lib/types";

/**
 * The liquid we painted at two analyses, with the flares released between them.
 *
 * **Drawn in SVG rather than through ArcGIS, deliberately.** These frames are
 * already plain rings on disk — `held.mjs` fetched, windowed and rounded them —
 * so there is no layer to load, no url to repoint and no view to keep alive.
 * The product's map is the right tool for live layers over a basemap; this is a
 * fixed pair of frames with points on top, and drawing it directly removes a
 * lifecycle that has nothing to manage.
 *
 * The two washes are translucent, so the area painted at **both** hours
 * composites to the darkest blue on the map. That darkest area is the held
 * region, and nothing else on the page is drawn in it.
 */

type CountyShape = { name: string; rings: [number, number][][] };

const HEIGHT = 520;
const MARGIN = 0.55;

type PropsT = { painted: Painted; interval: number };

export const PaintedMap = ({ painted, interval }: PropsT) => {
  const [counties, setCounties] = useState<CountyShape[] | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const window_ = useMemo(() => {
    const flares = painted.intervals.flatMap((entry) => entry.flares);
    if (!flares.length) return null;
    return {
      west: Math.min(...flares.map((f) => f.lon)) - MARGIN,
      east: Math.max(...flares.map((f) => f.lon)) + MARGIN,
      south: Math.min(...flares.map((f) => f.lat)) - MARGIN,
      north: Math.max(...flares.map((f) => f.lat)) + MARGIN,
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

  if (!window_) return null;

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
    `${ring.map((p, i) => `${i ? "L" : "M"}${px(p[0]).toFixed(1)} ${py(p[1]).toFixed(1)}`).join("")}Z`;

  const showing = painted.intervals[interval];
  if (!showing) return null;

  const inView = (ring: [number, number][]) =>
    ring.some(
      ([lon, lat]) =>
        lon >= window_.west &&
        lon <= window_.east &&
        lat >= window_.south &&
        lat <= window_.north
    );

  const tone = ["fill-info/25", "fill-info/45"];
  const held: Record<string, string> = {
    held: "fill-success",
    flipped: "fill-warning",
    absent: "fill-error",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label="Modelled liquid at two analysis hours with flare release points"
        >
          {counties?.map((county) =>
            county.rings
              .filter(inView)
              .map((ring, index) => (
                <path
                  key={`${county.name}-${index}`}
                  d={draw(ring)}
                  className="fill-none stroke-base-content/25"
                  strokeWidth={0.8}
                />
              ))
          )}

          {[showing.from, showing.to].map((hour, order) => {
            const frame = painted.frames[hour];
            // The outermost contour only: this asks whether there was liquid at
            // all, which is the question the release table answers.
            const outer = frame?.levels[0];
            if (!outer) return null;
            return outer.polygons.map((polygon, index) => (
              <path
                key={`${hour}-${index}`}
                d={polygon.map(draw).join(" ")}
                fillRule="evenodd"
                className={`${tone[order]} stroke-info`}
                strokeWidth={order ? 1.3 : 0.6}
                strokeOpacity={order ? 0.9 : 0.4}
              />
            ));
          })}

          {showing.flares.map((flare) => (
            <g
              key={flare.at}
              onMouseEnter={() => setHover(flare.at)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                cx={px(flare.lon)}
                cy={py(flare.lat)}
                r={hover === flare.at ? 12 : 10}
                className={`fill-none ${
                  held[flare.held?.liquid ?? ""]?.replace("fill", "stroke") ??
                  "stroke-base-content"
                }`}
                strokeWidth={1.2}
                opacity={0.55}
              />
              <circle
                cx={px(flare.lon)}
                cy={py(flare.lat)}
                r={5.5}
                className={
                  held[flare.held?.liquid ?? ""] ?? "fill-base-content"
                }
                stroke="black"
                strokeWidth={1.4}
              />
            </g>
          ))}
        </svg>
      </div>

      <div className="text-xs font-mono min-h-[2.5rem] bg-base-200 p-2">
        {(() => {
          const flare = showing.flares.find((f) => f.at === hover);
          if (!flare) {
            return (
              <span className="opacity-70">
                Hover a flare for what we had painted under it.
              </span>
            );
          }
          return (
            <>
              {flare.timeZ}Z {flare.county} · {flare.plane} · {flare.payload} —
              liquid {flare.held?.liquid ?? "—"} · before rain{" "}
              {flare.held?.cloudReady ?? "—"} · full join{" "}
              {flare.held?.candidate ?? "—"}
            </>
          );
        })()}
      </div>
    </div>
  );
};
