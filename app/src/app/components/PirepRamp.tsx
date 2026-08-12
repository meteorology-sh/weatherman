// ArcGIS
import { PIREP_CLASSES, soloColor } from "@/lib/arcgis/renderers";

const OUTLINE = "1px solid rgba(255,255,255,0.85)";

/**
 * The icing-report classes, drawn as the markers the map draws.
 *
 * Not the stacked `Ramp` the contour layers use, and deliberately so: a PIREP is
 * one aircraft in one place, so exactly one class applies to it and nothing
 * composites. Size is part of the encoding too, so the legend shows the actual
 * diameters — a flat bar would leave half the ramp unexplained.
 */
export const PirepRamp = () => (
  <div className="flex items-end gap-3">
    {PIREP_CLASSES.map((band) => (
      <div key={band.value} className="flex flex-col items-center gap-1">
        <div className="flex h-5 items-end">
          <div
            className="rounded-full"
            style={{
              width: band.size,
              height: band.size,
              backgroundColor: soloColor(band.rgb, band.alpha),
              border: OUTLINE,
            }}
          />
        </div>
        <span className="text-xs opacity-80">{band.label}</span>
      </div>
    ))}
  </div>
);
