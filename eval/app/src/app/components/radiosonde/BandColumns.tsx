// React
import { useState } from "react";

// Types
import type { Ascent } from "~/lib/types";

/**
 * Every ascent of the season, drawn as the column it measured.
 *
 * One pair of bars per balloon: the outline is the layer the sonde found, the
 * fill is the layer we drew for the same place and hour. Blue filling the
 * outline is agreement, outline showing through is the miss. This is the whole
 * finding in one picture — the numbers beside it are the same thing summarized.
 */

const PAD = { left: 46, right: 8, top: 10, bottom: 30 };
const HEIGHT = 300;
const COLUMN = 11;
const GAP = 3;

type PropsT = { ascents: Ascent[] };

export const BandColumns = ({ ascents }: PropsT) => {
  const [hover, setHover] = useState<Ascent | null>(null);

  if (!ascents.length) return null;

  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const width = PAD.left + ascents.length * (COLUMN + GAP) + PAD.right;

  const lowest = Math.min(
    ...ascents.flatMap((a) => [a.measured[0], a.ours[0]])
  );
  const highest = Math.max(
    ...ascents.flatMap((a) => [a.measured[1], a.ours[1]])
  );
  const floor = Math.floor((lowest - 300) / 500) * 500;
  const ceiling = Math.ceil((highest + 300) / 500) * 500;
  const y = (meters: number) =>
    PAD.top + plotHeight - ((meters - floor) / (ceiling - floor)) * plotHeight;

  const gridlines: number[] = [];
  for (let m = floor; m <= ceiling; m += 1000) gridlines.push(m);

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={HEIGHT}
          viewBox={`0 0 ${width} ${HEIGHT}`}
          role="img"
          aria-label="Measured and modeled seeding band heights for every ascent"
        >
          {gridlines.map((m) => (
            <g key={m}>
              <line
                x1={PAD.left - 6}
                x2={width - PAD.right}
                y1={y(m)}
                y2={y(m)}
                className="stroke-base-300"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 10}
                y={y(m) + 3}
                textAnchor="end"
                className="fill-base-content text-[9px] font-mono"
              >
                {(m / 1000).toFixed(0)}k
              </text>
            </g>
          ))}

          {ascents.map((ascent, index) => {
            const x = PAD.left + index * (COLUMN + GAP);
            const on = hover === ascent;
            return (
              <g
                key={`${ascent.date}-${ascent.site}`}
                onMouseEnter={() => setHover(ascent)}
                onMouseLeave={() => setHover(null)}
              >
                <rect
                  x={x}
                  y={y(ascent.measured[1])}
                  width={COLUMN}
                  height={Math.max(
                    1,
                    y(ascent.measured[0]) - y(ascent.measured[1])
                  )}
                  className="fill-warning/15 stroke-warning"
                  strokeWidth={on ? 2 : 1}
                />
                <rect
                  x={x + 2.5}
                  y={y(ascent.ours[1])}
                  width={COLUMN - 5}
                  height={Math.max(1, y(ascent.ours[0]) - y(ascent.ours[1]))}
                  className="fill-info"
                  opacity={0.85}
                />
                <rect
                  x={x - GAP / 2}
                  y={PAD.top}
                  width={COLUMN + GAP}
                  height={plotHeight}
                  fill="transparent"
                />
              </g>
            );
          })}

          <text
            x={PAD.left}
            y={HEIGHT - 8}
            className="fill-base-content text-[10px] font-mono"
          >
            one column per ascent, in date order — meters above sea level
          </text>
        </svg>
      </div>

      <div className="text-xs font-mono min-h-[2.5rem] bg-base-200 p-2">
        {hover ? (
          <>
            {hover.date} {hover.site} — balloon {hover.measured[0]}–
            {hover.measured[1]} m · ours {Math.round(hover.ours[0])}–
            {Math.round(hover.ours[1])} m · overlap{" "}
            {(hover.fraction * 100).toFixed(1)}%
          </>
        ) : (
          <span className="opacity-70">
            Hover a column for that day's two readings.
          </span>
        )}
      </div>
    </div>
  );
};
