// ArcGIS
import {
  CLOUD_TOP_BANDS,
  CLOUD_TOP_RGB,
  soloColor,
} from "@/lib/arcgis/renderers";

/**
 * The cloud-top temperature bands, drawn as the map draws them.
 *
 * Not the stacked `Ramp` the contour layers use. These bands are disjoint —
 * exactly one applies to a cell — so nothing composites and the swatches are
 * the literal fills. The ramp also runs loud-to-quiet rather than quiet-to-loud,
 * which a stacked bar could not express: the warmest band is the one worth
 * finding, and the coldest is cirrus covering most of the sky.
 */
export const CloudTopRamp = () => (
  <div className="flex items-end gap-1">
    {CLOUD_TOP_BANDS.map((band) => (
      <div key={band.value} className="flex flex-1 flex-col gap-1">
        <div
          className="h-3 w-full rounded-sm border border-white/10"
          style={{ backgroundColor: soloColor(CLOUD_TOP_RGB, band.alpha) }}
          title={`${band.label} °C`}
        />
        <span className="text-[10px] whitespace-nowrap">{band.label}</span>
      </div>
    ))}
  </div>
);
