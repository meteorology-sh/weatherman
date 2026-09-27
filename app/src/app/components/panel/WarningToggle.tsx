// ArcGIS
import { WarningLegend } from "@/lib/arcgis/legends";

// Components
import { LayerToggle } from "./LayerToggle";

// Types
import type { WarningStats } from "@/lib/types";

type PropsT = {
  /** Warnings in force; null when the archive could not be read. */
  stats: WarningStats | null | undefined;
  error?: string | null;
  checked: boolean;
  onChange: (checked: boolean) => void;
};

const plural = (n: number, word: string) =>
  `${n} ${word} warning${n === 1 ? "" : "s"}`;

/**
 * The NWS warning switch. It exists only while a warning is in
 * force: with none, there is nothing for it to draw and no switch is rendered.
 *
 * A failed read is said out loud rather than rendered as no switch, because no
 * switch means "no warnings" and that is not what is known.
 */
export const WarningToggle = ({ stats, error, checked, onChange }: PropsT) => {
  if (error || stats === null) {
    return (
      <div className="text-xs text-error">
        Severe weather warnings could not be read.
      </div>
    );
  }
  if (!stats || stats.count === 0) return null;

  const parts = [
    stats.severe > 0 ? plural(stats.severe, "severe thunderstorm") : null,
    stats.tornado > 0 ? plural(stats.tornado, "tornado") : null,
    stats.flood > 0 ? plural(stats.flood, "flash flood") : null,
  ].filter(Boolean);

  return (
    <LayerToggle legend={WarningLegend} checked={checked} onChange={onChange}>
      <div className="text-xs">
        {parts.join(", ")} in force at {stats.validTime.slice(11, 16)}Z.
      </div>
    </LayerToggle>
  );
};
