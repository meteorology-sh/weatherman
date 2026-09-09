// React
import { useState } from "react";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Layers
import {
  DRAW_ORDER,
  HOURLY,
  LAYERS,
  MARKS_UNDER,
  isDrawn,
  layerFor,
} from "~/lib/layers";

// ArcGIS
import {
  LIGHTNING_RGB,
  MOTION_RGB,
  RADAR_RGB,
  soloColor,
} from "@/lib/arcgis/bands";

// Layout
import type { Fitted } from "./fit";

// Types
import type { EvalLayer } from "~/lib/layers";
import type { Analysis, Flare, Painted } from "~/lib/types";

// Components
import { stormLines } from "./storm";
import { cellRows, columnRows, flew } from "./readout";

/**
 * One analysis hour: the layers we painted, and the flares charged to it.
 *
 * **Drawn in SVG rather than through ArcGIS, deliberately.** These frames are
 * already plain rings on disk — `paint.mjs` fetched, windowed and rounded them —
 * so there is no layer to load, no url to repoint and no view to keep alive. The
 * product's map is the right tool for live layers over a basemap; this is a
 * fixed frame with points on top, and drawing it directly removes a lifecycle
 * that has nothing to manage.
 *
 * **The colors are not chosen here.** Every fill is `soloColor` over the band
 * table in `@/lib/arcgis/bands`, which is the same table the product's renderers
 * are built from, so a band that moves in Weatherman moves on this map. Levels
 * are drawn low to high and left to composite exactly as they composite there,
 * and the layers themselves are stacked in `DRAW_ORDER` — the order `Map.tsx`
 * adds them to the view.
 *
 * **A gate is one fill, not a ramp.** The Texas fills answer pass or fail on a
 * 3 km square, so they are painted at the single alpha the product paints them
 * at rather than shaded by a contour level that carries no quantity.
 *
 * **The releases carry no verdict in their color.** They are white dots: what
 * the operator did, stated as a fact and left alone. Coloring them by distance
 * put our answer on top of their record and competed with the very bands being
 * judged, which is the wrong way round for a page asking whether the bands are
 * right. Every layer's distance is in the readout instead.
 *
 * **The white arrow points to where the air went.** It runs from the release to
 * where that air sits at the model's analysis hour — a release at 1843Z against
 * a 19Z field is seventeen minutes of drift, ten kilometers at twenty knots.
 * That is where the model-only layers are measured from. The radar and
 * satellite layers are measured at the release itself: their edges are already
 * current to the minute, so the arrow does not describe them and is drawn only
 * while a model layer is on.
 */

type CountyShape = {
  name: string;
  rings: [number, number][][];
  label: [number, number];
};

type PropsT = {
  painted: Painted;
  analysis: Analysis;
  /** The box every map on the page shares, already grown to fill the page. */
  fitted: Fitted | null;
  counties: CountyShape[] | null;
};

export const PaintedMap = ({ painted, analysis, fitted, counties }: PropsT) => {
  const {
    visible,
    drift,
    heading,
    lightning,
    counties: showCounties,
  } = useAppSelector((state) => state.map);
  const showDrift = drift && HOURLY.some((key) => visible[key]);
  const [hover, setHover] = useState<string | null>(null);

  // Nothing to draw until the page has been measured. One render, at mount.
  if (!fitted) return null;

  const { extent, width, height } = fitted;

  const px = (lon: number) =>
    ((lon - extent.west) / (extent.east - extent.west)) * width;
  const py = (lat: number) =>
    ((extent.north - lat) / (extent.north - extent.south)) * height;

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

  /**
   * One layer's levels, low to high, so the fills composite the way ArcGIS
   * composites them.
   */
  const fillsOf = (layer: EvalLayer) => {
    const frame = painted.frames[analysis.at]?.[layer.key];
    if (!frame || frame.error) return null;
    return frame.levels.map((level) => {
      // A gate paints every level it has at one alpha; a ramped field paints
      // only the levels its band table names, so a contour the product does
      // not draw is not drawn here either.
      const alpha =
        layer.kind === "gate"
          ? layer.alpha
          : layer.bands.find((b) => b.value === level.level)?.alpha;
      if (alpha === undefined) return null;
      return level.polygons.map((polygon, index) => (
        <path
          key={`${layer.key}-${level.level}-${index}`}
          d={polygon.map(draw).join(" ")}
          fillRule="evenodd"
          fill={soloColor(layer.rgb, alpha)}
          stroke={soloColor(layer.rgb, 0.85)}
          strokeWidth={1}
        />
      ));
    });
  };

  /**
   * The layers on, in the order the replay map stacks them, split where the
   * storm marks go in — see `MARKS_UNDER`.
   */
  const stack = DRAW_ORDER.map(layerFor).filter(
    (layer): layer is EvalLayer => !!layer && isDrawn(layer, visible)
  );
  const marksAt = DRAW_ORDER.indexOf(MARKS_UNDER);
  const belowMarks = stack.filter(
    (layer) => DRAW_ORDER.indexOf(layer.key) < marksAt
  );
  const aboveMarks = stack.filter(
    (layer) => DRAW_ORDER.indexOf(layer.key) >= marksAt
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto bg-black">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
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
           * County names, for the ones whose middle is on screen.
           *
           * An outline with no name is a shape rather than a place, and the
           * releases are logged by county — so without these there is no way to
           * check a flare against the record it came from. Drawn under the
           * layers so a fill never has to compete with a word, and
           * `pointer-events: none` so a name never swallows a hover.
           */}
          {showCounties &&
            counties
              ?.filter(
                (county) =>
                  county.label[0] >= extent.west &&
                  county.label[0] <= extent.east &&
                  county.label[1] >= extent.south &&
                  county.label[1] <= extent.north
              )
              .map((county) => (
                <text
                  key={`label-${county.name}`}
                  x={px(county.label[0])}
                  y={py(county.label[1])}
                  textAnchor="middle"
                  pointerEvents="none"
                  className="fill-base-content/45 text-[10px] tracking-wide"
                >
                  {county.name.toUpperCase()}
                </text>
              ))}

          {/* The layers under the storm marks — cloud base, the rain, and
              the echo top over the rain it annotates. */}
          {belowMarks.map(fillsOf)}

          {visible.radar &&
            heading &&
            (painted.marks?.[analysis.at]?.heading.rings ?? [])
              .filter(inView)
              .map((ring, index) => (
                <path
                  key={`heading-${index}`}
                  d={draw(ring)}
                  fill={soloColor(MOTION_RGB, 0.95)}
                />
              ))}

          {visible.radar &&
            heading &&
            (painted.marks?.[analysis.at]?.cores.points ?? []).map(
              ([lon, lat], index) => (
                <circle
                  key={`core-${index}`}
                  cx={px(lon)}
                  cy={py(lat)}
                  r={3.5}
                  fill={soloColor(RADAR_RGB, 0.95)}
                />
              )
            )}

          {visible.radar &&
            lightning &&
            (painted.marks?.[analysis.at]?.lightning.points ?? []).map(
              ([lon, lat], index) => (
                <circle
                  key={`flash-${index}`}
                  cx={px(lon)}
                  cy={py(lat)}
                  r={2.5}
                  fill={soloColor(LIGHTNING_RGB, 0.95)}
                />
              )
            )}

          {/* The fly fill, over the marks, as the operator's map draws it. */}
          {aboveMarks.map(fillsOf)}

          {/*
           * From where the flare was dropped to where that air is at the moment
           * of the frame under it. Drawn beneath the markers so a short line is
           * not swallowed by the dot it starts from.
           */}
          {showDrift &&
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
           * **White, with no verdict in the color.** Coloring a release by how
           * far it was from one layer put our answer on top of the operator's
           * fact, and it competed with the bands underneath — which are the
           * thing being judged. The distance is in the readout instead, for
           * every layer at once.
           *
           * The arrowhead marks where that air is at the analysis hour, which
           * is where the model-only layers are measured from. Two glyphs, one
           * each: a dot for what the operator did, a head for what a model
           * layer was compared against.
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
                    className={isDrawn(layer, visible) ? "" : "opacity-60"}
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
            {/*
             * What a click on this release would have said. The same three
             * blocks the operator panel prints — the verdict on the cell, the
             * storm it sat in, and the column over it.
             */}
            {hovered.cell && (
              <div className="pt-1">
                <span
                  className={
                    flew(hovered.cell) ? "text-success" : "text-warning"
                  }
                >
                  {flew(hovered.cell) ? "FLY" : "DON'T FLY"}
                </span>
                {cellRows(hovered.cell).map((row) => (
                  <span key={row.label}>
                    {" · "}
                    {row.label.toLowerCase()}{" "}
                    <span className="font-semibold">{row.value}</span>
                  </span>
                ))}
              </div>
            )}
            {hovered.storm && (
              <div className="flex flex-col gap-0.5 pt-1">
                {stormLines(hovered.storm).map((line) => (
                  <div key={line}>{line}</div>
                ))}
              </div>
            )}
            {hovered.column && (
              <div className="pt-1 flex flex-wrap gap-x-4 gap-y-1">
                {columnRows(hovered.column).map((row) => (
                  <span key={row.label}>
                    {row.label.toLowerCase()}{" "}
                    <span className="font-semibold">{row.value}</span>
                  </span>
                ))}
              </div>
            )}
          </>
        ) : (
          <span className="opacity-70">
            Hover a release for how far it was from every layer — at the release
            for the radar and satellite layers, at the arrowhead for the model
            ones — and for what a click on it would have said.
          </span>
        )}
      </div>
    </div>
  );
};
