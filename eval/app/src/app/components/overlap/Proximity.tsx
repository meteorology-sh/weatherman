// React
import { useState } from "react";

// Layers
import { LAYERS } from "~/lib/layers";

// Components
import { toneFor } from "./distance";

// Types
import type { Flare, Painted } from "~/lib/types";

/**
 * How near each release was to the paint, as one number and as a picture.
 *
 * **The bars are the finding.** A count of how many landed inside answers a
 * yes-or-no question that was never the interesting one; the shape of the bars
 * says whether the misses are a map that is slightly off or a map that is
 * somewhere else entirely. Four releases 75 km out and nine inside is a
 * different story from thirteen releases 15 km out, and both would report the
 * same "9 of 13 inside".
 *
 * Every figure here comes from the eval server, which computed it from the file
 * `paint.mjs` wrote. Nothing on this page derives a number a second way.
 */

const PAD = { left: 34, right: 8, top: 10, bottom: 34 };
const HEIGHT = 190;
const COLUMN = 18;
const GAP = 6;

type PropsT = { painted: Painted };

export const Proximity = ({ painted }: PropsT) => {
  const [hover, setHover] = useState<Flare | null>(null);
  const { proximity } = painted;
  const cell = proximity.cellKm;
  const liquid = proximity.layers.liquid;

  const flares = painted.analyses
    .flatMap((entry) => entry.flares)
    .filter((flare) => flare.near.liquid?.km !== null && flare.near.liquid)
    .sort((a, b) => a.at.localeCompare(b.at));

  if (!liquid || !flares.length) {
    return (
      <p className="text-sm">
        No liquid was painted at either analysis, so there is no distance to
        measure.
      </p>
    );
  }

  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const width = PAD.left + flares.length * (COLUMN + GAP) + PAD.right;
  const worst = Math.max(liquid.worst ?? 0, 2 * cell);
  const ceiling = Math.ceil(worst / 10) * 10;
  const y = (km: number) => PAD.top + plotHeight - (km / ceiling) * plotHeight;

  return (
    <div className="flex flex-col gap-4">
      <div className="stats stats-vertical sm:stats-horizontal bg-base-200">
        <div className="stat">
          <div className="stat-title">Released inside painted liquid</div>
          <div className="stat-value text-success">
            {liquid.inside}
            <span className="text-lg">/{liquid.n}</span>
          </div>
          <div className="stat-desc">
            {liquid.withinCell} within one {cell} km cell
          </div>
        </div>
        <div className="stat">
          <div className="stat-title">Typical distance</div>
          <div className="stat-value">
            {liquid.median}
            <span className="text-lg"> km</span>
          </div>
          <div className="stat-desc">median over {liquid.n} releases</div>
        </div>
        <div className="stat">
          <div className="stat-title">Furthest out</div>
          <div className="stat-value">
            {liquid.worst}
            <span className="text-lg"> km</span>
          </div>
          <div className="stat-desc">
            {proximity.offset &&
              `analyses ${proximity.offset.median} min away, at worst ${proximity.offset.worst}`}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label="Distance from each release to the nearest painted liquid"
        >
          {[cell, 2 * cell].map((line) => (
            <g key={line}>
              <line
                x1={PAD.left - 4}
                x2={width - PAD.right}
                y1={y(line)}
                y2={y(line)}
                className="stroke-base-content/40"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={PAD.left - 8}
                y={y(line) + 3}
                textAnchor="end"
                className="fill-base-content text-[9px] font-mono"
              >
                {line}
              </text>
            </g>
          ))}

          <line
            x1={PAD.left - 4}
            x2={width - PAD.right}
            y1={y(0)}
            y2={y(0)}
            className="stroke-base-content/60"
            strokeWidth={1}
          />

          {flares.map((flare, index) => {
            const near = flare.near.liquid!;
            const tone = toneFor(near, cell);
            const x = PAD.left + index * (COLUMN + GAP);
            const km = near.km ?? 0;
            // An inside release has no bar to draw, so it gets a marker sitting
            // on the baseline. A zero-height column would read as missing.
            const height = Math.max(3, y(0) - y(km));
            return (
              <g
                key={flare.at}
                onMouseEnter={() => setHover(flare)}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={x}
                  y={y(km)}
                  width={COLUMN}
                  height={height}
                  className={tone.fill}
                  opacity={hover && hover !== flare ? 0.55 : 1}
                />
                <text
                  x={x + COLUMN / 2}
                  y={HEIGHT - 20}
                  textAnchor="middle"
                  className="fill-base-content text-[9px] font-mono"
                >
                  {flare.timeZ}
                </text>
              </g>
            );
          })}

          <text
            x={PAD.left}
            y={HEIGHT - 6}
            className="fill-base-content text-[10px] font-mono"
          >
            km to the nearest painted liquid — dashed lines are one and two{" "}
            {cell} km cells
          </text>
        </svg>
      </div>

      <div className="text-xs font-mono min-h-[2.5rem] bg-base-200 p-2">
        {hover ? (
          <>
            {hover.timeZ}Z · {hover.county} County —{" "}
            {hover.near.liquid!.inside
              ? "inside painted liquid"
              : `${hover.near.liquid!.km} km out`}
            {LAYERS.filter((layer) => layer.key !== "liquid").map((layer) => {
              const near = hover.near[layer.key];
              if (!near || near.km === null) return null;
              return (
                <span key={layer.key}>
                  {" · "}
                  {layer.legend.name.toLowerCase()}{" "}
                  {near.inside ? "inside" : `${near.km} km`}
                </span>
              );
            })}
          </>
        ) : (
          <span className="opacity-70">
            Hover a bar for that release and how it sits against every other
            layer.
          </span>
        )}
      </div>
    </div>
  );
};
