// ArcGIS
import {
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  soloColor,
} from "@/lib/arcgis/renderers";

/**
 * The cloud-base bands, drawn as the map draws them.
 *
 * Not the stacked `Ramp` the contour layers use: these are disjoint, so nothing
 * composites and each swatch is the literal fill. The lit band sits in the
 * middle rather than at an end, which is the shape of the field — a window with
 * a wrong side on either side of it, not a scale.
 */
export const CloudBaseRamp = () => (
  <div className="flex items-end gap-1">
    {CLOUD_BASE_BANDS.map((band) => (
      <div key={band.value} className="flex flex-1 flex-col gap-1">
        <div
          className="h-3 w-full rounded-sm border border-white/10"
          style={{ backgroundColor: soloColor(CLOUD_BASE_RGB, band.alpha) }}
          title={`${band.label} ft MSL`}
        />
        <span className="text-[10px] opacity-70 whitespace-nowrap">
          {band.label}
        </span>
      </div>
    ))}
  </div>
);
