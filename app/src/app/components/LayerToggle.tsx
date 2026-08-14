// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

// Components
import { LayerAbout } from "./LayerAbout";

type PropsT = {
  legend: LayerLegend;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The ramp and its units. Rendered only while the layer is on. */
  children?: React.ReactNode;
};

/**
 * One layer's switch, its legend, and what it measures.
 *
 * The legend is mounted only while the layer is on, and that is the point: a
 * ramp for a layer nobody is drawing describes a map that is not there. Every
 * sidebar section on both maps is this shape, so it lives in one place.
 */
export const LayerToggle = ({
  legend,
  checked,
  onChange,
  children,
}: PropsT) => (
  <div className="flex flex-col gap-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="toggle toggle-sm"
        checked={checked}
        aria-label={legend.name}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-semibold">{legend.name}</span>
    </label>
    {checked && (
      <>
        {children}
        <LayerAbout legend={legend} />
      </>
    )}
  </div>
);
