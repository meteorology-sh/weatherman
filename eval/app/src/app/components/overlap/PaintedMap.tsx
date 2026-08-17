// React
import { useState } from "react";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Layers
import { LAYERS } from "~/lib/layers";

// ArcGIS
import { soloColor } from "@/lib/arcgis/bands";

// Types
import type { Analysis, Flare, Painted } from "~/lib/types";

/**
 * One analysis hour: the layers we painted, and the flares charged to it.
 *
 * **Drawn in SVG rather than through ArcGIS, deliberately.** These frames are
 * already plain rings on disk — `held.mjs` fetched, windowed and rounded them —
 * so there is no layer to load, no url to repoint and no view to keep alive. The
 * product's map is the right tool for live layers over a basemap; this is a
 * fixed frame with points on top, and drawing it directly removes a lifecycle
 * that has nothing to manage.
 *
 * **The colours are not chosen here.** Every fill is `soloColor` over the band
 * table in `@/lib/arcgis/bands`, which is the same table the product's renderers
 * are built from, so a band that moves in Weatherman moves on this map. Levels
 * are drawn low to high and left to composite exactly as they composite there.
 *
 * **The releases carry no verdict in their colour.** They are white dots: what
 * the operator did, stated as a fact and left alone. Colouring them by distance
 * put our answer on top of their record and competed with the very bands being
 * judged, which is the wrong way round for a page asking whether the bands are
 * right. Every layer's distance is in the readout instead.
 *
 * **The white arrow is the clock, drawn.** A release at 1843Z is being compared
 * against a 19Z field, seventeen minutes later, and at twenty knots the air has
 * moved ten kilometres in between — most of a grid cell. It runs from where the
 * flare was dropped to where that air is at the moment of the frame underneath,
 * and the arrowhead is where every distance is measured from.
 */

type CountyShape = { name: string; rings: [number, number][][] };
type Extent = { west: number; east: number; south: number; north: number };

const HEIGHT = 460;

type PropsT = {
  painted: Painted;
  analysis: Analysis;
  extent: Extent;
  counties: CountyShape[] | null;
};

export const PaintedMap = ({ painted, analysis, extent, counties }: PropsT) => {
  const {
    visible,
    drift,
    counties: showCounties,
  } = useAppSelector((state) => state.map);
  const [hover, setHover] = useState<string | null>(null);

  // Longitude squeezed by cos(latitude) so a county is the shape it is on the
  // ground rather than stretched sideways.
  const squeeze = Math.cos(
    ((extent.south + extent.north) / 2) * (Math.PI / 180)
  );
  const width = Math.round(
    (HEIGHT * (extent.east - extent.west) * squeeze) /
      (extent.north - extent.south)
  );
  const px = (lon: number) =>
    ((lon - extent.west) / (extent.east - extent.west)) * width;
  const py = (lat: number) =>
    ((extent.north - lat) / (extent.north - extent.south)) * HEIGHT;

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
        lon >= extent.west &&
        lon <= extent.east &&
        lat >= extent.south &&
        lat <= extent.north
    );

  const hovered: Flare | undefined = analysis.flares.find(
    (f) => f.at === hover
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto bg-black">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label={`Layers at ${analysis.at} with the flare releases charged to it`}
        >
          <defs>
            {/*
             * White, because the app is dark and every band under it is dark.
             *
             * `markerUnits="userSpaceOnUse"` rather than the default: markers
             * scale by stroke width unless told not to, so a 1.4 px line drew a
             * seven-pixel head and the arrow read as a plain line pointing
             * nowhere in particular. Sized in map pixels, it is unmistakably an
             * arrow — which matters, because the direction is the whole content
             * of the mark.
             */}
            <marker
              id="drift-head"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="11"
              markerHeight="11"
              markerUnits="userSpaceOnUse"
              orient="auto-start-reverse"
            >
              <path d="M0 0 L10 5 L0 10 z" fill="white" />
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
           * The layers, in the order the replay map stacks them. A layer's
           * levels are drawn low to high so the fills composite the way ArcGIS
           * composites them.
           */}
          {LAYERS.filter((layer) => visible[layer.key]).map((layer) => {
            const frame = painted.frames[analysis.at]?.[layer.key];
            if (!frame || frame.error) return null;
            return frame.levels.map((level) => {
              const band = layer.bands.find((b) => b.value === level.level);
              if (!band) return null;
              return level.polygons.map((polygon, index) => (
                <path
                  key={`${layer.key}-${level.level}-${index}`}
                  d={polygon.map(draw).join(" ")}
                  fillRule="evenodd"
                  fill={soloColor(layer.rgb, band.alpha)}
                  stroke={soloColor(layer.rgb, 0.85)}
                  strokeWidth={1}
                />
              ));
            });
          })}

          {/*
           * From where the flare was dropped to where that air is at the moment
           * of the frame under it. Drawn beneath the markers so a short line is
           * not swallowed by the dot it starts from.
           */}
          {drift &&
            analysis.flares.map((flare) =>
              flare.drift?.to ? (
                <line
                  key={`drift-${flare.at}`}
                  x1={px(flare.lon)}
                  y1={py(flare.lat)}
                  x2={px(flare.drift.to[0])}
                  y2={py(flare.drift.to[1])}
                  stroke="white"
                  strokeWidth={1.4}
                  markerEnd="url(#drift-head)"
                  opacity={hover && hover !== flare.at ? 0.4 : 0.95}
                />
              ) : null
            )}

          {/*
           * The releases themselves, drawn where the aircraft actually dropped
           * them.
           *
           * **White, with no verdict in the colour.** Colouring a release by how
           * far it was from one layer put our answer on top of the operator's
           * fact, and it competed with the bands underneath — which are the
           * thing being judged. The distance is in the readout instead, for
           * every layer at once.
           *
           * The arrowhead marks where that air is at the analysis time, and that
           * is where the distances are measured from. Two glyphs, one each: a
           * dot for what the operator did, a head for what we compared it to.
           */}
          {analysis.flares.map((flare) => (
            <g
              key={flare.at}
              onMouseEnter={() => setHover(flare.at)}
              onMouseLeave={() => setHover(null)}
            >
              <circle
                cx={px(flare.lon)}
                cy={py(flare.lat)}
                r={hover === flare.at ? 12 : 9}
                className="fill-none stroke-white"
                strokeWidth={1}
                opacity={hover === flare.at ? 0.9 : 0.35}
              />
              <circle
                cx={px(flare.lon)}
                cy={py(flare.lat)}
                r={5}
                fill="white"
                stroke="black"
                strokeWidth={1.2}
              />
            </g>
          ))}
        </svg>
      </div>

      {/*
       * Pinned to the map's own width. The svg is sized from the extent's aspect
       * ratio, so a readout at the container's width ran well past the picture
       * it belongs to and read as page furniture rather than as part of the map.
       */}
      <div
        className="text-xs font-mono bg-base-200 p-2 flex flex-col gap-1"
        style={{ width, maxWidth: "100%", minHeight: "4rem" }}
      >
        {hovered ? (
          <>
            <div>
              {hovered.timeZ}Z · {hovered.county} County · {hovered.plane} ·{" "}
              {hovered.payload}
              {hovered.drift?.stormMotionKt != null && (
                <>
                  {" "}
                  · {hovered.offsetMinutes! > 0 ? "+" : ""}
                  {hovered.offsetMinutes} min to the analysis, drifting{" "}
                  {hovered.drift.stormMotionKt} kt toward{" "}
                  {hovered.drift.stormMotionTowardDeg}°
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {LAYERS.map((layer) => {
                const near = hovered.near[layer.key];
                return (
                  <span
                    key={layer.key}
                    className={visible[layer.key] ? "" : "opacity-60"}
                  >
                    {layer.legend.name.toLowerCase()}{" "}
                    <span className="font-semibold">
                      {!near || near.km === null
                        ? "not painted"
                        : near.inside
                          ? "inside"
                          : `${near.km} km`}
                    </span>
                  </span>
                );
              })}
            </div>
          </>
        ) : (
          <span className="opacity-70">
            Hover a release for how far it was from every layer, measured at the
            arrowhead.
          </span>
        )}
      </div>
    </div>
  );
};
