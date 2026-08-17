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

// Components
import { toneFor } from "./distance";

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
 * **Each flare is coloured by how far it was from the paint, not by whether it
 * was in it.** A release just outside a contour and one on the far side of the
 * county are both "outside", and only the distance separates a map that is
 * slightly wrong from one that is looking at the wrong weather.
 *
 * **The white line is the clock, drawn.** A release at 1843Z is being compared
 * against a 19Z field, seventeen minutes later, and at twenty knots the air has
 * moved ten kilometres in between — most of a grid cell. The line runs from
 * where the flare was dropped to where that air is at the moment of the frame
 * underneath it, and the distance is measured from its far end.
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
            {/* White, because the app is dark and every band under it is dark. */}
            <marker
              id="drift-head"
              viewBox="0 0 10 10"
              refX="9"
              refY="5"
              markerWidth="5"
              markerHeight="5"
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

          {analysis.flares.map((flare) => {
            const near = flare.near.liquid;
            const tone = toneFor(near, painted.proximity.cellKm);
            const [lon, lat] = flare.compared;
            return (
              <g
                key={flare.at}
                onMouseEnter={() => setHover(flare.at)}
                onMouseLeave={() => setHover(null)}
              >
                <circle
                  cx={px(lon)}
                  cy={py(lat)}
                  r={hover === flare.at ? 13 : 10}
                  className={`fill-none ${tone.stroke}`}
                  strokeWidth={1.3}
                  opacity={0.6}
                />
                <circle
                  cx={px(lon)}
                  cy={py(lat)}
                  r={5.5}
                  className={tone.fill}
                  stroke="white"
                  strokeWidth={1.2}
                />
              </g>
            );
          })}
        </svg>
      </div>

      <div className="text-xs font-mono min-h-[3rem] bg-base-200 p-2">
        {hovered ? (
          <>
            {hovered.timeZ}Z · {hovered.county} County · {hovered.plane} ·{" "}
            {hovered.payload}
            <br />
            {hovered.near.liquid
              ? hovered.near.liquid.inside
                ? "inside painted liquid"
                : `${hovered.near.liquid.km} km from painted liquid` +
                  (hovered.near.liquid.kmAtRelease !== hovered.near.liquid.km
                    ? ` (${hovered.near.liquid.kmAtRelease} km before drifting)`
                    : "")
              : "no liquid frame at this hour"}
            {hovered.drift?.stormMotionKt != null && (
              <>
                {" "}
                · {hovered.offsetMinutes! > 0 ? "+" : ""}
                {hovered.offsetMinutes} min to the analysis at{" "}
                {hovered.drift.stormMotionKt} kt toward{" "}
                {hovered.drift.stormMotionTowardDeg}°
              </>
            )}
          </>
        ) : (
          <span className="opacity-70">
            Hover a flare for how far it was from the paint, and how far the air
            was carried to meet the analysis.
          </span>
        )}
      </div>
    </div>
  );
};
