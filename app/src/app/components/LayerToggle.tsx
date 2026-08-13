type PropsT = {
  /** Accessible name, and the heading when no `title` is given. */
  name: string;
  /** Heading text, when it carries more than the name (a source, a window). */
  title?: React.ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Legend and caveats. Rendered only while the layer is on. */
  children?: React.ReactNode;
};

/**
 * One layer's switch, with its legend underneath.
 *
 * The legend is mounted only while the layer is on, and that is the point: a
 * ramp for a layer nobody is drawing describes a map that is not there. Every
 * sidebar section on both maps is this shape, so it lives in one place.
 */
export const LayerToggle = ({
  name,
  title,
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
        aria-label={name}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="text-sm font-semibold">{title ?? name}</span>
    </label>
    {checked && children}
  </div>
);
