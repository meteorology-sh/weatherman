// React
import { useEffect, useState } from "react";

// Client
import { GetDay, GetDays } from "~/lib/client";

// Layers
import { WEATHER, type LayerKey } from "~/lib/layers";

// Types
import type { Day, DaySummary, Release } from "~/lib/types";

// Components
import { DayList } from "./components/DayList";
import { EvalMap } from "./components/EvalMap";
import { Readout } from "./components/Readout";
import { Timeline } from "./components/Timeline";

/**
 * The eval map.
 *
 * State is plain React, not Redux. `eval/` is deliberately outside both
 * packages and carries no dependencies of its own, and this is one page with
 * one selection in it — a store would be ceremony around three values.
 */
export const App = () => {
  const [days, setDays] = useState<DaySummary[] | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [day, setDay] = useState<Day | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [picked, setPicked] = useState<Release | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nearOnly, setNearOnly] = useState(false);
  const [active, setActive] = useState<Set<LayerKey>>(
    () => new Set<LayerKey>(["liquid", "radar"])
  );

  /**
   * Which flares to draw.
   *
   * The whole day by default, because the track is the context — where they
   * worked and where they did not is half of what there is to see. Narrowed to
   * the half hour either side of the cursor when the question is the narrower
   * one: what was under the aircraft at this moment, with the layers drawn for
   * this moment and nothing from two hours later sitting on top of them.
   */
  const shown =
    nearOnly && cursor
      ? {
          from: new Date(
            new Date(cursor).getTime() - 30 * 60_000
          ).toISOString(),
          to: new Date(new Date(cursor).getTime() + 30 * 60_000).toISOString(),
        }
      : null;

  useEffect(() => {
    GetDays()
      .then(setDays)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  // A new day clears the moment and the selection: neither means anything
  // against a different flight.
  useEffect(() => {
    if (!date) return;
    setDay(null);
    setCursor(null);
    setPicked(null);
    GetDay(date)
      .then(setDay)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [date]);

  // A click on the map carries only a release time; the record is the truth.
  const pick = (release: Release | null) => {
    if (!release) return setPicked(null);
    setPicked(day?.releases.find((r) => r.at === release.at) ?? release);
  };

  const toggle = (key: LayerKey) =>
    setActive((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (error) return <div className="text-error p-4">{error}</div>;
  if (!days) return <span className="loading loading-spinner m-4" />;

  return (
    <div className="flex h-full text-base-content">
      <aside className="w-64 shrink-0 overflow-y-auto bg-base-200">
        <div className="p-3">
          <h1 className="text-sm font-semibold">SEEDED DAYS</h1>
          <p className="text-xs">
            West Texas Weather Modification Association, 2025.
          </p>
        </div>
        <DayList days={days} selected={date} onSelect={setDate} />
      </aside>

      <main className="relative flex-1">
        <EvalMap
          date={date}
          cursor={cursor}
          active={active}
          shown={shown}
          onPick={pick}
        />

        <div className="absolute top-3 left-3 z-10 rounded bg-base-200/95 p-2">
          <div className="flex flex-col gap-1">
            {/* Muted until a moment is picked, because until then there is no
                frame for these to draw and a live-looking switch that changes
                nothing reads as a broken one. */}
            {WEATHER.map(({ key, label }) => (
              <label
                key={key}
                className={`flex items-center gap-2 text-xs ${cursor ? "" : "opacity-50"}`}
              >
                <input
                  type="checkbox"
                  className="toggle toggle-xs"
                  checked={active.has(key)}
                  disabled={!cursor}
                  onChange={() => toggle(key)}
                />
                {label}
              </label>
            ))}
          </div>
          <div className="mt-2 border-t border-base-content/20 pt-2">
            {cursor ? (
              <>
                <div className="font-mono text-xs">{cursor.slice(11, 16)}Z</div>
                <label className="mt-1 flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    className="toggle toggle-xs"
                    checked={nearOnly}
                    onChange={() => setNearOnly((on) => !on)}
                  />
                  flares within 30 min
                </label>
              </>
            ) : (
              <div className="text-xs">pick a moment</div>
            )}
          </div>
        </div>
      </main>

      <aside className="flex w-96 shrink-0 flex-col overflow-hidden bg-base-200">
        {!day && (
          <div className="p-4 text-sm">
            {date ? (
              <span className="loading loading-spinner" />
            ) : (
              "Pick a day to load its flights."
            )}
          </div>
        )}
        {day && (
          <>
            <div className="max-h-[50%] shrink-0 overflow-y-auto border-b border-base-content/20">
              <Timeline
                day={day}
                cursor={cursor}
                onCursor={setCursor}
                onPick={pick}
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              <Readout day={day} release={picked} />
            </div>
          </>
        )}
      </aside>
    </div>
  );
};
