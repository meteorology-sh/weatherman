// Types
import type { LayerLegend } from "@/lib/arcgis/legends";

// Components
import { LayerDefinitions } from "./LayerDefinitions";

type PropsT = {
  legend: LayerLegend;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** The ramp and its units. Rendered only while the layer is on. */
  children?: React.ReactNode;
};

type SubPropsT = {
  name: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
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
        <LayerDefinitions legend={legend} />
      </>
    )}
  </div>
);

/**
 * A control that only exists while its parent layer is on. Same switch
 * chrome as {@link LayerToggle}, without its own legend: the parent
 * already said what the layer is.
 */
export const SubToggle = ({ name, checked, onChange, children }: SubPropsT) => (
  <div className="flex flex-col gap-1 pl-2">
    <label className="flex items-center gap-2 cursor-pointer">
      <input
        type="checkbox"
        className="toggle toggle-sm"
        checked={checked}
        aria-label={name}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-semibold">{name}</span>
    </label>
    {children}
  </div>
);
