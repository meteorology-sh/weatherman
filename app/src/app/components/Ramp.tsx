// ArcGIS
import { stackedColor } from "@/lib/arcgis/renderers";

type PropsT = {
  bands: readonly { value: number; alpha: number }[];
  rgb: readonly number[];
  /** One caption per band, in the operator's units. */
  captions: string[];
  /** Optional hover text per band, for the words behind the numbers. */
  titles?: readonly string[];
  /**
   * Draw the ramp as unavailable. A legend at full strength while the layer
   * cannot paint is a legend advertising something the map is not showing.
   */
  muted?: boolean;
};

/**
 * The map paints these bands over each other, so each swatch shows the same
 * cumulative alpha, composited the way the map composites it. Derive it — a
 * legend that sums the alphas reads far darker than the map draws.
 */
export const Ramp = ({ bands, rgb, captions, titles, muted }: PropsT) => (
  <div className={`flex flex-col gap-1 ${muted ? "opacity-30" : ""}`}>
    <div className="flex rounded overflow-hidden border border-base-300">
      {bands.map((band, i) => (
        <div
          key={band.value}
          className="h-4 flex-1"
          title={titles?.[i]}
          style={{ backgroundColor: stackedColor(bands, rgb, i + 1) }}
        />
      ))}
    </div>
    <div className="flex text-xs">
      {captions.map((caption) => (
        <span key={caption} className="flex-1">
          {caption}
        </span>
      ))}
    </div>
  </div>
);
