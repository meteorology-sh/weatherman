// Store
import { useAppSelector } from "@/lib/store/hooks";

// Components
import { ArcGIS } from "./Map";
import { ReplayCalendar } from "./ReplayCalendar";
import { ReplayLayers } from "./ReplayLayers";
import { ReplayStatus } from "./ReplayStatus";
import { ReplayField } from "./ReplayField";

/**
 * The same three observed-and-modelled layers as the candidate map, at an hour
 * the operator picks rather than at this one.
 *
 * The panel carries the picker, what actually loaded, and the candidate field's
 * summary — the join is the one readout worth showing here, because four
 * separate ones with no join between them are the same map with a different
 * clock on it.
 */
export const Replay = () => {
  const at = useAppSelector((state) => state.replay.at);
  const ready = useAppSelector((state) => state.replay.ready);

  return (
    <div className="w-full h-full bg-black px-4 grid grid-cols-3">
      <div className="col-span-1 p-4 h-[calc(90vh)] overflow-y-auto">
        <div className="prose">
          <h2>Replay</h2>
          <p>What the sky was doing at an hour you choose.</p>
        </div>

        <div className="py-4">
          <ReplayCalendar />
        </div>

        {at === null ? (
          <div className="text-sm opacity-60">
            Pick a date and hour to load. Times are UTC, matching the model
            cycles and scan times the layers are keyed on.
          </div>
        ) : (
          <>
            <ReplayStatus />
            {ready !== null && (
              <>
                <div className="divider my-1" />
                <ReplayField />
                <div className="divider my-1" />
                <ReplayLayers />
              </>
            )}
          </>
        )}
      </div>
      <div className="col-span-2">
        <ArcGIS mode="replay" />
      </div>
    </div>
  );
};
