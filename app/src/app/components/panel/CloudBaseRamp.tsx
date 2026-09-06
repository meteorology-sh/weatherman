// ArcGIS
import {
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  soloColor,
} from "@/lib/arcgis/bands";

/**
 * The cloud-base bands, drawn as the map draws them.
 *
 * Not the stacked `Ramp` the contour layers use: these are disjoint, so
 * nothing composites and each swatch is the literal fill. The bands are
 * thirds of the aircraft's service ceiling, and they run loud to quiet, so
 * the brightest swatch is the shortest climb.
 */
export const HeightRamp = ({
  rgb,
  unit = "ft MSL",
  bands = CLOUD_BASE_BANDS,
}: {
  rgb: readonly number[];
  unit?: string;
  bands?: typeof CLOUD_BASE_BANDS | readonly { value: number; label: string; alpha: number }[];
}) => (
  <div className="flex items-end gap-1">
    {bands.map((band) => (
      <div key={band.value} className="flex flex-1 flex-col gap-1">
        <div
          className="h-3 w-full rounded-sm border border-white/10"
          style={{ backgroundColor: soloColor(rgb, band.alpha) }}
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
    <HeightRamp rgb={CLOUD_BASE_RGB} />
    <div className="text-xs">ft MSL</div>
  </>
);
