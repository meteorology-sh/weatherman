// Hooks
import { useAppDispatch, useAppSelector } from "~/lib/store/hooks";

// Store
import { mapActions, type Ends } from "~/lib/store/features/map";

// Layers
import { LAYERS } from "~/lib/layers";

// Components
import { LayerToggle } from "@/app/components/panel/LayerToggle";
import { Ramp } from "@/app/components/panel/Ramp";
import { CloudTopRamp } from "@/app/components/panel/CloudTopRamp";
import { CloudBaseRamp } from "@/app/components/panel/CloudBaseRamp";

/**
 * The map's controls — the same switches the product's own panel uses.
 *
 * `LayerToggle`, `Ramp`, `CloudTopRamp` and `CloudBaseRamp` are imported from
 * `/app` rather than reimplemented, so a layer is named, described and ramped
 * here exactly as it is in Weatherman. Rewriting them would have made this page
 * a second opinion about the map instead of a window onto it.
 */

const ENDS: { value: Ends; label: string; hint: string }[] = [
  {
    value: "both",
    label: "Both",
    hint: "Earlier hour dashed, later hour solid. Where they overlap the fills double.",
  },
  { value: "from", label: "Earlier", hint: "The analysis before the release." },
  { value: "to", label: "Later", hint: "The analysis after the release." },
];

export const LayerPanel = () => {
  const { visible, ends, drift, counties } = useAppSelector(
    (state) => state.map
  );
  const dispatch = useAppDispatch();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-2">
        <div className="text-xs tracking-widest">ANALYSES</div>
        <p className="text-xs">
          A release falls between two model hours. Painting both is what shows
          whether the answer depends on which one it is charged to.
        </p>
        <div className="join">
          {ENDS.map((option) => (
            <button
              key={option.value}
              type="button"
              title={option.hint}
              className={`join-item btn btn-xs flex-1 ${
                ends === option.value ? "btn-active" : ""
              }`}
              onClick={() => dispatch(mapActions.setEnds(option.value))}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2 border-t border-base-300 pt-4">
        <div className="text-xs tracking-widest">ANNOTATIONS</div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={drift}
            aria-label="Storm motion"
            onChange={(e) => dispatch(mapActions.setDrift(e.target.checked))}
          />
          <span className="text-sm font-semibold">STORM MOTION</span>
        </label>
        {drift && (
          <p className="text-xs">
            Sampled at each release separately, so every arrow is that cell's
            own vector rather than one wind for the map. It is HRRR's 0–6 km
            storm motion — where a cloud is being carried, which is not the same
            as the wind at any single level. Its length is how far that air
            travels in the minutes between the release and the analysis under
            it, so a short arrow means a slow day or a close analysis, not a
            small effect.
          </p>
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
        {LAYERS.map((layer) => (
          <LayerToggle
            key={layer.key}
            legend={layer.legend}
            checked={Boolean(visible[layer.key])}
            onChange={(on) =>
              dispatch(mapActions.toggleLayer({ key: layer.key, visible: on }))
            }
          >
            {layer.key === "cloudTop" ? (
              <CloudTopRamp />
            ) : layer.key === "cloudBase" ? (
              <CloudBaseRamp />
            ) : (
              <Ramp
                bands={layer.bands}
                rgb={layer.rgb}
                captions={layer.captions}
                titles={layer.titles}
              />
            )}
            <div className="text-xs">{layer.unit}</div>
          </LayerToggle>
        ))}
      </div>
    </div>
  );
};
