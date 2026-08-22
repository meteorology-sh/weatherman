// Router
import { Link } from "react-router";

// Hooks
import { useAppSelector } from "~/lib/store/hooks";

// Components
import { Status } from "./Status";
import { Section } from "./Section";

/**
 * Every programme this evaluation can be run against.
 *
 * **A programme with no parsed flight record is still listed.** Texas licenses
 * several and only one has been read out of its reports so far. A list showing
 * only that one would make a single operator's season look like the whole state,
 * which is the error this page exists to prevent.
 */
export const Regions = () => {
  const { all, loading, error } = useAppSelector((state) => state.regions);

  if (loading || error || !all) {
    return (
      <div className="p-8">
        <Status
          loading={loading}
          missing={null}
          error={error}
          what="Reading the programme list"
        />
      </div>
    );
  }

  const ready = all.filter((region) => region.evaluable);
  const waiting = all.filter((region) => !region.evaluable);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl p-8 flex flex-col gap-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold">
            Which programme are we checking?
          </h1>
          <p className="text-sm max-w-2xl">
            Weather modification in Texas is run by several licensed programmes,
            each publishing its own daily reports. The evaluation runs against
            one programme at a time, because a season is a whole dataset rather
            than a filter on one.
          </p>
        </div>

        <Section
          heading="Ready to evaluate"
          subtitle="Reports parsed into a flight record, with every flare's coordinates and release minute."
        >
          <div className="flex flex-col gap-3">
            {ready.map((region) => (
              <Link
                key={region.id}
                to={`/${region.id}`}
                className="card bg-base-200 hover:bg-base-300 transition-colors"
              >
                <div className="card-body p-4 flex-row items-baseline justify-between gap-4">
                  <div className="flex flex-col gap-1">
                    <span className="font-semibold">{region.name}</span>
                    <span className="text-xs">
                      {region.base && `${region.base} · `}
                      {region.season} season
                    </span>
                  </div>
                  <span className="text-sm font-mono whitespace-nowrap">
                    {region.days} days · {region.flares} flares
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </Section>

        <Section
          heading="Not parsed yet"
          subtitle="Named so the gap in coverage is visible. Each needs its report source found and read into a flight record before anything here can be measured against it — and the list itself is unconfirmed against the state permit list."
        >
          <ul className="flex flex-col gap-2">
            {waiting.map((region) => (
              <li
                key={region.id}
                className="flex items-baseline justify-between gap-4 border-b border-base-300 pb-2"
              >
                <span className="text-sm">{region.name}</span>
                <span className="badge badge-ghost badge-sm">
                  no flight record
                </span>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
};
