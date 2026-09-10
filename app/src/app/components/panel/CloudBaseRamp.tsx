// ArcGIS
import {
  CLOUD_BASE_ALPHA,
  CLOUD_BASE_BANDS,
  soloColor,
} from "@/lib/arcgis/bands";

// Types
import type { CloudBaseBand } from "@/lib/arcgis/bands";

/**
 * The cloud-base bands, drawn as the map draws them.
 *
 * Not the stacked `Ramp` the contour layers use: these are disjoint, so nothing
 * composites and each swatch is the literal fill. The bands are thirds of the
 * aircraft's service ceiling, and they run light to dark, so the lightest
 * swatch is the shortest climb.
 */
export const HeightRamp = ({
  unit = "ft MSL",
  bands = CLOUD_BASE_BANDS,
}: {
  unit?: string;
  bands?: readonly CloudBaseBand[];
}) => (
  <div className="flex items-end gap-1">
    {bands.map((band) => (
      <div key={band.value} className="flex flex-1 flex-col gap-1">
        <div
          className="h-3 w-full rounded-sm border border-white/10"
          style={{ backgroundColor: soloColor(band.rgb, CLOUD_BASE_ALPHA) }}
          title={`${band.label} ${unit}`}
        />
        <span className="text-[10px] whitespace-nowrap">{band.label}</span>
      </div>
    ))}
  </div>
);

/** The height ramp with its unit under it. */
export const CloudBaseRamp = () => (
  <>
    <HeightRamp />
    <div className="text-xs">ft MSL</div>
  </>
);
