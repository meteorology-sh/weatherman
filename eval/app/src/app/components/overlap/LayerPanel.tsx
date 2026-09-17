// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { mapActions } from "~/lib/store/features/map";

// Layers
import { HOURLY, PANEL } from "~/lib/layers";

// ArcGIS
import { HeadingLegend, LightningLegend } from "@/lib/arcgis/legends";

// Components
import { LayerToggle, SubToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";
import { WarningToggle } from "@/app/components/panel/WarningToggle";

// Types
import type { EvalLayer } from "~/lib/layers";
import type { WarningStats } from "@/lib/types";
import type { Painted } from "~/lib/types";

/**
 * The map's controls — the same switches the product's own panel uses.
 *
 * `LayerToggle`, `SubToggle` and `Ramp` are imported from
 * `/app` rather than reimplemented, so a layer is named, described and ramped
 * here exactly as it is in Weatherman. Rewriting them would have made this page
 * a second opinion about the map instead of a window onto it.
 *
 * **The nesting is the product's nesting.** Echo past freezing sits under the
 * rain, because that is where `CandidateLayers.tsx` puts it and because it is
 * not a layer on its own — it annotates the field above it. Cores, heading and
 * lightning hang off the rain for the same reason.
 */

const hhmm = (iso: string) => `${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;

/** A gate has no ramp, so its switch carries only its name and its prose. */
const ramp = (layer: EvalLayer) => {
  if (layer.kind === "gate") return null;
  return (
    <>
      <Ramp
        bands={layer.bands}
        rgb={layer.rgb}
        captions={layer.captions}
        titles={layer.titles}
        disjoint={layer.shape === "disjoint"}
      />
      <div className="text-xs">{layer.unit}</div>
    </>
  );
};

/**
 * The warnings in force at the hours on screen, counted the way the product's
 * switch counts them. Undefined when the day was painted before warnings were
 * stored, which renders no switch — the same as an hour with none in force.
 */
export function warningStatsOf(
  painted: Painted | null | undefined,
  hours: readonly string[]
): WarningStats | null | undefined {
  const marks = hours.map((hour) => painted?.marks?.[hour]?.warnings);
  if (!marks.some(Boolean)) return undefined;
  if (marks.some((mark) => mark?.error)) return null;
  const seen = new Map<string, string>();
  for (const mark of marks) {
    for (const warning of mark?.warnings ?? []) {
      seen.set(
        `${warning.office}.${warning.phenomenon}.${warning.eventId}`,
        warning.phenomenon
      );
    }
  }
  const kinds = [...seen.values()];
  const of = (phenomenon: string) =>
    kinds.filter((kind) => kind === phenomenon).length;
  const last = hours.at(-1) ?? "";
  return {
    validTime: last,
    fetchedAt: last,
    count: kinds.length,
    severe: of("SV"),
    tornado: of("TO"),
    flood: of("FF"),
  };
}

export const LayerPanel = () => {
  const {
    visible,
    selectedHour,
    drift,
    heading,
    lightning,
    warnings,
    counties,
  } = useAppSelector((state) => state.map);
  const painted = useAppSelector((state) => state.day.painted);
  const hours = painted?.analyses.map((entry) => entry.at) ?? [];
  const warningStats = warningStatsOf(
    painted,
    selectedHour === null ? hours : [selectedHour]
  );
  const dispatch = useAppDispatch();
  const hourlyOn = HOURLY.some((key) => visible[key]);

  return (
    <div className="flex flex-col gap-4 p-4">
      {hours.length > 1 && (
        <div className="flex flex-col gap-2">
          <div className="text-xs tracking-widest">HOURS</div>
          <p className="text-xs">
            Each button is one model hour and the flares charged to it — not the
            same flares at two times.
          </p>
          <div className="join">
            <button
              type="button"
              className={`join-item btn btn-xs ${
                selectedHour === null ? "btn-active" : ""
              }`}
              onClick={() => dispatch(mapActions.setSelectedHour(null))}
            >
              All
            </button>
            {hours.map((hour) => (
              <button
                key={hour}
                type="button"
                className={`join-item btn btn-xs ${
                  selectedHour === hour ? "btn-active" : ""
                }`}
                onClick={() => dispatch(mapActions.setSelectedHour(hour))}
              >
                {hhmm(hour)}
              </button>
            ))}
          </div>
        </div>
      )}

      <div
        className={`flex flex-col gap-2 ${
          hours.length > 1 ? "border-t border-base-300 pt-4" : ""
        }`}
      >
        <div className="text-xs tracking-widest">ANNOTATIONS</div>
        {hourlyOn && (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="toggle toggle-sm"
              checked={drift}
              aria-label="Flare at this hour"
              onChange={(e) => dispatch(mapActions.setDrift(e.target.checked))}
            />
            <span className="text-sm font-semibold">FLARE AT THIS HOUR</span>
          </label>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={counties}
            aria-label="County lines"
            onChange={(e) => dispatch(mapActions.setCounties(e.target.checked))}
          />
          <span className="text-sm font-semibold">COUNTY LINES</span>
        </label>
      </div>

      <div className="flex flex-col gap-4 border-t border-base-300 pt-4">
        <div className="text-xs tracking-widest">LAYERS</div>
        <WarningToggle
          stats={warningStats}
          checked={warnings}
          onChange={(on) => dispatch(mapActions.setWarnings(on))}
        />
        {PANEL.map(({ layer, gates }) => (
          <LayerToggle
            key={layer.key}
            legend={layer.legend}
            checked={Boolean(visible[layer.key])}
            onChange={(on) =>
              dispatch(mapActions.toggleLayer({ key: layer.key, visible: on }))
            }
          >
            {ramp(layer)}
            {layer.key === "radar" && (
              <>
                <SubToggle
                  name={HeadingLegend.name}
                  checked={heading}
                  onChange={(on) => dispatch(mapActions.setHeading(on))}
                >
                  <div className="text-xs">{HeadingLegend.summary}</div>
                </SubToggle>
                <SubToggle
                  name={LightningLegend.name}
                  checked={lightning}
                  onChange={(on) => dispatch(mapActions.setLightning(on))}
                >
                  <div className="text-xs">{LightningLegend.summary}</div>
                </SubToggle>
              </>
            )}
            {gates.map((gate) => (
              <SubToggle
                key={gate.key}
                name={gate.legend.name}
                checked={Boolean(visible[gate.key])}
                onChange={(on) =>
                  dispatch(
                    mapActions.toggleLayer({ key: gate.key, visible: on })
                  )
                }
              >
                <div className="text-xs">{gate.legend.summary}</div>
              </SubToggle>
            ))}
          </LayerToggle>
        ))}
      </div>
    </div>
  );
};
