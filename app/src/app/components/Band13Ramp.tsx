// ArcGIS
import { Band13Legend } from "@/lib/arcgis/legends";
import { BAND_LABEL } from "@/lib/arcgis/renderers";

/**
 * The published GIBS colour map, with the seeding band bracketed across it.
 * The bracket is positioned from the temperatures themselves, not eyeballed —
 * see legends.ts.
 */
export const Band13Ramp = () => (
  <div>
    <div
      className="h-2 w-full rounded"
      style={{ background: Band13Legend.gradient }}
    />
    <div className="relative h-3">
      <div
        className="absolute h-3 border-x-2 border-b-2 border-white/70"
        style={{
          left: `${Band13Legend.band.fromPercent}%`,
          width: `${
            Band13Legend.band.toPercent - Band13Legend.band.fromPercent
          }%`,
        }}
        title={Band13Legend.band.label}
      />
    </div>
    <div className="relative h-4 text-xs opacity-60">
      {Band13Legend.ticks.map((tick) => (
        <span
          key={tick.label}
          className="absolute -translate-x-1/2"
          style={{ left: `${tick.percent}%` }}
        >
          {tick.label}
        </span>
      ))}
    </div>
    <div className="text-xs opacity-60">
      Bracket marks the {Band13Legend.band.label} ({BAND_LABEL}).
    </div>
  </div>
);
