// Store
import { useAppSelector, useAppDispatch } from "@/lib/store/hooks";
import { candidateActions } from "@/lib/store/features/candidate";

// ArcGIS
import { Band13Legend } from "@/lib/arcgis/legends";
import { SLW_BANDS, SLW_LABELS, SLW_RGB } from "@/lib/arcgis/renderers";

// Components
import { Ramp } from "./Ramp";

/**
 * The published GIBS colour map, with the seeding band bracketed across it.
 * The bracket is positioned from the temperatures themselves, not eyeballed —
 * see legends.ts.
 */
const Band13Ramp = () => (
  <div>
    <div
      className="h-2 w-full rounded"
      style={{ background: Band13Legend.gradient }}
    />
    <div className="relative h-3">
      <div
        className="absolute h-3 border-x-2 border-b-2 border-white/70"
        style={{
          left: `${Band13Legend.band.fromPercent}%`,
          width: `${
            Band13Legend.band.toPercent - Band13Legend.band.fromPercent
          }%`,
        }}
        title={Band13Legend.band.label}
      />
    </div>
    <div className="relative h-4 text-xs opacity-60">
      {Band13Legend.ticks.map((tick) => (
        <span
          key={tick.label}
          className="absolute -translate-x-1/2"
          style={{ left: `${tick.percent}%` }}
        >
          {tick.label}
        </span>
      ))}
    </div>
    <div className="text-xs opacity-60">
      Bracket marks the {Band13Legend.band.label} (−12 to −5 °C).
    </div>
  </div>
);

export const CandidateLayers = () => {
  const dispatch = useAppDispatch();
  const imagery = useAppSelector((state) => state.candidate.imagery);
  const liquid = useAppSelector((state) => state.candidate.liquid);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={imagery}
            aria-label="Cloud tops"
            onChange={(e) =>
              dispatch(candidateActions.setImagery(e.target.checked))
            }
          />
          <span className="text-sm font-semibold">
            Cloud tops &middot; {Band13Legend.name}
          </span>
        </label>

        {imagery && (
          <>
            <div className="text-xs opacity-60">{Band13Legend.summary}</div>
            <Band13Ramp />
            <div className="text-xs opacity-50">{Band13Legend.caveat}</div>
          </>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="toggle toggle-sm"
            checked={liquid}
            aria-label="Supercooled liquid water"
            onChange={(e) =>
              dispatch(candidateActions.setLiquid(e.target.checked))
            }
          />
          <span className="text-sm font-semibold">Supercooled liquid water</span>
        </label>

        {liquid && (
          <>
            <Ramp
              bands={SLW_BANDS}
              rgb={SLW_RGB}
              captions={SLW_BANDS.map((band) => String(band.value))}
              titles={SLW_LABELS}
            />
            <div className="text-xs opacity-60">
              g/m² in the −5 to −12 °C band &middot; {SLW_LABELS[0]} to{" "}
              {SLW_LABELS[SLW_LABELS.length - 1]}
            </div>
            <div className="text-xs opacity-50">
              Modelled, not observed: HRRR's analysis of what is inside the
              cloud, which no satellite can see. Drawn for the analysis hour, so
              it is the model's best estimate of right now rather than a
              forecast.
            </div>
          </>
        )}
      </div>
    </div>
  );
};
