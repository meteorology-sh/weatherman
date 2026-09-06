// ArcGIS
import {
  BASE_WINDOW_ALPHA,
  BASE_WINDOW_RGB,
  CLOUD_BASE_BANDS,
  CLOUD_BASE_RGB,
  soloColor,
} from "@/lib/arcgis/bands";
import { BASE_WINDOW_LABEL } from "@/lib/arcgis/legends";

/**
 * The cloud-base bands, drawn as the map draws them.
 *
 * Not the stacked `Ramp` the contour layers use: these are disjoint, so nothing
 * composites and each swatch is the literal fill. Two swatches, split on the
 * aircraft's ceiling — the lit one is cloud a sortie could enter.
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

export const CloudBaseRamp = () => (
  <HeightRamp rgb={CLOUD_BASE_RGB} />
);

/**
 * Same chrome as {@link CloudBaseRamp} — one bar, same height — so the
 * Comptroller-window switch does not move the rest of the panel.
 */
export const WindowRamp = () => (
  <div className="flex items-end gap-1">
    <div className="flex flex-1 flex-col gap-1">
      <div
        className="h-3 w-full rounded-sm border border-white/10"
        style={{
          backgroundColor: soloColor(BASE_WINDOW_RGB, BASE_WINDOW_ALPHA),
        }}
        title={`${BASE_WINDOW_LABEL} above the ground`}
      />
      <span className="text-[10px] whitespace-nowrap">
        {BASE_WINDOW_LABEL}
      </span>
    </div>
  </div>
);
